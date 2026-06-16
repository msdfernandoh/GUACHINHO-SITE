-- Fase 7.1 — Índices financeiros para calculadoras

create table if not exists public.indices_financeiros (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo text not null,
  valor_mensal numeric(12, 6),
  valor_anual numeric(12, 6),
  valor_acumulado_12m numeric(12, 6),
  fonte text,
  fonte_url text,
  data_referencia date,
  ultima_atualizacao timestamptz,
  ativo boolean not null default true,
  atualizacao_automatica boolean not null default false,
  fallback_manual boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists indices_financeiros_ativo_idx on public.indices_financeiros (ativo, codigo);

alter table public.indices_financeiros enable row level security;

drop policy if exists indices_financeiros_select_public on public.indices_financeiros;
create policy indices_financeiros_select_public on public.indices_financeiros
  for select using (ativo = true);

drop policy if exists indices_financeiros_staff_all on public.indices_financeiros;
create policy indices_financeiros_staff_all on public.indices_financeiros
  for all to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) = 'master'
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) = 'master'
    )
  );

create trigger indices_financeiros_updated_at before update on public.indices_financeiros
  for each row execute function public.set_updated_at();

insert into public.indices_financeiros (codigo, nome, tipo, valor_anual, valor_mensal, valor_acumulado_12m, fonte, ativo, atualizacao_automatica, fallback_manual, observacao)
values
  ('ipca', 'IPCA', 'inflacao', null, null, 4.5, 'BCB SGS 433 (cadastro inicial)', true, true, true, 'Atualize via admin ou botão Atualizar agora'),
  ('igpm', 'IGP-M', 'inflacao', null, null, 3.8, 'Manual / FGV', true, false, true, 'Cadastre manualmente até integração FGV'),
  ('cdi', 'CDI', 'juros', null, 0.85, 10.5, 'BCB SGS 4390', true, true, true, null),
  ('selic', 'Selic meta', 'juros', 10.75, null, null, 'BCB SGS 432', true, true, true, null),
  ('poupanca', 'Poupança', 'renda_fixa', 7.0, 0.58, null, 'Manual', true, false, true, 'Taxa estimada — regra legal simplificada'),
  ('tesouro_selic', 'Tesouro Selic', 'tesouro', 10.2, null, null, 'Manual / Tesouro', true, false, true, 'Estimativa sem impostos'),
  ('tesouro_ipca', 'Tesouro IPCA+', 'tesouro', 6.5, null, null, 'Manual / Tesouro', true, false, true, 'Taxa real + IPCA — estimativa'),
  ('taxa_manual', 'Taxa manual', 'manual', null, null, null, 'Usuário', true, false, true, null)
on conflict (codigo) do nothing;
