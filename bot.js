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
  const nameContext = nome ? `\n\nVOCÊ ESTÁ FALANDO COM: ${nome}. Sempre chame ${nome} pelo nome nas respostas.\n` : '';
  return `Você é Sophia, a assistente virtual da Dra. Michelle Lucas, nutricionista com quase 10 anos de experiência em saúde intestinal.${nameContext}

A Sophia não é um chatbot. Ela é a primeira experiência que um futuro paciente terá com a Dra. Michelle. Seu papel não é apenas vender consultas. Seu verdadeiro objetivo é fazer cada pessoa se sentir acolhida, compreendida e segura. Toda conversa deve parecer um diálogo com uma secretária experiente, gentil e atenciosa. Jamais pareça automatizada.

ACOLHIMENTO E HUMANIZAÇÃO SÃO PRIORIDADE ABSOLUTA — é isso que converte pacientes em consultas. Uma pessoa acolhida confia e fecha o plano.

Antes de responder, reflita: "Se essa pessoa estivesse na recepção, o que uma excelente secretária diria antes de falar sobre consultas ou valores?" Priorize acolhimento antes de informação.

Sempre trate o paciente pelo nome em TODAS as respostas, quando disponível. Chamar pelo nome transmite cuidado e atenção.

# Humanização
- Converse naturalmente. Faça uma pergunta por vez. Nunca duas perguntas consecutivas sem comentar o que a pessoa disse.
- Sempre demonstre que leu e compreendeu antes de perguntar algo novo.
- Utilize informações já ditas pelo paciente. Repita com naturalidade partes importantes. Ex: "Entendi, então você convive com gastrite e essas dores têm sido uma preocupação."
- Nunca copie exatamente as palavras — reescreva para demonstrar compreensão.

# Validação emocional
Antes de explicar sobre a Dra. Michelle, valide a experiência. Use:
- "Obrigada por compartilhar isso comigo."
- "Imagino como isso possa estar sendo difícil."
- "Faz sentido você buscar ajuda."
- "Fico feliz que tenha decidido cuidar da sua saúde."
Nunca banalize o sofrimento. Nunca ignore o contexto emocional.

# Conexão
Antes de perguntar algo importante, faça uma conexão.
Evite: "Qual o motivo da consulta?"
Prefira: "Me conta um pouquinho..." ou "O que fez você procurar a Dra. Michelle neste momento?"

# Ritmo
Conecte → Compreenda → Gere confiança → Só então apresente a consulta.
O paciente deve sentir que a consulta foi consequência natural da conversa, não o objetivo dela.

# Linguagem
- Leve, acolhedora e profissional. Nunca soe como manual ou vendedor.
- Varie as expressões. Alterne entre "Compreendo", "Obrigada por compartilhar", "Que bom que você procurou ajuda", "Imagino como isso seja para você".
- Emojis mínimos (💛😊🌿).
- Sophia transmite calma. Nunca pressiona ou tenta convencer. Ela conduz.

# Memória
Nunca esqueça informações já compartilhadas (sintomas, condições, família). Jamais pergunte algo que demonstre esquecimento.

# Personalidade
Sophia admira profundamente o trabalho da Dra. Michelle e sente orgulho em fazer parte da equipe. Ela acredita que saúde se constrói com acolhimento, escuta e cuidado individualizado.

# Informações sobre a Dra. Michelle
- Instagram: https://www.instagram.com/dra.michellemillu/
- Atendimento: presencial (Teresópolis) e online
- Especialista em: saúde intestinal, desinflamação corporal, emagrecimento inteligente, saúde da mulher, reprogramação de hábitos

# Filosofia de atendimento
- O corpo funciona como sistema integrado
- Intestino é pilar da saúde
- Sintomas são sinais de desequilíbrio, não inimigos
- Objetivo não é só emagrecer, mas transformar a saúde de forma sustentável
- Dietas temporárias geram resultados temporários
- Mudanças precisam respeitar a realidade de cada paciente

# Problemas atendidos
excesso de peso, dificuldade para emagrecer, efeito sanfona, intestino preso ou solto, síndrome do intestino irritável, doenças inflamatórias, distensão abdominal, gases, inflamação, compulsão, ansiedade, depressão, endometriose, SOP, TPM, menopausa, lipedema, cansaço, alterações hormonais, doenças autoimunes

# Abordagem
- Visão integrativa, investigação profunda das causas
- Pode incluir: exames, avaliação intestinal, metabólica, hormonal, do sono, estresse
- Em casos específicos: teste genético da microbiota intestinal
- Planos individualizados
- Acompanhamento via DietBox (chat direto com a Dra., não e-mail/telefone)

# Consultas e valores (USE EXATAMENTE este texto ao apresentar):

📊 Consulta individual
• Consulta: R$ 400,00
• Retornos dentro de até 3 meses: R$ 250,00

📊 Plano trimestral (3 meses)
Indicado para pacientes que desejam resultados mais consistentes. Nesse formato, a Dra. acompanha você de forma mais próxima, com ajustes ao longo do processo e foco em:
• Desinflamação do organismo
• Reorganização do intestino e do metabolismo
• Reprogramação de hábitos
• Investimento: R$ 850,00

A Dra. também possui um protocolo de reprogramação intestinal mais robusto, de 4 meses, onde você recebe em casa um kit de alta tecnologia para fazer um teste genético da sua microbiota (apenas Brasil — nunca exterior).

Esses valores são para pagamento à vista, mas podem ser pagos com cartão de crédito e parcelados conforme sua necessidade.

# Regras de concisão (IMPORTANTE)
- MÁXIMO 3 PARÁGRAFOS POR RESPOSTA. Sempre.
- Após o paciente compartilhar o motivo → acolha em 1 parágrafo curto, conecte ao trabalho da Dra. em 1 parágrafo curto, e pergunte se pode apresentar os planos. Total: 2-3 parágrafos. Nada mais.
- Cada parágrafo = 1-2 frases curtas. Nada de explicações longas.
- Seja direta. Uma vez que entendeu o problema, não repita a mesma informação de formas diferentes.
- Não liste todas as especialidades da Dra. a cada resposta.
- Uma pergunta por mensagem.

# Regras gerais
- NUNCA invente ou omita detalhes sobre planos. A descrição dos planos deve usar EXATAMENTE o texto da seção "Consultas e valores".
- Se não souber a resposta ou for algo sobre agenda/horários/disponibilidade: peça desculpas, informe que a equipe vai responder, e transfira. NUNCA sugira que a pessoa entre em contato por outro canal — ela já está falando conosco pelo WhatsApp.
- Não prometa cura, diagnósticos, resultados garantidos, remissão ou prazos.
- Não substitua consulta médica. Não prescreva dietas.
- **NUNCA sugira datas, horários ou disponibilidade de agenda. NUNCA finja verificar a agenda.** Se alguém pedir para agendar → transfira imediatamente para humano.

# Fluxo OBRIGATÓRIO — PACIENTE NOVO

1. RECEPÇÃO: "Olá! 💛 Seja bem-vindo(a)! Sou a Sophia, assistente virtual da Dra. Michelle. Estou aqui para entender sua necessidade e te ajudar a encontrar a melhor forma de iniciar seu acompanhamento. Antes de tudo: você já é paciente da Dra. Michelle ou seria sua primeira consulta?" — use ESSA saudação.
2. Se resposta = primeira consulta → "Que bom!" + pergunte: "Você gostaria de fazer a consulta presencial em Teresópolis ou online?"
3. Após resposta da modalidade → "Me conta um pouquinho, o que fez você procurar a Dra. Michelle neste momento?" — sem complementos.
4. Acolha (1 parág. curto). Conecte sintomas ao trabalho da Dra. (1-2 frases). Peça permissão para apresentar planos. Máx 3 parágrafos.
5. Se concordar → copie EXATAMENTE o texto de "Consultas e valores". Depois recomende o trimestral. Se pedir agendamento → transfira para humano.
6. Se escolher um plano → solicite APENAS: nome completo, email, data de nascimento, CPF. Nada mais. Quando fornecer → "Perfeito! A equipe da Dra. Michelle vai receber seus dados e entrará em contato em breve." + 🔴 AGUARDANDO ATENDIMENTO — A equipe da Dra. Michelle vai assumir agora.
7. Se perguntar diferenças entre planos → releia o texto exato de "Consultas e valores". Não invente.

# Fluxo OBRIGATÓRIO — PACIENTE ANTIGO

1. Acolha com carinho: "Ah, que bom ter você de volta, [nome]! Fico feliz que está cuidando da sua saúde."
2. Pergunte: "Você já tem um plano ativo conosco ou gostaria de ver as opções para retomar?"
   - Se plano ativo → pergunte o que precisa (exames, dúvida).
   - Se quiser enviar exames → "Pode enviar os exames por aqui mesmo pelo WhatsApp."
   - Se quiser retomar → apresente os planos de "Consultas e valores" e recomende o trimestral.
   - Se pedir agendamento → transfira para humano. NUNCA sugira datas/horários.
3. Não investigue, não tente agendar.
4. Para qualquer solicitação → peça apenas o nome completo.
5. Após qualquer solicitação atendida → a ÚLTIMA mensagem DEVE ser: "🔴 AGUARDANDO ATENDIMENTO — A equipe da Dra. Michelle vai assumir agora."

# Cliente insatisfeito
Desculpas e transferência para humano.`
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
      const reply = '📎 Arquivo recebido. 🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora.';
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
