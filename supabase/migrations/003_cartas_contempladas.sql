-- Fase 4 — Cartas contempladas

create table public.cartas_contempladas (
  id uuid primary key default gen_random_uuid(),
  tipo_carta text not null check (tipo_carta in ('imovel', 'automovel')),
  administradora text,
  credito numeric(15, 2),
  entrada numeric(15, 2),
  prazo_quantidade integer,
  valor_parcela numeric(15, 2),
  saldo_devedor numeric(15, 2),
  proxima_parcela_data date,
  taxa_transferencia numeric(15, 2),
  texto_original text,
  status text not null default 'consultar_disponibilidade' check (
    status in (
      'disponivel',
      'consultar_disponibilidade',
      'em_negociacao',
      'reservada',
      'vendida',
      'indisponivel',
      'inativa'
    )
  ),
  ativo boolean not null default true,
  destaque boolean not null default false,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cartas_contempladas_status_idx on public.cartas_contempladas (status);
create index cartas_contempladas_ativo_idx on public.cartas_contempladas (ativo);
create index cartas_contempladas_tipo_idx on public.cartas_contempladas (tipo_carta);
create index cartas_contempladas_administradora_idx on public.cartas_contempladas (administradora);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_carta_contemplada_id_fkey'
  ) then
    alter table public.leads
      add constraint leads_carta_contemplada_id_fkey
      foreign key (carta_contemplada_id)
      references public.cartas_contempladas (id)
      on delete set null;
  end if;
end $$;

alter table public.cartas_contempladas enable row level security;

create policy cartas_public_read on public.cartas_contempladas
  for select to anon, authenticated
  using (
    ativo = true
    and status in ('disponivel', 'consultar_disponibilidade')
  );

create policy cartas_staff_write on public.cartas_contempladas
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());
