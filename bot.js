require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const WebSocket = require('ws');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');
const { buildPrompt } = require('./prompt.js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { transport: WebSocket },
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEBOUNCE_MS = 10000;
const pendings = new Map();
const AUTH_DIR = path.join(__dirname, 'auth_info');
const AUTHORIZED_PHONES = ['5521972896655', '180634043572309'];
const RESTRICT_PHONES = false;

// buildPrompt movido para prompt.js

async function savePatientData(phone, text, history) {
  const allText = [text, ...history.filter(m => m.role === 'user').map(m => m.content)].join(' ');
  const nomeMatch = allText.match(/(?:meu nome é|me chamo|sou|nome completo é|chamo[-\s]me|meu nome)\s*:?\s*([A-ZÀ-Úa-zà-ú]+(?:\s+[A-ZÀ-Úa-zà-ú]+){1,4})/i);
  const emailMatch = allText.match(/(?:email|e-mail|meu email)\s*:?\s*([\w._%+-]+@[\w.-]+\.[a-z]{2,})/i);
  const cpfMatch = allText.match(/(?:cpf|meu cpf)\s*:?\s*(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/i);
  const dnMatch = allText.match(/(?:data de nascimento|nascimento|nasci[^a-z]*)\s*:?\s*(\d{2}\s*[/]\s*\d{2}\s*[/]\s*\d{4})/i);
  const nome = nomeMatch ? nomeMatch[1].trim() : null;
  const email = emailMatch ? emailMatch[1].trim() : null;
  const cpf = cpfMatch ? cpfMatch[1].trim() : null;
  const dataNascimento = dnMatch ? dnMatch[1].trim() : null;
  if (nome || email || cpf || dataNascimento) {
    try {
      await supabase.from('pacientes').upsert({
        phone, nome, email, cpf, data_nascimento: dataNascimento,
      }, { onConflict: 'phone' });
      if (nome) console.log(`📋 ${phone}: dados salvos (nome=${nome}${email ? `, email=${email}` : ''})`);
    } catch (e) {
      console.error(`Erro ao salvar pacientes ${phone}:`, e.message);
    }
  }
}

function formatPhone(phone) {
  return phone.split('@')[0];
}

async function getConversation(phone) {
  const { data } = await supabase
    .from('conversas')
    .select('messages, status, nome')
    .eq('phone', phone)
    .single();
  return { messages: data?.messages || [], status: data?.status || 'bot', nome: data?.nome || '' };
}

async function saveConversation(phone, messages, status, nome) {
  await supabase
    .from('conversas')
    .upsert({ phone, messages, status, nome, updated_at: new Date().toISOString() });
}

function extractName(text, currentNome) {
  if (currentNome) return currentNome;
  const patterns = [
    /meu nome é\s+(\w+)/i,
    /me chamo\s+(\w+)/i,
    /sou (?:a|o)\s+(\w+)/i,
    /(?:a|o)\s+(\w+),/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  }
  return '';
}

const TRANSFER_KEYWORDS = [
  'humanizado', 'falar com a dra', 'falar com a michelle',
  'quero falar com', 'atendimento humano', 'quero ser atendida',
  'quero ser atendido', 'transferir', 'falar com a doutora',
  'quero falar com a doutora', 'falar com michelle', 'atendimento humanizado',
  'falar com humano', 'falar com pessoa', 'quero ser atendido por humano',
  'falar com uma pessoa', 'atendimento humano necessario',
  'marcar consulta', 'agendar consulta', 'agendar retorno',
  'marcar retorno', 'quero agendar', 'quero marcar',
  'disponibilidade', 'horario disponivel', 'horários disponíveis',
  'agenda', 'qual horario', 'datas disponiveis',
  'semana que vem', 'atendendo normal', 'vai estar atendendo',
  'esta atendendo', 'horario de atendimento', 'funcionamento',
];

function shouldTransfer(text) {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return TRANSFER_KEYWORDS.some(k => lower.includes(k));
}

function getMessageText(msg) {
  if (msg.message?.conversation) return msg.message.conversation;
  if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  return '';
}

function isMedia(msg) {
  return !!(msg.message?.imageMessage || msg.message?.documentMessage || msg.message?.stickerMessage);
}

async function processMessage(phone, from, texts, pushname, sock) {
  const text = texts.join('\n');
  console.log(`\n📩 ${phone}: ${text}`);

  try {
    const { messages: history, status, nome } = await getConversation(phone);
    const initialNome = nome || (pushname ? pushname.trim() : '');

    if (status === 'human') {
      console.log(`🚫 ${phone}: já transferido, ignorando`);
      return;
    }

    if (shouldTransfer(text)) {
      const reply = '🔴 AGUARDANDO ATENDIMENTO — A equipe da Dra. Michelle vai assumir agora.';
      const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }];
      await saveConversation(phone, newHistory, 'human', initialNome);
      await sock.sendMessage(from, { text: reply });
      console.log(`🔄 ${phone}: transferido para humano`);
      return;
    }

    const newNome = extractName(text, initialNome);
    const prompt = buildPrompt(newNome || initialNome);

    const messages = [
      { role: 'system', content: prompt },
      ...history,
      { role: 'user', content: text },
    ];

    let completion;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        completion = await groq.chat.completions.create({
          messages,
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          temperature: 0.4,
          max_tokens: 512,
        });
        break;
      } catch (e) {
        if (e.status === 429 && attempt < 3) {
          const wait = attempt * 2000;
          console.log(`⏳ Rate limit (429), tentativa ${attempt}/3, aguardando ${wait}ms...`);
          await new Promise(r => setTimeout(r, wait));
        } else {
          throw e;
        }
      }
    }

    const reply = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

    if (reply.includes('🔴') || reply.includes('AGUARDANDO ATENDIMENTO')) {
      await savePatientData(phone, text, history);
    }

    const newHistory = [...history, { role: 'user', content: text }, { role: 'assistant', content: reply }];
    await saveConversation(phone, newHistory, 'bot', newNome || initialNome);

    await sock.sendMessage(from, { text: reply });
    console.log(`✅ ${phone}${newNome ? ` (${newNome})` : ''}: ${reply.slice(0, 60)}...`);
  } catch (err) {
    console.error('Erro:', err.message);
    try {
      await sock.sendMessage(from, { text: 'Desculpe, tive um problema interno. A nutricionista será notificada.' });
    } catch (_) {}
  }
}

async function handleMedia(phone, from, sock, pushname) {
  console.log(`📎 ${phone}: enviou arquivo`);
  try {
    const { messages: history, status, nome } = await getConversation(phone);
    if (status === 'human') return;
    const finalNome = nome || (pushname ? pushname.trim() : '');
    const reply = '🔴 AGUARDANDO ATENDIMENTO — Arquivo recebido. A equipe vai assumir agora.';
    const newHistory = [...history, { role: 'user', content: `[Arquivo]` }, { role: 'assistant', content: reply }];
    await saveConversation(phone, newHistory, 'human', finalNome);
    await sock.sendMessage(from, { text: reply });
    console.log(`🔄 ${phone}: arquivo recebido, transferido para humano`);
  } catch (err) {
    console.error('Erro media:', err.message);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['WhatsApp Nutri Bot', 'Chrome', '1.0.0'],
    syncFullHistory: false,
    markOnlineOnConnect: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\nEscaneie o QR Code abaixo com seu WhatsApp:\n');
      qrcode.generate(qr, { small: true });
      const qrPath = path.join(__dirname, 'qrcode.png');
      QRCode.toFile(qrPath, qr, { width: 400 }, (err) => {
        if (!err) console.log(`\nQR Code salvo em: ${qrPath}\n   Abra esse arquivo e escaneie com o WhatsApp`);
      });
    }

    if (connection === 'open') {
      console.log('WhatsApp conectado! Bot pronto.');
    }

    if (connection === 'close') {
      console.log('Conexão fechada. pm2 vai reiniciar em 5s.');
      setTimeout(() => process.exit(1), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key?.fromMe) continue;
      if (msg.key?.remoteJid?.includes('@g.us') || msg.key?.remoteJid?.includes('@broadcast')) continue;

      const phone = formatPhone(msg.key?.remoteJid || '');
      const from = msg.key?.remoteJid || '';
      const pushname = msg.pushName || '';

      if (!phone || !from) continue;
      if (RESTRICT_PHONES && !AUTHORIZED_PHONES.includes(phone)) continue;

      if (isMedia(msg)) {
        await handleMedia(phone, from, sock, pushname);
        continue;
      }

      const text = getMessageText(msg).trim();
      if (!text) continue;

      console.log(`⏳ ${phone}: ${text}`);

      if (pendings.has(phone)) {
        clearTimeout(pendings.get(phone).timer);
        pendings.get(phone).texts.push(text);
      } else {
        pendings.set(phone, { texts: [text], from, pushname });
      }

      const entry = pendings.get(phone);
      entry.timer = setTimeout(async () => {
        pendings.delete(phone);
        await processMessage(phone, from, entry.texts, entry.pushname, sock);
      }, DEBOUNCE_MS);
    }
  });
}

console.log('Iniciando WhatsApp Nutri Bot (Baileys)...');
startBot();
