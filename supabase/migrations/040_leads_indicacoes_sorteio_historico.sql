-- Completa a estrutura de indicação no CRM e vincula as indicações históricas
-- do formulário NPS/sorteio aos respectivos leads.
-- Idempotente: pode ser executada mais de uma vez sem duplicar leads.

-- ---------------------------------------------------------------------------
-- Colunas estruturadas de indicação em Leads
-- ---------------------------------------------------------------------------
alter table public.leads
  add column if not exists parceiro_indicador_nome text,
  add column if not exists parceiro_indicador_empresa text,
  add column if not exists parceiro_indicador_telefone text,
  add column if not exists parentesco_indicacao text,
  add column if not exists indicador_lead_id uuid,
  add column if not exists tipo_credito text,
  add column if not exists valor_credito numeric(15, 2),
  add column if not exists observacao_indicacao text,
  add column if not exists evento_id uuid,
  add column if not exists evento_nome text;

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

-- Vínculo direto entre a indicação do sorteio e o lead criado no CRM.
alter table public.eventos_sorteio_indicacoes
  add column if not exists lead_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'eventos_sorteio_indicacoes_lead_id_fkey'
  ) then
    alter table public.eventos_sorteio_indicacoes
      add constraint eventos_sorteio_indicacoes_lead_id_fkey
      foreign key (lead_id) references public.leads (id) on delete set null;
  end if;
exception
  when duplicate_object then null;
end $$;

create index if not exists leads_parceiro_indicador_nome_idx
  on public.leads (parceiro_indicador_nome);

create index if not exists leads_indicador_lead_id_idx
  on public.leads (indicador_lead_id)
  where indicador_lead_id is not null;

create index if not exists leads_origem_indicacao_idx
  on public.leads (origem)
  where origem = 'indicacao';

create index if not exists eventos_sorteio_indicacoes_lead_id_idx
  on public.eventos_sorteio_indicacoes (lead_id)
  where lead_id is not null;

comment on column public.leads.parceiro_indicador_nome is
  'Nome de quem indicou o lead';
comment on column public.leads.parceiro_indicador_telefone is
  'Telefone/WhatsApp de quem indicou o lead';
comment on column public.leads.parentesco_indicacao is
  'Relação do indicado com quem indicou (amigo, familiar etc.)';
comment on column public.leads.indicador_lead_id is
  'Lead do CRM pertencente à pessoa que fez a indicação';
comment on column public.eventos_sorteio_indicacoes.lead_id is
  'Lead criado no CRM para a pessoa indicada';

-- ---------------------------------------------------------------------------
-- Backfill: cria somente os leads históricos que ainda não existem
-- ---------------------------------------------------------------------------
insert into public.leads (
  nome,
  whatsapp,
  email,
  origem,
  origem_detalhe,
  parceiro_indicador_nome,
  parceiro_indicador_empresa,
  parceiro_indicador_telefone,
  parentesco_indicacao,
  indicador_lead_id,
  tipo_interesse,
  tipo_credito,
  valor_credito,
  valor_estimado,
  valor_simulado,
  produto_interesse,
  evento_id,
  evento_nome,
  observacao_indicacao,
  observacoes,
  dados_simulacao,
  status,
  criado_manual,
  created_at
)
select
  trim(i.nome),
  trim(i.telefone),
  null,
  'indicacao',
  'evento_nps_sorteio',
  nullif(trim(p.nome), ''),
  null,
  nullif(trim(p.telefone), ''),
  i.tipo,
  p.lead_id,
  'outro',
  null,
  null,
  null,
  null,
  null,
  i.evento_id,
  e.nome,
  'Indicação realizada no formulário NPS/sorteio. Relação com quem indicou: '
    || case when i.tipo = 'familiar' then 'Familiar' else 'Amigo' end || '.',
  'Indicação realizada no formulário NPS/sorteio. Relação com quem indicou: '
    || case when i.tipo = 'familiar' then 'Familiar' else 'Amigo' end || '.',
  jsonb_build_object(
    'origem', 'evento_nps_sorteio_indicacao',
    'evento_sorteio_indicacao_id', i.id,
    'sorteio_id', i.sorteio_id,
    'evento_id', i.evento_id,
    'indicador_participante_id', i.indicador_participante_id,
    'indicador_lead_id', p.lead_id,
    'indicador_telefone', p.telefone,
    'parentesco_indicacao', i.tipo,
    'backfill_historico', true
  ),
  coalesce(
    (
      select nullif(trim(cs.valor ->> 'statusInicialPadrao'), '')
      from public.configuracoes_sistema cs
      where cs.chave = 'leads'
      limit 1
    ),
    'Novo'
  ),
  false,
  i.created_at
from public.eventos_sorteio_indicacoes i
join public.eventos_sorteio_participantes p
  on p.id = i.indicador_participante_id
left join public.eventos e
  on e.id = i.evento_id
where not exists (
  select 1
  from public.leads l
  where l.origem = 'indicacao'
    and l.evento_id = i.evento_id
    and (
      l.dados_simulacao ->> 'evento_sorteio_indicacao_id' = i.id::text
      or (
        lower(trim(l.nome)) = lower(trim(i.nome))
        and regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g')
          = regexp_replace(coalesce(i.telefone, ''), '\D', '', 'g')
      )
    )
);

-- Preenche o vínculo direto para registros antigos e novos.
update public.eventos_sorteio_indicacoes i
set lead_id = (
  select l.id
  from public.leads l
  where l.origem = 'indicacao'
    and l.evento_id = i.evento_id
    and (
      l.dados_simulacao ->> 'evento_sorteio_indicacao_id' = i.id::text
      or (
        lower(trim(l.nome)) = lower(trim(i.nome))
        and regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g')
          = regexp_replace(coalesce(i.telefone, ''), '\D', '', 'g')
      )
    )
  order by
    case
      when l.dados_simulacao ->> 'evento_sorteio_indicacao_id' = i.id::text then 0
      else 1
    end,
    l.created_at
  limit 1
)
where i.lead_id is null
  and exists (
    select 1
    from public.leads l
    where l.origem = 'indicacao'
      and l.evento_id = i.evento_id
      and (
        l.dados_simulacao ->> 'evento_sorteio_indicacao_id' = i.id::text
        or (
          lower(trim(l.nome)) = lower(trim(i.nome))
          and regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g')
            = regexp_replace(coalesce(i.telefone, ''), '\D', '', 'g')
        )
      )
  );

notify pgrst, 'reload schema';
