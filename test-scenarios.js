const Groq = require('groq-sdk');
require('dotenv').config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Same buildPrompt from bot.js
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

## DIRETRIZES DE CONVERSA

- Máximo 3 parágrafos curtos por resposta.
- Uma pergunta por mensagem. Sempre.
- Quando a pessoa compartilhar o motivo → VALIDE (1 parág.) + CONECTE ao trabalho da Dra. (1 parág.) + PEÇA PERMISSÃO para apresentar planos.
- Não repita informações. Não liste todas as especialidades toda vez.

## FLUXO — NOVO PACIENTE

1. Se perguntar preço direto ("quanto custa?") → mesmo assim, SIGA O FLUXO: apresente-se como Sophia, pergunte se é novo ou antigo paciente. Só mostre valores no passo 5.
2. Recepção → "Olá! 💛 Sou a Sophia, assistente virtual da Dra. Michelle. Você já é paciente ou seria sua primeira consulta?"
3. Se primeira consulta → "Que bom! 😊" + pergunta presencial ou online
4. → "Me conta, o que te traz aqui neste momento?"
5. → Acolha + conecte ao trabalho da Dra. + peça permissão para mostrar planos
6. → Apresente os planos (use o texto exato da seção CONSULTAS E VALORES) + recomende o trimestral
7. Se escolher um plano → solicite: nome completo, email, data de nascimento, CPF. Ao receber → "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora."
8. **Se perguntar pelo teste da microbiota morando fora do Brasil** → informe direto: "O teste genético da microbiota é disponível apenas para pacientes no Brasil." Sem exceções, sem sugestões, sem contornar.

## FLUXO — PACIENTE ANTIGO

1. "Ah, que bom ter você de volta! 💛" + "Já tem plano ativo ou quer ver opções para retomar?"
2. Se pedir contato com a Dra. (ex: "mandei mensagem no app", "quero falar com ela") → transfira direto com 🔴.
3. Se plano ativo com dúvida (exames, dieta) → ouça e responda. Se for sobre agenda/prazo → transfira.
4. Se enviar exames → "Pode enviar os exames por aqui mesmo." + transfira com 🔴.
5. Se quiser retomar → apresente planos (use o texto exato da seção CONSULTAS E VALORES).
6. **Cancelamento/remarcação** → não pergunte motivo, não sugira remarcar. Transfira direto com 🔴.
7. Para qualquer transferência → "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora." (🔴 sempre primeiro).

## REGRA CRÍTICA: 🔴 AGUARDANDO ATENDIMENTO

Sempre que precisar transferir, o 🔴 deve ser a PRIMEIRA coisa na mensagem:
✅ "🔴 AGUARDANDO ATENDIMENTO — A equipe vai assumir agora. Entendi, Bruno, vou passar seu caso."
❌ "Entendi, Bruno. Vou transferir. 🔴 AGUARDANDO ATENDIMENTO..."
❌ "Obrigado! 🔴 AGUARDANDO ATENDIMENTO..."

O texto antes do 🔴 não aparece no resumo do WhatsApp, então o 🔴 SEMPRE abre a mensagem.

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

Protocolo de 4 meses com kit de teste genético da microbiota.
⚠️ **Teste da microbiota apenas para pacientes no Brasil.** Não é enviado para exterior. Se alguém morar fora, informe claramente que não é possível — sem sugestões alternativas.
Valores à vista ou parcelados no cartão.

**Importante:** Se perguntarem diferenças entre os planos, releia o texto exato acima. Não parafraseie os valores.

## LIMITES (NÃO ULTRAPASSE)

- Não invente detalhes sobre os planos. Use o texto exato.
- Não sugira datas, horários, disponibilidade. Não finja verificar agenda. Se pedirem agendamento → transfira com 🔴.
- Não prometa cura, diagnósticos, resultados garantidos.
- Não prescreva dietas nem substitua consulta médica.
- Se não souber responder → desculpe-se e transfira para a equipe.
- **Teste da microbiota apenas no Brasil.** Se alguém disser que mora fora → informe que o teste é apenas para Brasil, sem sugestões alternativas.
- **Cliente insatisfeito ou duvidando** (ex: "isso é robô?", "quero falar com a Dra.", "não estou satisfeito") → não discuta, não se explique. Transfira com 🔴.
- **Perguntou preço direto** (ex: "quanto custa") → mesmo assim siga o fluxo: apresente-se, pergunte se é novo ou antigo paciente. Só mostre valores depois de entender o caso.`;
}

const SCENARIOS = [
  {
    name: '1. NOVO PACIENTE — fluxo completo',
    steps: [
      { user: 'oi', check: ['sophia', 'já é paciente', 'primeira consulta', '💛'] },
      { user: 'primeira consulta', check: ['presencial', 'online', 'teresópolis', '😊', 'que bom'] },
      { user: 'presencial', check: ['me conta', 'o que te traz'] },
      { user: 'tenho gastrite e má digestão há anos', check: ['dra. michelle'], check_soft: ['entendi', 'entendo', 'posso te mostrar'] },
      { user: 'sim, quero saber', check: ['r$'], check_soft: ['trimestral', 'individual'] },
      { user: 'quero o trimestral', check_soft: ['email', 'nome completo', 'cpf', 'data de nascimento'] },
      { user: 'Bruno Guimarães, bruno@email.com, 15/06/1990, 123.456.789-00', check: ['🔴'] },
    ]
  },
  {
    name: '2. PACIENTE ANTIGO — cancelar consulta',
    steps: [
      { user: 'oi', check: ['sophia', 'já é paciente', 'primeira consulta'] },
      { user: 'sou paciente, quero cancelar minha consulta de hoje', check: ['🔴', 'aguardando atendimento'], avoid: ['motivo', 'remarcar'] },
    ]
  },
  {
    name: '3. PACIENTE ANTIGO — contato com a Dra.',
    steps: [
      { user: 'oi', check: ['sophia', 'já é paciente', 'primeira consulta'] },
      { user: 'já sou paciente, mandei mensagem pra dra pelo app e quero resposta', check: ['🔴'], avoid: ['plano ativo', 'opções para retomar'] },
    ]
  },
  {
    name: '4. NOVO PACIENTE — pediu agendar (deveTransfer no bot real)',
    steps: [
      { user: 'oi', check: ['sophia'] },
      { user: 'quero agendar uma consulta', check_soft: ['🔴'], avoid: ['disponível', 'horário'] },
    ]
  },
  {
    name: '5. PACIENTE ANTIGO — retomar tratamento',
    steps: [
      { user: 'oi' },
      { user: 'já sou paciente, quero retomar o tratamento', check: ['que bom ter você de volta', 'plano ativo'], check_soft: ['opções para retomar'] },
      { user: 'quero ver opções', check: ['r$'], check_soft: ['trimestral', 'individual'] },
      { user: 'qual a diferença entre os planos?', check: ['r$'], avoid: ['inventar', 'acho que'] },
    ]
  },
  {
    name: '6. NOVO PACIENTE — microbiota exterior',
    steps: [
      { user: 'oi' },
      { user: 'primeira consulta' },
      { user: 'online' },
      { user: 'moro fora do brasil, quero o teste genético da microbiota', check_soft: ['apenas', 'somente', 'não', 'infelizmente'], avoid: ['enviar para fora'] },
    ]
  },
  {
    name: '7. CLIENTE INSATISFEITO',
    steps: [
      { user: 'oi' },
      { user: 'já sou paciente, isso é um robô? quero falar com a dra agora', check: ['🔴'], avoid: ['desculpe pelo transtorno'] },
    ]
  },
  {
    name: '8. NOVO PACIENTE — só perguntou preço',
    steps: [
      { user: 'quanto custa a consulta', check: ['sophia', 'já é paciente', 'primeira consulta'] },
      { user: 'primeira vez', check: ['presencial', 'online'] },
      { user: 'online', check: ['me conta', 'o que te traz'] },
    ]
  },
  {
    name: '9. PACIENTE ANTIGO — exame',
    steps: [
      { user: 'oi' },
      { user: 'sou paciente, quero enviar meus exames', check: ['🔴'], check_soft: ['enviar os exames', 'por aqui'] },
    ]
  },
  {
    name: '10. 🔴 POSIÇÃO — verificar se 🔴 está no início',
    steps: [
      { user: 'oi' },
      { user: 'quero agendar agora', check_first_char: '🔴' },
    ]
  },
  {
    name: '11. TERCEIROS — marcar para outra pessoa',
    steps: [
      { user: 'oi' },
      { user: 'quero marcar uma consulta pra minha mãe, ela não tem whatsapp', check: ['mãe', 'ela'], avoid: ['sophia'] },
    ]
  },
  {
    name: '12. MÁ EXPERIÊNCIA — paciente insatisfeito com consulta anterior',
    steps: [
      { user: 'oi' },
      { user: 'já tive consulta com a dra mas não gostei do atendimento', check_soft: ['🔴'], avoid: ['tente novamente', 'dar outra chance'] },
    ]
  },
  {
    name: '13. IMPASSE — não pode presencial nem online',
    steps: [
      { user: 'oi' },
      { user: 'moro em sp, não consigo ir a teresópolis, e online não funciona pra mim' },
    ]
  },
  {
    name: '14. OBJEÇÃO DE PREÇO — pediu desconto',
    steps: [
      { user: 'oi' },
      { user: 'primeira consulta' },
      { user: 'online' },
      { user: 'quero emagrecer' },
      { user: 'sim, quero saber' },
      { user: '400 é muito caro, tem desconto?' },
    ]
  },
  {
    name: '15. CONVÊNIO — aceita plano de saúde?',
    steps: [
      { user: 'oi' },
      { user: 'aceita plano de saúde ou convênio?' },
    ]
  },
  {
    name: '16. URGÊNCIA — paciente em crise',
    steps: [
      { user: 'oi' },
      { user: 'tó com uma crise de dor agora, me ajuda, o que eu faço?' },
    ]
  },
  {
    name: '17. PROFISSIONAL — nutricionista querendo indicar',
    steps: [
      { user: 'oi' },
      { user: 'sou nutricionista, quero indicar pacientes para a dra michelle' },
    ]
  },
  {
    name: '18. TESTE DE HUMANIDADE — "vc é robô?"',
    steps: [
      { user: 'oi' },
      { user: 'você é robô? quanto é 1+1?' },
    ]
  },
  {
    name: '19. PARCELAMENTO — trimestral em 12x',
    steps: [
      { user: 'oi' },
      { user: 'primeira consulta' },
      { user: 'online' },
      { user: 'quero emagrecer' },
      { user: 'sim, quero saber' },
      { user: 'quero o trimestral mas parcelado em 12x' },
    ]
  },
  {
    name: '20. CANAL CRUZADO — já marcou pelo instagram',
    steps: [
      { user: 'oi' },
      { user: 'já marquei uma consulta pelo instagram da dra, podem confirmar?' },
    ]
  },
  {
    name: '21. SÓ O KIT — quer microbiota sem consulta',
    steps: [
      { user: 'oi' },
      { user: 'primeira consulta' },
      { user: 'online' },
      { user: 'quero só o kit de teste da microbiota, sem consulta' },
    ]
  },
  {
    name: '22. OUTRO IDIOMA — inglês',
    steps: [
      { user: 'Hello, I need help. Do you speak English?' },
    ]
  },
  {
    name: '23. DEVOLUÇÃO — pedindo reembolso',
    steps: [
      { user: 'oi' },
      { user: 'paguei o plano mas mudei de ideia, quero devolução do dinheiro' },
    ]
  },
  {
    name: '24. GRAVIDEZ — pode acompanhamento gestante?',
    steps: [
      { user: 'oi' },
      { user: 'primeira consulta' },
      { user: 'presencial' },
      { user: 'tó grávida, dra michelle atende gestantes?' },
    ]
  },
  {
    name: '25. TEXTO GRANDE — desabafo longo',
    steps: [
      { user: 'então dra, há anos eu sofro com problemas digestivos, já fui em vários médicos, fiz endoscopia, colonoscopia, e ninguém descobre o que é. tem dias que eu não consigo sair de casa de tanta dor. já tentei dieta sem glúten, sem lactose, sem nada. minha vida social acabou, não consigo mais sair pra comer com amigos. isso tem me afetado psicologicamente também, já não sei mais o que fazer. será que a dra michelle pode me ajudar?' },
    ]
  },
];

async function simulate(scenario) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🧪 ${scenario.name}`);
  console.log('='.repeat(70));

  const history = [];
  let nome = '';
  let allPass = true;

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    const userName = !nome ? 'Bruno' : nome;

    const messages = [
      { role: 'system', content: buildPrompt(nome || 'Bruno') },
      ...history,
      { role: 'user', content: step.user },
    ];

    let reply;
    try {
      const completion = await groq.chat.completions.create({
        messages,
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        temperature: 0.4,
        max_tokens: 512,
      });
      reply = completion.choices[0]?.message?.content || '(vazio)';
    } catch (err) {
      reply = `(ERRO: ${err.message})`;
    }

    // Update nome from user message if not set
    if (!nome) {
      nome = 'Bruno';
    }

    history.push({ role: 'user', content: step.user });
    history.push({ role: 'assistant', content: reply });

    // Check conditions
    let pass = true;
    const issues = [];

    if (step.check) {
      for (const c of step.check) {
        if (!reply.toLowerCase().includes(c.toLowerCase())) {
          issues.push(`❌ não contém "${c}"`);
          pass = false;
        }
      }
    }

    if (step.check_soft) {
      for (const c of step.check_soft) {
        if (!reply.toLowerCase().includes(c.toLowerCase())) {
          issues.push(`⚠️  soft: "${c}"`);
        }
      }
    }

    if (step.avoid) {
      for (const a of step.avoid) {
        if (reply.toLowerCase().includes(a.toLowerCase())) {
          issues.push(`⚠️  contém "${a}" (evitar)`);
          pass = false;
        }
      }
    }

    if (step.check_first_char) {
      if (!reply.startsWith(step.check_first_char)) {
        issues.push(`❌ não começa com "${step.check_first_char}"`);
        pass = false;
      }
    }

    const icon = pass ? '✅' : '🟡';
    const userPreview = step.user.length > 50 ? step.user.slice(0, 50) + '...' : step.user;
    const replyPreview = reply.length > 100 ? reply.slice(0, 100) + '...' : reply;
    console.log(`\n  ${icon} [${i + 1}] User: ${userPreview}`);
    console.log(`     Sophia: ${replyPreview}`);
    if (!pass) {
      console.log(`     Problemas: ${issues.join(', ')}`);
      allPass = false;
    }
  }

  if (allPass) {
    console.log(`\n  🟢 TODOS OS PASSOS OK`);
  } else {
    console.log(`\n  🔴 TEM PROBLEMAS`);
  }

  return allPass;
}

async function main() {
  console.log('🚀 INICIANDO TESTES AUTOMÁTICOS\n');
  const results = [];

  for (const scenario of SCENARIOS) {
    const pass = await simulate(scenario);
    results.push({ name: scenario.name, pass });
    // Small delay between scenarios to avoid rate limiting
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 RESUMO');
  console.log('='.repeat(70));
  const passed = results.filter(r => r.pass).length;
  for (const r of results) {
    console.log(`  ${r.pass ? '🟢' : '🟡'} ${r.name}`);
  }
  console.log(`\n${passed}/${results.length} cenários passaram`);
}

main().catch(console.error);
