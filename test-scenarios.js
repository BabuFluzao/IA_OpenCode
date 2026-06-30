const Groq = require('groq-sdk');
require('dotenv').config();
const { buildPrompt } = require('./prompt.js');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
