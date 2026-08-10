# RUNBOOK DE OPERAÇÕES E RECOVERY SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão:** 1.0.0  
> **Aplica-se a:** Plataforma SaaS Gauchinho Consórcios  
> **Última Atualização:** 10/08/2026

---

## 1. Visão Geral da Arquitetura e Componentes

A plataforma é um ecossistema SaaS Multi-tenant construído sobre:
- **Frontend / Aplicação Web:** Next.js 16 (App Router) hospedado na **Vercel** (`gauchinhoconsorcios.com.br`).
- **Banco de Dados e Autenticação:** Supabase PostgreSQL com **Row Level Security (RLS)** ativo em todas as tabelas (`eaeuoynprurmmulzhydt`).
- **Identidade e Autorização:** Multi-tenant via `empresa_usuarios(empresa_id, usuario_id, papel_id)`.
- **Desvinculação Técnica:** Usuários (`public.usuarios`) $\neq$ Participantes Comerciais (`public.participantes_comerciais`).

---

## 2. Procedimentos de Deploy e Migrations

### 2.1. Fluxo Canônico de Deploy
1. **Branch de Feature/Macrobloco:** Desenvolver em branch isolada (`feature/saas-macrobloco-x`).
2. **Migrations SQL:** Criar migrations numeradas sequencialmente em `supabase/migrations/0XX_...sql`.
3. **Homologação em Banco Remoto:** Aplicar migration no Supabase Staging/Linked via CLI ou Admin Client.
4. **Deploy Preview:** Executar `npx vercel --yes` para gerar Vercel Preview URL.
5. **Suíte de Testes Automatizados:** Executar `npm test` (Exigir 100% PASS).
6. **Build Local:** Executar `npm run build` (Exigir Exit Code 0).
7. **Merge e Deploy Produção:** Após autorização do usuário, fazer merge em `main` e executar `npx vercel --prod --yes`.

### 2.2. Política de Rollback
- **Rollback de Código (Vercel):** Se o deploy de Produção apresentar anomalia, utilizar a CLI da Vercel para promover instantaneamente o deployment anterior (`npx vercel redeploy <PREVIOUS_DEPLOYMENT_ID>`).
- **Rollback de Banco de Dados:** Migrations de banco de dados devem ser estritamente **forward-fix aditivas**. Não aplicar scripts de downgrade destrutivo (`DROP TABLE`) em Produção. Se houver erro de schema, criar migration corretiva incremental (ex: Migration 057).

---

## 3. Estratégia de Backup, PITR e Restauração de Dados

- **Backup Automatizado Supabase:** O Supabase realiza backups diários automatizados e suporte a **Point-in-Time Recovery (PITR)** para o projeto `eaeuoynprurmmulzhydt`.
- **Procedimento de Recuperação de Emergência:**
  1. Identificar o timestamp do incidente.
  2. Solicitar restauração de PITR no painel Supabase para um banco de staging ou timestamp específico.
  3. Auditar a integridade referencial dos registros afetados utilizando o `audit_logs_central` via `correlation_id`.
  4. Executar scripts de reconciliação append-only (nunca mutação destrutiva direta em `vendas` ou `caixa_movimentos`).

---

## 4. Plano de Resposta a Incidentes (Incident Response Runbook)

### 4.1. Vazamento de Dados / Tentativa Cross-tenant (IDOR / RLS Failure)
1. **Contenção Imediata:** Se uma vulnerabilidade RLS for identificada, revogar temporariamente as permissões da API afetada ou ativar flag de inativação do tenant no banco.
2. **Diagnóstico:** Consultar a tabela `audit_logs_central` filtrando por `empresa_id` e `modulo` afetado para determinar quais entidades foram acessadas.
3. **Correção:** Atualizar a política RLS no Supabase via migration corretiva aditiva.
4. **Notificação:** Notificar o gestor da empresa/tenant afetado com relatório de impacto e logs de correlação.

### 4.2. Inconsistência ou Erro Financeiro
1. **Princípio de Imutabilidade:** Nunca apagar ou alterar um registro de `caixa_movimentos` ou `financeiro_recebimentos`.
2. **Correção Operacional:** Registrar um movimento inverso de compensação (`financeiro_compensacoes` / estorno no caixa) com justificativa e `correlation_id`.
3. **Re-apuração:** Executar o recálculo do resumo financeiro e saldo a compensar via `getResumoCaixaEmpresa()`.

### 4.3. Exposição Acidental de Secrets / Chaves de API
1. Rotacionar imediatamente a chave no painel do Supabase / Vercel.
2. Atualizar as variáveis de ambiente na Vercel e reiniciar os deployments.
3. Auditar a base para confirmar que nenhuma transação não autorizada foi executada com a service role key.

---

## 5. Monitoramento e Logs Operacionais
- **Logs de Execução:** Vercel Log Drain (`vercel logs`).
- **Logs de Auditoria de Negócio:** `public.audit_logs_central`.
- **Alertas de Erros HTTP:** Filtros na Vercel por status 5xx, `RLS Violation`, ou `Unauthorized`.
