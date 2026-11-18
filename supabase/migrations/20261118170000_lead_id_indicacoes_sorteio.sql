begin;

set local lock_timeout = '5s';

alter table public.eventos_sorteio_indicacoes
  add column if not exists lead_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.eventos_sorteio_indicacoes'::regclass
      and conname = 'eventos_sorteio_indicacoes_lead_id_fkey'
  ) then
    alter table public.eventos_sorteio_indicacoes
      add constraint eventos_sorteio_indicacoes_lead_id_fkey
      foreign key (lead_id) references public.leads (id) on delete set null;
  end if;
end $$;

create index if not exists eventos_sorteio_indicacoes_lead_id_idx
  on public.eventos_sorteio_indicacoes (lead_id)
  where lead_id is not null;

comment on column public.eventos_sorteio_indicacoes.lead_id is
  'Lead do CRM da pessoa indicada no sorteio.';

-- O fluxo antigo gravava esses identificadores no lead mesmo quando a
-- tabela de indicações ainda não tinha a coluna lead_id.
with candidatos as (
  select i.id as indicacao_id, l.id as lead_id,
    count(*) over (partition by i.id) as total_leads,
    count(*) over (partition by l.id) as total_indicacoes
  from public.eventos_sorteio_indicacoes i
  join public.leads l
    on l.evento_id = i.evento_id
   and l.dados_simulacao ->> 'origem' = 'evento_nps_sorteio_indicacao'
   and l.dados_simulacao ->> 'evento_id' = i.evento_id::text
   and l.dados_simulacao ->> 'sorteio_id' = i.sorteio_id::text
   and l.dados_simulacao ->> 'indicador_participante_id' = i.indicador_participante_id::text
   and regexp_replace(l.whatsapp, '[^0-9]', '', 'g') =
       nullif(regexp_replace(i.telefone, '[^0-9]', '', 'g'), '')
  where i.lead_id is null
    and not exists (
      select 1 from public.eventos_sorteio_indicacoes vinculada
      where vinculada.lead_id = l.id
    )
)
update public.eventos_sorteio_indicacoes i
set lead_id = c.lead_id
from candidatos c
where i.id = c.indicacao_id
  and i.lead_id is null
  and c.total_leads = 1
  and c.total_indicacoes = 1;

notify pgrst, 'reload schema';

commit;
