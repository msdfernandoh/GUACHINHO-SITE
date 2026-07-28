-- Garante colunas de indicação / CRM usadas pelo app (idempotente).
-- Aplique no Supabase SQL Editor se a lista de leads ou indicações falharem por coluna ausente.

-- ---------------------------------------------------------------------------
-- Indicação (quem indicou + crédito)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists parceiro_indicador_nome text,
  add column if not exists parceiro_indicador_empresa text,
  add column if not exists parceiro_indicador_telefone text,
  add column if not exists tipo_credito text,
  add column if not exists valor_credito numeric(15, 2),
  add column if not exists observacao_indicacao text;

-- Parentesco do indicado (amigo, familiar…) e lead que originou a indicação no admin
alter table public.leads
  add column if not exists parentesco_indicacao text,
  add column if not exists indicador_lead_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_indicador_lead_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_indicador_lead_id_fkey
      foreign key (indicador_lead_id) references public.leads (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

comment on column public.leads.parceiro_indicador_nome is 'Nome de quem indicou (origem indicação)';
comment on column public.leads.parceiro_indicador_empresa is 'Empresa de quem indicou (opcional)';
comment on column public.leads.parceiro_indicador_telefone is 'Telefone/WhatsApp de quem indicou';
comment on column public.leads.observacao_indicacao is 'Observação específica da indicação';
comment on column public.leads.parentesco_indicacao is 'Parentesco/relação do indicado com quem indicou (amigo, familiar…)';
comment on column public.leads.indicador_lead_id is 'Lead do CRM que fez a indicação (cadastro rápido no admin)';

-- ---------------------------------------------------------------------------
-- Evento / CRM (garantia se migrations anteriores não rodaram)
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists evento_id uuid,
  add column if not exists evento_nome text,
  add column if not exists temperatura text,
  add column if not exists proxima_acao text,
  add column if not exists data_proxima_acao timestamptz,
  add column if not exists valor_estimado numeric(15, 2),
  add column if not exists ultima_interacao_at timestamptz,
  add column if not exists observacao_perda text,
  add column if not exists observacao_fechamento text,
  add column if not exists fechado_at timestamptz,
  add column if not exists perdido_at timestamptz,
  add column if not exists fechamento_tipo_parcela text,
  add column if not exists fechamento_percentual_parcela numeric(5, 2),
  add column if not exists valor_parcela_fechamento numeric(15, 2);

-- ---------------------------------------------------------------------------
-- Índices para listagem / filtro de indicações
-- ---------------------------------------------------------------------------
create index if not exists leads_parceiro_indicador_nome_idx
  on public.leads (parceiro_indicador_nome);

create index if not exists leads_origem_indicacao_idx
  on public.leads (origem)
  where origem = 'indicacao';

create index if not exists leads_indicador_lead_id_idx
  on public.leads (indicador_lead_id)
  where indicador_lead_id is not null;

-- ---------------------------------------------------------------------------
-- RLS: leads só staff autenticado (já existe em 001; reafirma)
-- ---------------------------------------------------------------------------
alter table public.leads enable row level security;
