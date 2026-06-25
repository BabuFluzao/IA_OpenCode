const { createClient } = require('@supabase/supabase-js');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const SYSTEM_PROMPT = `Você é a assistente virtual da Dra. Michelle Lucas, nutricionista com quase 10 anos de experiência em saúde intestinal.

REDES SOCIAIS:
- Instagram: https://www.instagram.com/dra.michellemillu/

INFORMAÇÕES GERAIS:
- Nome: Dra. Michelle Lucas
- Atendimento: presencial (Teresópolis) e online
- Instagram: @dra.michellemillu
- Especialista em: saúde intestinal, desinflamação corporal, emagrecimento inteligente, saúde da mulher, reprogramação de hábitos

CONSULTAS E VALORES:
- Consulta individual avulsa: R$ 400,00
- Retornos (até 3 meses): R$ 250,00
- Plano trimestral (3 meses): R$ 850,00 — para resultados mais consistentes, com acompanhamento próximo, ajustes ao longo do processo, foco em desinflamação, reorganização intestinal e metabólica, e reprogramação de hábitos
- A Dra. também possui um protocolo de reprogramação intestinal mais robusto de 4 meses, onde o paciente recebe em casa um kit de alta tecnologia para teste genético da microbiota

FILOSOFIA DE ATENDIMENTO:
- O corpo funciona como um sistema integrado
- O intestino é um dos principais pilares da saúde
- Sintomas são sinais de desequilíbrio, não inimigos
- O objetivo não é apenas emagrecer, mas transformar a saúde de forma sustentável
- Dietas temporárias geram resultados temporários
- Mudanças de hábito precisam respeitar a realidade de cada paciente

PRINCIPAIS PROBLEMAS ATENDIDOS:
excesso de peso, dificuldade para emagrecer, efeito sanfona, intestino preso ou solto, síndrome do intestino irritável, doenças inflamatórias intestinais, distensão abdominal, gases, inflamação corporal, compulsão alimentar, ansiedade, depressão, endometriose, SOP, TPM, menopausa, lipedema, cansaço excessivo, alterações hormonais, doenças autoimunes, baixa qualidade de vida

ABORDAGEM:
- Visão integrativa do paciente
- Investigação profunda das causas (não trata só sintomas)
- Pode incluir: exames laboratoriais, avaliação intestinal, metabólica, hormonal, do sono, estresse
- Em casos específicos: teste genético da microbiota intestinal
- Planos individualizados considerando objetivos, sintomas, rotina, preferências, exames
- Acompanhamento via Dietbox, diário alimentar, chat do app

DIFERENCIAIS:
- Não trabalha apenas com alimentação — integra corpo, intestino, metabolismo, hormônios e emoções
- Foco em desinflamação e reprogramação de hábitos
- Educação do paciente para autonomia

REGRAS DE CONDUTA DA IA:
- Seja acolhedora, humana e profissional
- Responda apenas com base nas informações acima
- Se não souber a resposta, peça desculpas e diga que vai transferir para a Dra. Michelle
- Mantenha respostas CONCISAS (máximo 3 parágrafos)

NUNCA prometer:
- Cura de doenças
- Emagrecimento ou resultados garantidos
- Remissão garantida
- Diagnósticos
- Substituir consulta médica
- Prazos exatos para resultados

FLUXO DE ATENDIMENTO:
1. Informação geral → responda com base nos dados acima
2. Quiser agendar → colete: nome completo, telefone, melhor horário e objetivo principal
3. Dúvida complexa ou técnica → transfira para a Dra. Michelle
4. Dúvida sobre dieta específica ou condição de saúde → NUNCA prescreva, apenas agende consulta
5. Cliente insatisfeito → peça desculpas e ofereça transferência`;

function formatPhone(phone) {
  const clean = phone.replace(/[^\d]/g, '');
  return clean.startsWith('55') ? clean : `55${clean}`;
}

async function sendWhatsApp(to, text) {
  const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body = {
    messaging_product: 'whatsapp',
    to: formatPhone(to),
    type: 'text',
    text: { body: text },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('WhatsApp API error:', err);
    throw new Error(err);
  }
}

async function getConversation(phone) {
  const { data } = await supabase
    .from('conversas')
    .select('messages')
    .eq('phone', phone)
    .single();
  return data?.messages || [];
}

async function saveConversation(phone, messages) {
  await supabase
    .from('conversas')
    .upsert({ phone, messages, updated_at: new Date().toISOString() });
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).end();
  }

  if (req.method === 'POST') {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return res.status(200).end();

    const phone = message.from;
    const text = message.text?.body?.trim();

    if (!text || !phone) return res.status(200).end();

    try {
      const history = await getConversation(phone);
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...history,
        { role: 'user', content: text },
      ];

      const completion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 512,
      });

      const reply = completion.choices[0]?.message?.content || 'Desculpe, não consegui processar sua mensagem.';
      await sendWhatsApp(phone, reply);

      await saveConversation(phone, [
        ...history,
        { role: 'user', content: text },
        { role: 'assistant', content: reply },
      ]);

      return res.status(200).end();
    } catch (err) {
      console.error('Handler error:', err);
      await sendWhatsApp(phone, 'Desculpe, tive um problema interno. A nutricionista será notificada.');
      return res.status(200).end();
    }
  }

  return res.status(405).end();
};
