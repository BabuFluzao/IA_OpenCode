# Blueprint: WhatsApp Nutri Bot — Dra. Michelle Lucas

> Reproduzir este projeto do zero com o mínimo de atrito.
> Baseado no bot Sophia (secretária) — agora adaptado para uma IA que personifica a própria Dra. Michelle.

---

## 1. Stack Técnica (provado que funciona)

| Componente | Escolha | Motivo |
|---|---|---|
| **Runtime** | Node.js 20 (LTS) | Leve, compatível com Baileys |
| **WhatsApp** | `@whiskeysockets/baileys` v6.7+ | WebSocket puro, sem Chrome, ~50 MB RAM |
| **LLM** | Groq API (`llama-4-scout-17b-16e-instruct`) | Grátis, 500k tokens/dia, rápido |
| **Banco** | Supabase PostgreSQL (free tier) | Conversas + pacientes + futuras configs |
| **Hospedagem** | Oracle Cloud Free Tier (VM.Standard.E2.1.Micro) | 1 OCPU, 1 GB RAM, 100% free |
| **Process Manager** | PM2 + systemd | Auto-restart em crash e reboot |
| **Swap** | 2 GB em disco | Essencial: VM tem só 1 GB RAM |

### Custos: R$ 0,00/mês (Oracle + Groq free tier + Supabase free)

---

## 2. Setup — Passo a Passo (ordem obrigatória)

### 2.1 Oracle VM
```bash
# Oracle Console: VM.Standard.E2.1.Micro, Ubuntu 24.04, SSD 50 GB
# Anote o IP público e baixe a chave SSH (.key)

# Swap (OBRIGATÓRIO — 1 GB RAM é pouco)
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 2.2 Node.js + PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
sudo npm install -g pm2
```

### 2.3 Supabase
```sql
create table conversas (
  phone text primary key,
  messages jsonb not null default '[]',
  status text default 'bot',
  nome text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table pacientes (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  nome text,
  email text,
  data_nascimento text,
  cpf text,
  objetivo text,
  prontuario_id text,
  created_at timestamptz default now()
);

-- RLS: permitir tudo da service_role (desativar RLS ou configurar policy)
```

### 2.4 Repositório
```bash
git clone <repo> ~/bot
cd ~/bot
npm install
```

### 2.5 .env
```env
SUPABASE_URL=https://<projeto>.supabase.co
SUPABASE_KEY=<service_role_key>
GROQ_API_KEY=gsk_<sua_chave>
```

### 2.6 .gitignore (OBRIGATÓRIO — evita perder sessão)
```gitignore
.env
node_modules/
.wwebjs_auth/
.wwebjs_cache/
qrcode.png
bot.log
bot.err
*.log
.vercel/
auth_info/
```

### 2.7 PM2 + Startup
```bash
pm2 start bot.js --name whatsapp-nutri --update-env
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 2.8 QR Code (primeira conexão)
```bash
pm2 logs whatsapp-nutri
# Ou scp do qrcode.png:
scp -i <chave> ubuntu@<ip>:/home/ubuntu/bot/qrcode.png .
```
Abra `qrcode.png`, escaneie com WhatsApp > Aparelhos conectados.

---

## 3. Arquitetura do Código

### 3.1 Estrutura de arquivos
```
~/bot/
├── bot.js           # Main: Baileys + Groq + debounce + transfer
├── prompt.js         # Módulo compartilhado: buildPrompt(nome)
├── test-scenarios.js # Testes automatizados (25 cenários)
├── package.json
├── .env
├── .gitignore
├── auth_info/        # Sessão WhatsApp (persistente, no .gitignore)
└── supabase-schema.sql
```

### 3.2 Fluxo do bot.js
```
Início
  └─ useMultiFileAuthState() → carrega sessão salva
  └─ fetchLatestBaileysVersion() → pega versão WA atual
  └─ makeWASocket() → conecta WebSocket
  └─ connection.update:
       ├─ QR → salva qrcode.png
       ├─ open → "Conectado!"
       └─ close → process.exit(1) (pm2 reinicia)

Mensagem recebida
  └─ Debounce 10s (acumula múltiplas msgs)
  └─ getConversation() → histórico do Supabase
  └─ shouldTransfer()? → 🔴 transfere
  └─ buildPrompt(nome) → prompt com nome do paciente
  └─ Groq API (retry 3x em 429)
  └─ saveConversation()
  └─ sock.sendMessage()
  └─ Erro? → 🔴 transfere pra humano
```

### 3.3 Padrões importantes
- **Debounce 10s**: acumula mensagens e processa uma única vez
- **Retry 429**: 3 tentativas com backoff (2s, 4s, 6s)
- **Fallback humano**: se Groq falha, transfere com 🔴
- **status='human'**: mensagens ignoradas após transferência
- **🔴 primeiro**: sempre abre a mensagem de transferência

---

## 4. Prompt Engineering (lições aprendidas)

### 4.1 Estrutura vencedora do prompt
```
1. SUA PERSONALIDADE (quem é, tom, valores)
2. COMO VOCÊ FALA (EXEMPLOS REAIS) — pares pergunta-resposta
3. DIRETRIZES DE CONVERSA (máx parágrafos, uma pergunta)
4. FLUXOS (passo a passo numerado)
5. REGRA CRÍTICA 🔴 (posição do emoji)
6. INFORMAÇÕES (dados do consultório)
7. CONSULTAS E VALORES (texto exato a copiar)
8. LIMITES (o que NÃO fazer)
```

### 4.2 O que funciona
- **Exemplos reais > regras abstratas**. Mostrar "Pessoa diz X, você responde Y" funciona melhor que "seja natural"
- **Ordem importa**: fluxos + regras antes das informações (senão a IA prioriza info sobre regras)
- **Uma pergunta por vez**: evitar "você quer presencial ou online? e qual seu objetivo?"
- **Nome do paciente no prompt**: `buildPrompt(nome)` insere o nome no system prompt

### 4.3 O que quebra
- **Invenção de detalhes**: IA inventa frequência de consultas, plataformas, preços
  - Solução: "SEMPRE copie o texto exato abaixo" + "NÃO INVENTE NADA"
- **Tom terapêutico**: IA começa a explicar biologia/fisiologia
  - Solução: "Não explique mecanismos biológicos. Você não é médica."
- **Verborragia**: IA responde em 4+ parágrafos
  - Solução: "Máximo 2 parágrafos após apresentar valores"
- **Esquecer de coletar dados**: IA fica explicando plano infinitamente
  - Solução: "ASSIM QUE MANIFESTAR INTERESSE, colete dados e transfira"

### 4.4 Temperature ideal: 0.4
- 0.7 → alucina detalhes, inventa
- 0.4 → segue regras, ainda natural

---

## 5. Modelo de IA Funcional

### Groq API
```js
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const completion = await groq.chat.completions.create({
  messages: [
    { role: 'system', content: buildPrompt(nome) },
    ...history,
    { role: 'user', content: text },
  ],
  model: 'meta-llama/llama-4-scout-17b-16e-instruct',
  temperature: 0.4,
  max_tokens: 512,
});
```

### Limites gratuitos
- **llama-4-scout-17b**: 500.000 tokens/dia (~400 interações)
- **llama-3.3-70b**: 100.000 tokens/dia (gasta rápido)
- Reset automático (provavelmente meia-noite UTC)
- 429 = rate limit. Tratar com retry + fallback humano

---

## 6. Armadilhas Conhecidas (não repetir)

### 🔴 405 Method Not Allowed (IMPORTANTE)
**Problema**: WhatsApp atualiza protocolo e Baileys antigo para de funcionar.
**Solução**: sempre usar `fetchLatestBaileysVersion()` e passar `version` no `makeWASocket`.
```js
const { version } = await fetchLatestBaileysVersion();
const sock = makeWASocket({ ..., version });
```

### 🔴 auth_info/ perdido
**Problema**: `git clean -fd` remove `auth_info/` → perde sessão WhatsApp.
**Solução**: `auth_info/` no `.gitignore`. `git clean -fd` não remove.

### 🔴 Loop infinito de reconexão
**Problema**: Ao reconectar, `startBot()` é chamada recursivamente → multiplas conexões.
**Solução**: Não reconectar. `process.exit(1)` + pm2 reinicia.

### 🔴 Grro 429 sem fallback
**Problema**: Token diário acaba → bot fica mudo.
**Solução**: Catch transfere pra humano com 🔴.

### 🔴 Prompt inline duplicado
**Problema**: prompt.js ≠ bot.js ≠ test-scenarios.js → editar 3x.
**Solução**: prompt.js compartilhado, require nos outros.

### 🔴 Env no SSH
**Problema**: `$PATH` no PowerShell é interpretado como variável PS.
**Solução**: Usar aspas simples no SSH: `ssh user@host 'echo $PATH'`

---

## 7. Desenvolvimento Workflow

```bash
# Editar localmente (Windows)
code bot.js          # ou prompt.js
node test-scenarios.js # testar 25 cenários

# Subir pra VM
git add -A && git commit -m "mensagem" && git push

# Na VM
ssh -i <chave> ubuntu@<ip>
cd ~/bot && git pull && npm install && pm2 restart whatsapp-nutri
```

### Testes
```bash
npm test  # → node test-scenarios.js (25 cenários via Groq)
```
Cenários testam: fluxo completo, cancelamento, preço direto, microbiota exterior,
cliente insatisfeito, posição 🔴, terceiros, urgência, etc.

---

## 8. Especificações para o Novo Bot (Michelle Coach)

### Diferenças do Sophia
| Aspecto | Sophia (secretária) | Michelle (coach) |
|---|---|---|
| Persona | Secretária virtual | A própria Dra. Michelle |
| Propósito | Agendar, informar, triar | Aconselhar, motivar, educar |
| Tom | Profissional, acolhedor | Pessoal, direto, maternal |
| Respostas | Curtas, objetivas | Mais longas, reflexivas |
| Fluxo | Coletar dados → transferir | Conversar, aconselhar, guiar |
| Limite | Não pode dar conselhos | Pode dar orientações |

### Adaptações necessárias
1. Trocar sistema prompt: Sophia → "você é a Dra. Michelle"
2. Remover fluxo de agendamento/coleta de dados
3. Adicionar seção de "conselhos e orientações" no prompt
4. Aumentar `max_tokens` (respostas mais longas)
5. Opcional: temperatura mais alta (~0.6) para mais criatividade
6. Remover `shouldTransfer()` — não precisa transferir
7. Remover `handleMedia()` — a Dra. pode ver arquivos

### Tabelas Supabase
Reaproveitar `conversas`. `pacientes` pode ser opcional.

---

## 9. Checklist para Nova VM

- [ ] Provisionar Oracle VM (Ubuntu 24.04, 50 GB SSD)
- [ ] Configurar swap 2 GB (/etc/fstab)
- [ ] Instalar Node.js 20 + git + pm2
- [ ] Criar Supabase project + tabelas + service_role key
- [ ] Gerar Groq API key
- [ ] `git clone` + `npm install`
- [ ] Criar `.env` com as 3 chaves
- [ ] Criar `.gitignore` (incluir `auth_info/`)
- [ ] `pm2 start` + escanear QR code
- [ ] `pm2 save` + `pm2 startup`
- [ ] Configurar SSH key no GitHub (deploy key ou personal access)
- [ ] Testar envio de mensagem
