-- ============================================================================
-- Migration 049: Fase 4 E6 — fechar leitura pública global de grupos/cotas
--
-- NÃO APLICAR sem autorização explícita do proprietário.
--
-- Pré-requisito de aplicação:
--   Runtime (app) já lê catálogo comercial via service role + tenant Host
--   (lib/grupos/catalogo-autorizado-service.ts). Sem isso, /grupos e APIs quebram.
--
-- Escopo:
--   - Remover policies SELECT abertas a anon/authenticated em:
--       grupos_consorcio (grupos_public_read)
--       grupos_cotas (cotas_public_read)
--       grupos_modalidades_lance (grupos_modalidades_lance_select_public)
--   - Manter escritas/staff existentes (grupos_staff_write, cotas_staff_write, etc.)
--
-- Explicitamente NÃO faz:
--   - backfill / alteração de dados
--   - NOT NULL em administradora_id
--   - alteração de propostas/contratações
--   - filtro por empresa_id nas tabelas (grupos continuam globais da administradora)
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Pré-assert: coluna administradora_id existe (047/048)
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'grupos_consorcio'
      and column_name = 'administradora_id'
  ) then
    raise exception
      'E6 assert: grupos_consorcio.administradora_id ausente. Aplique 047/048 antes.';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Remover leitura pública global (anon + authenticated genérico)
-- --------------------------------------------------------------------------
drop policy if exists grupos_public_read on public.grupos_consorcio;
drop policy if exists cotas_public_read on public.grupos_cotas;
drop policy if exists "grupos_modalidades_lance_select_public" on public.grupos_modalidades_lance;

-- --------------------------------------------------------------------------
-- 2. Comentários de arquitetura
-- --------------------------------------------------------------------------
comment on table public.grupos_consorcio is
  'Grupos comerciais da administradora global. Leitura pública tenant-scoped via app (service role pós Host→empresa→concessão). Sem SELECT anon global.';

comment on table public.grupos_cotas is
  'Opções/cotas herdando autorização do grupo (grupo_id → administradora_id → concessão). Sem SELECT anon global.';

-- Staff continua com policies *_staff_write (ALL) onde is_staff().
-- Service role bypassa RLS para o caminho público autorizado no servidor.

commit;
