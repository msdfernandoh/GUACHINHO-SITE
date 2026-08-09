# RELATÓRIO DE PREPARAÇÃO DA MIGRATION 051 (CONTRACT)
## FASE 4 — Catálogo Global de Administradoras | Fechamento RLS da Policy Pública de Cartas Contempladas

> **Status Oficial:**  
> **`MIGRATION 051 CRIADA EXCLUSIVAMENTE LOCALMENTE (AGUARDANDO AUTORIZAÇÃO DE APPLY)`**  
> **`SUÍTE DE SIMULAÇÃO PÓS-051 CRIADA COM 100% PASS`**  
> **`DRY-RUN DA CLI CONFIRMA: WOULD PUSH ONLY 051_FASE4_CONTRACT_CARTAS_PUBLIC_READ.SQL`**  
> **`NENHUM APPLY EM BANCO / NENHUM MERGE EM MAIN / NENHUM DEPLOY DE PRODUÇÃO EXECUTADO`**  
> Data: 09/08/2026  
> Projeto: GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> Branch Feature: `feature/saas-fase-4-cartas-contract-051`  

---

## 1. RECONCILIAÇÃO DE HASH DO FIX UUID-FIRST

* **Commit Real do Fix no Git:** `4b273742f9d80ac964afb7b4999dc79b40828600` (short: `4b27374`).
* **Justificativa da Divergência Documental Anterior:** O hash `4b2737482ea7945d829399eb2e0df40bdbe3c411` reportado anteriormente foi uma incorreção de digitação textual. O objeto real no histórico Git do projeto é `4b273742f9d80ac964afb7b4999dc79b40828600`, que foi mergeado na `main` e deployado em Produção (`dpl_EKhdytj2aQ6iyREbccCUVYmTCZhr`).
* **Origin/Main Atual:** `6cf3612c3b14f88c00bf9aadf72c8f491a61c17e`.

---

## 2. CONTEÚDO E SHA256 DA MIGRATION 051

* **Arquivo Local:** `supabase/migrations/051_fase4_contract_cartas_public_read.sql`
* **SHA-256 Hash Canônico (LF):** `65866C7AB510A6D32F0F500258993108064B2EEA0D3CE08603E6DFDCCC432000`
* **Conteúdo SQL Mínimo:**
  ```sql
  -- Migration 051: Fase 4 — Contract: revoga RLS pública legada de cartas contempladas
  DROP POLICY IF EXISTS cartas_public_read ON public.cartas_contempladas;
  ```

---

## 3. AUDITORIA DE DEPENDÊNCIA E SIMULAÇÃO PÓS-051

* **Leitores Públicos:** Nenhum leitor da aplicação (`/`, `/cartas-contempladas`, `/api/public/cartas/interesse`) depende de consulta anon direta. Todos utilizam o runtime `createAdminClient()` com autorização tenant-scoped centralizada em `catalogo-autorizado-cartas.ts`.
* **Impacto no Anon Direto:** Pós-apply futuro da 051, requisições diretas de clientes anon via PostgREST sem service role retornarão 0 registros (bloqueado por RLS).
* **Escrita Administrativa (`cartas_staff_write`):** Preservada para usuários autenticados com papel `is_staff()`.
* **Suíte de Simulação (`contract-051-simulation.test.ts`):** 5/5 testes aprovados.

---

## 4. RESULTADOS DE TESTES E CLI

* **npm test:** 609/609 testes aprovados em 107 arquivos de teste (0 falhas).
* **npm run build:** Exit code 0 (105/105 páginas compiladas).
* **supabase migration list --linked:** `001-050` local=remote, `051` apenas local.
* **supabase db push --linked --dry-run:** `Would push these migrations: 051_fase4_contract_cartas_public_read.sql`.
* **Sorteios:** **100% INALTERADOS**.

---

## 5. STATUS E RECOMENDAÇÃO TÉCNICA

* A Migration 051 está pronta e isolada na branch `feature/saas-fase-4-cartas-contract-051`.
* **Recomendação:** **PODE APLICAR MIGRATION 051 EM SEGUIDA**.
