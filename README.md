# WhatsApp Nutri Bot

WhatsApp Cloud API + Groq + Supabase na Vercel.

## Setup

### 1. Meta for Developers
- https://developers.facebook.com → My Apps → Criar app "Business"
- Adicionar produto WhatsApp
- Pegar **WHATSAPP_TOKEN** e **WHATSAPP_PHONE_NUMBER_ID**
- Criar **WEBHOOK_VERIFY_TOKEN** (qualquer string)

### 2. Groq
- https://console.groq.com → API Keys → gerar chave

### 3. Supabase
- Criar projeto → SQL Editor → colar `supabase-schema.sql`
- Anotar **SUPABASE_URL** e **SUPABASE_KEY**

### 4. Vercel
```bash
npm i -g vercel
vercel --prod
```

Adicionar env vars no Vercel (ou `.env.local`).

### 5. Webhook no Meta
- URL: `https://seu-app.vercel.app/api/webhook`
- Token: o mesmo do `WEBHOOK_VERIFY_TOKEN`

## Desenvolvimento local
```bash
npm install
npm run dev
# expor com ngrok: ngrok http 3000
```
