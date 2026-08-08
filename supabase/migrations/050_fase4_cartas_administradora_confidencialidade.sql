-- ============================================================================
-- Migration 050: Fase 4 — Confidencialidade Multi-tenant de Cartas Contempladas
--
-- NÃO APLICAR sem autorização explícita do proprietário.
--
-- Pré-requisito:
--   - Migration 047/048 aplicadas (tabela administradoras global ativa).
--   - Racon UUID: c5f8ecb4-cb5a-5014-b567-50484719b404.
--
-- Objetivos:
--   1. Adicionar administradora_id (UUID FK) em cartas_contempladas.
--   2. Criar índice relacional idx_cartas_contempladas_administradora_id.
--   3. Realizar backfill seguro vinculando cartas com texto 'RACON'/'Racon' ao UUID da Racon.
--   4. Preservar a coluna administradora (TEXT) como snapshot/display legado.
--   5. Propor a revogação da policy pública global cartas_public_read pós-homologação do runtime.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- 0. Pré-asserts: tabela administradoras e administradora Racon existem
-- --------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'administradoras'
  ) then
    raise exception 'E6 assert: tabela public.administradoras ausente. Aplique 047 antes.';
  end if;

  if not exists (
    select 1
    from public.administradoras
    where id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  ) then
    raise exception 'E6 assert: administradora global Racon (c5f8ecb4-cb5a-5014-b567-50484719b404) não encontrada.';
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 1. Estrutura relacional em cartas_contempladas
-- --------------------------------------------------------------------------
alter table public.cartas_contempladas
  add column if not exists administradora_id uuid references public.administradoras(id) on delete set null;

create index if not exists idx_cartas_contempladas_administradora_id
  on public.cartas_contempladas(administradora_id);

-- --------------------------------------------------------------------------
-- 2. Backfill seguro da administradora Racon
-- --------------------------------------------------------------------------
update public.cartas_contempladas
set administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
where administradora_id is null
  and lower(trim(coalesce(administradora, ''))) = 'racon';

-- --------------------------------------------------------------------------
-- 3. Pós-asserts: integridade do backfill
-- --------------------------------------------------------------------------
do $$
declare
  v_total int;
  v_sem_id int;
begin
  select count(*) into v_total from public.cartas_contempladas;
  select count(*) into v_sem_id from public.cartas_contempladas where administradora_id is null;

  if v_sem_id > 0 then
    raise exception 'E6 backfill assert: existem % cartas com administradora_id NULL. Verifique se há textos desconhecidos.', v_sem_id;
  end if;
end $$;

-- --------------------------------------------------------------------------
-- 4. Comentários de arquitetura
-- --------------------------------------------------------------------------
comment on column public.cartas_contempladas.administradora_id is
  'FK para a administradora global do catálogo. Usado para autorização de visibilidade tenant-scoped via concessões (empresa_administradoras).';

comment on column public.cartas_contempladas.administradora is
  'Snapshot textual / display da administradora para exibição e compatibilidade legada.';

commit;
