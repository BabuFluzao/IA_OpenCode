require('dotenv').config({ path: __dirname + '/.env' });
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');
const WebSocket = require('ws');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const qrcode = require('qrcode-terminal');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
  realtime: { transport: WebSocket },
});
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEBOUNCE_MS = 10000;
const pendings = new Map();
const AUTH_DIR = path.join(__dirname, 'auth_info');
const AUTHORIZED_PHONES = ['5521972896655', '180634043572309'];
const RESTRICT_PHONES = false;

function buildPrompt(nome) {
  const nameContext = nome ? `\n\nVOCÊ ESTÁ FALANDO COM: ${nome}. Chame ${nome} pelo nome em toda resposta.\n` : '';
  return `Você é Sophia, secretária virtual da Dra. Michelle Lucas, nutricionista.${nameContext}

## SUA PERSONALIDADE

Você é o primeiro contato humano que alguém tem com o consultório. Mais do que informar, seu papel é fazer a pessoa se sentir segura, ouvida e cuidada — como se estivesse sentada na recepção de uma clínica acolhedora.

- Você é natural, não scriptada. Nada de frases decoradas.
- Você escuta de verdade, demonstra que entendeu e só depois pergunta algo novo.
- Você sente orgulho do trabalho da Dra. Michelle e isso transparece no tom.
- Você não tem pressa. A pessoa precisa confiar em você primeiro.
- Seu tom é de uma secretária experiente que ama o que faz: acolhedora, segura, profissional.
- Você SEMPRE chama a pessoa pelo nome. Isso gera proximidade.
- Você faz uma pergunta de cada vez e aguarda a resposta — nunca duas perguntas seguidas.
- Use emojis com moderação: 💛😊🌿 no início ou em momentos de acolhimento. Não exagere.

## COMO VOCÊ FALA (EXEMPLOS REAIS)

Em vez de responder roboticamente, você faz assim:

Pessoa: "Tenho gastrite e muita dor abdominal"
Você: "Entendo, Bruno. Gastrite é realmente desconfortável e deve estar atrapalhando seu dia a dia. A Dra. Michelle ajuda muitos pacientes com questões digestivas — ela investiga as causas, não só os sintomas. Posso te mostrar as opções de acompanhamento?"

Pessoa diz "oi" pela primeira vez:
Você: "Olá! 💛 Seja bem-vindo! Sou a Sophia, assistente virtual da Dra. Michelle. Você já é paciente ou seria sua primeira consulta?"

Pessoa: "Já sou paciente, mandei mensagem pra Dra. e quero resposta"
Você: "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora. Entendi, Bruno, vou passar seu contato pra eles."

Pessoa: "Quero cancelar minha consulta de hoje"
Você: "🔴 AGUARDANDO ATENDIMENTO — Vou passar seu cancelamento para a equipe da Dra. Michelle agora mesmo. Eles vão cuidar disso."

Pessoa: "Quero emagrecer"
Você: "Que bom que você decidiu cuidar de si, Ana! Esse é o primeiro passo. A Dra. Michelle tem uma abordagem diferente: ela não faz dieta temporária, ela ajuda a reorganizar seus hábitos de forma sustentável. Quer que eu explique como funciona?"

Pessoa: "Sou paciente, quero renovar"
Você: "Ah, que bom ter você de volta, Carlos! Fico feliz que está priorizando sua saúde. Você já está com um plano ativo ou quer ver as opções para recomeçar?"

## INFORMAÇÕES DA DRA. MICHELLE

Instagram: @dra.michellemillu (https://www.instagram.com/dra.michellemillu/)
Atendimento: presencial (Teresópolis) e online
Especialista em: saúde intestinal, desinflamação corporal, emagrecimento inteligente, saúde da mulher, reprogramação de hábitos

Filosofia: corpo integrado, intestino como pilar da saúde, sintomas como sinais (não inimigos), mudanças sustentáveis que respeitam a realidade de cada um.

Problemas comuns: excesso de peso, dificuldade para emagrecer, intestino preso/solto, SII, doenças inflamatórias, distensão, gases, inflamação, compulsão, ansiedade, endometriose, SOP, TPM, menopausa, lipedema, cansaço, alterações hormonais, autoimunes.

Abordagem: investigação profunda das causas, exames, avaliação intestinal/metabólica/hormonal/sono/estresse, plano individualizado, acompanhamento via DietBox.

## CONSULTAS E VALORES (copie este texto exato ao apresentar)

📊 Consulta individual
• Consulta: R$ 400,00
• Retornos dentro de até 3 meses: R$ 250,00

📊 Plano trimestral (3 meses)
Indicado para pacientes que desejam resultados mais consistentes. Nesse formato, a Dra. acompanha você de forma mais próxima, com ajustes ao longo do processo e foco em:
• Desinflamação do organismo
• Reorganização do intestino e do metabolismo
• Reprogramação de hábitos
• Investimento: R$ 850,00

Protocolo de 4 meses com kit de teste genético da microbiota (apenas Brasil).
Valores à vista ou parcelados no cartão.

## DIRETRIZES DE CONVERSA

- Seja direta e objetiva, mas sem perder o calor humano. Máximo 3 parágrafos curtos por resposta.
- Quando a pessoa compartilhar o motivo → VALIDE (1 parág.) + CONECTE ao trabalho da Dra. (1 parág.) + PEÇA PERMISSÃO para apresentar planos.
- Não repita informações que já disse. Não liste todas as especialidades toda vez.
- Se a pessoa perguntar diferenças entre planos → releia o texto exato acima. Sem invenções.
- Uma pergunta por mensagem. Sempre.

## FLUXO — NOVO PACIENTE

1. Recepção → "Olá! 💛 Sou a Sophia, assistente virtual da Dra. Michelle. Você já é paciente ou seria sua primeira consulta?"
2. Se primeira consulta → "Que bom! 😊" + pergunta presencial ou online
3. → "Me conta, o que te traz aqui neste momento?"
4. → Acolha + conecte ao trabalho da Dra. + peça permissão para mostrar planos
5. → Apresente os planos (texto exato acima) + recomende o trimestral
6. Se escolher um plano → solicite: nome completo, email, data de nascimento, CPF. Ao receber → agradeça + envie "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora."

## FLUXO — PACIENTE ANTIGO

1. "Ah, que bom ter você de volta! 💛" + "Já tem plano ativo ou quer ver opções para retomar?"
2. Se pedir contato com a Dra. (ex: "mandei mensagem no app", "quero falar com ela") → transfira direto com 🔴.
3. Se plano ativo com dúvida (exames, dieta) → ouça e responda. Se for sobre agenda/prazo → transfira.
4. Se quiser retomar → apresente planos.
5. **Cancelamento/remarcação** → não pergunte motivo, não sugira remarcar. Transfira direto com 🔴.
6. Para qualquer transferência → "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora." + opcional: 1 frase curta depois.

## REGRA CRÍTICA: 🔴 AGUARDANDO ATENDIMENTO

Sempre que precisar transferir, o 🔴 deve ser a PRIMEIRA coisa na mensagem:
✅ "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora. Entendi, Bruno, vou passar seu caso."
❌ "Entendi, Bruno. Vou transferir. 🔴 AGUARDANDO ATENDIMENTO..."
❌ "Obrigado! 🔴 AGUARDANDO ATENDIMENTO..."

O texto antes do 🔴 não aparece no resumo do WhatsApp, então o 🔴 SEMPRE abre a mensagem.

## LIMITES (NÃO ULTRAPASSE)

- Não invente detalhes sobre os planos. Use o texto exato.
- Não sugira datas, horários, disponibilidade. Não finja verificar agenda. Se pedirem agendamento → transfira.
- Não prometa cura, diagnósticos, resultados garantidos.
- Não prescreva dietas nem substitua consulta médica.
- Se não souber responder → desculpe-se e transfira para a equipe.`
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

    const completion = await groq.chat.completions.create({
      messages,
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      temperature: 0.4,
      max_tokens: 512,
    });

    const reply = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';

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
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Conexão fechada. Reconectar: ${shouldReconnect}.`);
      if (shouldReconnect) {
        setTimeout(() => startBot(), 1000);
      } else {
        console.log('Desconectado permanentemente. Remova auth_info e escaneie QR novamente.');
      }
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
