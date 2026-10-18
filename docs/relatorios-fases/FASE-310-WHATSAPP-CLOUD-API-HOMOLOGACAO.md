# Relatório de Fase — Homologação da Migration 310 (WhatsApp Cloud API Multiempresa)

**Data:** 18 de Outubro de 2026  
**Status:** Aplicação publicada e GET do webhook validado; App Secret e assinatura Meta pendentes
**Supabase Canônico:** `eaeuoynprurmmulzhydt` (Gauchinho-Site)  
**Arquivos de Referência:**
- `supabase/migrations/310_whatsapp_cloud_api_multiempresa.sql`
- `supabase/tests/310_whatsapp_rollback.sql`
- `supabase/maintenance/2026-10-18-aplicar-migration-310.sql`
- `gauchinho-app/src/app/erp/whatsapp/page.tsx`
- `scripts/smoke-whatsapp-http.mjs`

---

## 1. Objetivo da Tarefa
1. Executar validação prévia de integridade (Dry-run com ROLLBACK) da Migration 310.
2. Aplicar a Migration 310 de forma atômica dentro de transação `BEGIN; ... COMMIT;` no banco Supabase canônico de produção (`eaeuoynprurmmulzhydt`).
3. Verificar a criação das 2 novas tabelas (`empresa_whatsapp_conexoes`, `whatsapp_mensagens`), status de RLS (Row Level Security) e policies de isolamento multiempresa (`can_read_tenant_internal` e `can_write_tenant_internal`).
4. Confirmar disponibilidade da extensão `pgcrypto` e da função `gen_random_uuid()`.
5. Habilitar o módulo ERP `"whatsapp"` nas configurações da empresa canônica Gauchinho (`configuracoes->erp_sistema->modulos`), preservando todos os módulos pré-existentes.
6. Executar smoke test autenticado com sessão real sem envio de e-mails, confirmando que `/erp/whatsapp` responde com HTTP 200 OK.

---

## 2. Dry-Run e Validação Prévia
O script `supabase/tests/310_whatsapp_rollback.sql` executou em transação:
- Criação transitória das tabelas `public.empresa_whatsapp_conexoes` e `public.whatsapp_mensagens`.
- Checagem de RLS nas duas tabelas (`rowsecurity = true`).
- Checagem das policies de leitura e escrita.
- Inserção de conexão e mensagem de teste com verificação da constraint de unicidade (`phone_number_id` único).
- `ROLLBACK` executado com sucesso e limpeza completa comprovada.

---

## 3. Aplicação em Produção (Transação Atômica)
Arquivo de manutenção aplicado: `supabase/maintenance/2026-10-18-aplicar-migration-310.sql`.
- Início: `BEGIN;`
- DDL da migration 310 executado sem modificar nenhuma tabela existente.
- Registro canônico na tabela `supabase_migrations.schema_migrations` (`version: '310'`, `name: 'whatsapp_cloud_api_multiempresa'`).
- Atualização atômica de `configuracoes->erp_sistema->modulos` da empresa Gauchinho (`slug = 'gauchinho'`).
- Conclusão: `COMMIT;` com exit code 0.

---

## 4. Evidências de Verificação

### 4.1 Tabelas e RLS
Consulta realizada:
```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('empresa_whatsapp_conexoes', 'whatsapp_mensagens');
```
Resultado:
- `empresa_whatsapp_conexoes`: `rowsecurity = true`
- `whatsapp_mensagens`: `rowsecurity = true`

### 4.2 Políticas de RLS
- `empresa_whatsapp_conexoes_select`: `(can_read_tenant_internal(empresa_id) OR auth.role() = 'service_role')`
- `empresa_whatsapp_conexoes_write`: `(can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role')` com CHECK
- `whatsapp_mensagens_select`: `(can_read_tenant_internal(empresa_id) OR auth.role() = 'service_role')`
- `whatsapp_mensagens_write`: `(can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role')` com CHECK

### 4.3 Extensão pgcrypto e gen_random_uuid()
- `pgcrypto`: versão `1.3` instalada e ativa.
- `gen_random_uuid()`: operacional retornando UUIDs válidos (ex.: `9110204c-6bfb-4ff3-9f73-f980065d9e62`).

### 4.4 Módulos da Empresa Gauchinho
Consulta realizada em `public.empresas` (`slug = 'gauchinho'`):
```json
{
  "erp_sistema": {
    "habilitado": true,
    "modulos": [
      "painel",
      "leads",
      "propostas",
      "contratacoes",
      "vendas",
      "grupos",
      "comissoes",
      "financeiro",
      "relatorios",
      "metas",
      "tarefas",
      "usuarios",
      "whatsapp"
    ]
  },
  "site_publico": {
    "operacional_habilitado": true
  }
}
```
Todos os 12 módulos existentes foram preservados e `"whatsapp"` adicionado com sucesso.

---

## 5. Smoke Test Autenticado HTTP 200
O teste automatizado `scripts/smoke-whatsapp-http.mjs` executou o seguinte fluxo:
1. Geração de magiclink sem envio de e-mail via Supabase Auth Admin.
2. Troca por sessão JWT temporária de administrador (`hugo@msdeducacao.com.br`).
3. Formatação dos cookies canônicos do `@supabase/ssr` (`sb-eaeuoynprurmmulzhydt-auth-token`).
4. Disparo de requisição HTTP GET para `http://localhost:3005/erp/whatsapp` com header `Host: www.gauchinhoconsorcios.com.br`.
5. Encerramento imediato da sessão de teste com `scope: 'local'`, sem efeitos colaterais em outras sessões.

**Resultado do Smoke:**
- **Status HTTP:** `200 OK`
- **Tamanho da Resposta:** 29.705 bytes
- **Marcadores de Interface:** Elementos do módulo WhatsApp e botão "Conectar" renderizados com sucesso.
- **Redirecionamentos / Erros:** Zero redirecionamentos 307, zero erros 404/500.

## 6. Publicação da aplicação — 18/10/2026

- Projeto Vercel confirmado: `guachinho-site`, ID `prj_rcdKOewLz7V2FXEvmn3qHlyMiKMT`, Root Directory `gauchinho-app`.
- `npx tsc --noEmit`: aprovado (exit code 0).
- ESLint dos arquivos WhatsApp e registro do módulo ERP: aprovado (exit code 0).
- O smoke da seção 5 foi executado em localhost; não comprova homologação de produção.
- As variáveis WhatsApp existentes na Vercel foram confirmadas em Production. `WHATSAPP_APP_SECRET` ainda ausente em Production e Preview, aguardando o segredo real do titular em arquivo local ignorado pelo Git.
- Commit desta publicação inclui exclusivamente os arquivos da Fase 310; alterações locais de robôs e migrations de grupos pertencem a outro escopo.
- Commit da aplicação: `558f70db`, enviado para `origin/main` com a mensagem solicitada pelo titular.
- `vercel --prod --yes`: concluído com exit code 0. Deployment `dpl_8VuDJxPfDxtmuAcjwHZo4SvP8qGu`, URL `https://guachinho-site-dls2x1dbx-hugo-8097s-projects.vercel.app`. Build Next.js e TypeScript aprovados.
- GET de produção em `https://www.gauchinhoconsorcios.com.br/api/whatsapp/webhook`, com os parâmetros `hub.mode=subscribe`, token informado pelo titular e `hub.challenge=123`: **HTTP 200**, corpo exato **`123`**.
- GET com verify token inválido: **HTTP 403**.
- GET anônimo em `/erp/whatsapp`: **HTTP 307** para `/login?next=%2Ferp%2Fwhatsapp`, confirmando a proteção de autenticação. Não constitui smoke autenticado de produção nem validação do QR.
- O valor posteriormente salvo em `.env.local` tinha 16 caracteres e foi recusado pela Meta em consulta de autenticação somente leitura: **HTTP 401**, OAuthException **190**, `Invalid OAuth access token signature.` O segredo não foi registrado no relatório nem cadastrado na Vercel.
- Pendências: fornecer o App Secret original válido, cadastrá-lo em Production e Preview, fazer novo deploy para incorporá-lo, executar POST `/1412730744263214/subscriptions` e confirmar `success: true` para os três campos solicitados. A integração ainda não está 100% ativa para homologação do QR.
