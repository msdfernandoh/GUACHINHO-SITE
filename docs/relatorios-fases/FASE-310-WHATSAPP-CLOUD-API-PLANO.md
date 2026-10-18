# Fase 310 — WhatsApp Cloud API multiempresa (coexistência por franquia)

**Status:** Backend + UI do ERP concluídos (typecheck OK). Pendências: aplicar migração 310 e configurar env/webhook/domínio na Meta e Vercel.
**Data:** 18/10/2026

## Objetivo
Permitir que cada franquia (empresa do SaaS) conecte o **próprio número** de
WhatsApp e envie mensagens pela **Cloud API** da Meta, com **coexistência**
(mantém o app WhatsApp Business no celular). Atendimento 1:1 + campanhas por template.

## Arquitetura (decidida com o titular)
- **Um único app da Meta** (`MENSAGENS GAUCHINHO`, App ID `1412730744263214`),
  compartilhado por toda a plataforma — modelo BSP.
- Cada franquia roda o **Embedded Signup** (config_id `1582891326394697`,
  `featureType: whatsapp_business_app_onboarding`) de dentro do **/erp** e conecta
  seu número por coexistência (QR no celular).
- Dados por `empresa_id`, isolados por **RLS** (`can_read/can_write_tenant_internal`).
- Token cifrado em **AES-256-GCM** (reuso de `src/lib/automacoes/robos/cryptoService`).
- Webhook único, roteado por `phone_number_id` → `empresa_id`.

## Entregue nesta etapa (código, sem tocar no banco de produção)
- **Migração:** `supabase/migrations/310_whatsapp_cloud_api_multiempresa.sql`
  - Tabelas `empresa_whatsapp_conexoes` e `whatsapp_mensagens` com RLS por empresa.
- **Lib:** `src/lib/whatsapp/cloud-api/`
  - `config.ts` — versões/ids/segredos (env).
  - `signature.ts` — validação `X-Hub-Signature-256` (HMAC timing-safe).
  - `conexoes.ts` — salvar/obter conexão (token cifrado), resolver empresa por número.
  - `client.ts` — trocar code→token, enviar texto, enviar template, listar templates.
- **Rotas:**
  - `POST /api/erp/whatsapp/conectar` — conclui o Embedded Signup e salva a conexão.
  - `POST /api/erp/whatsapp/enviar` — envia texto/template e grava histórico.
  - `GET/POST /api/whatsapp/webhook` — verificação + recepção (público, por assinatura).
- **Env:** placeholders adicionados em `gauchinho-app/.env.example`.

## Pendente (próxima etapa)
- **UI no /erp:** página "WhatsApp" (botão Conectar via SDK do FB, envio 1:1,
  campanhas por template, histórico) + client component do Embedded Signup.
- **Registro do módulo ERP** em `src/lib/erp/erp-acesso.ts` + item no `ErpSidebar`.
- **Testes** (vitest) e manter `npm run check` verde (lint max-warnings 353).
- **Vínculo lead/cliente ↔ conversa** (opcional, fase seguinte).

## Passos manuais (titular / infra) — NÃO automatizados
1. **Aplicar a migração 310** no Supabase canônico (`eaeuoynprurmmulzhydt`).
2. **App Secret:** copiar em Meta ▸ Configurações ▸ Básico e definir
   `WHATSAPP_APP_SECRET` na Vercel (Production + Preview). Nunca commitar.
3. **WHATSAPP_WEBHOOK_VERIFY_TOKEN:** definir uma string forte (mesmo valor na Vercel
   e no cadastro do webhook da Meta).
4. **Webhook na Meta** (produto WhatsApp ▸ Configuração):
   URL `https://<dominio>/api/whatsapp/webhook`, assinar campos
   `messages`, `smb_message_echoes`, `smb_app_state_sync`.
5. **Domínio autorizado** no Login do Facebook para Empresas (domínio de produção).
6. **Garantir** `ROBO_CREDENTIALS_ENCRYPTION_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`)
   presente para a cifragem dos tokens.

## Referências de identidade
- App ID: `1412730744263214`
- config_id (Embedded Signup): `1582891326394697`
- WABA de teste: `2222172115360506`
