-- Fase 5 — Oportunidades imobiliárias + imóveis

-- ---------------------------------------------------------------------------
-- imobiliarias
-- ---------------------------------------------------------------------------
create table public.imobiliarias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  responsavel text,
  email text,
  whatsapp text,
  telefone text,
  cidade text,
  endereco text,
  site text,
  instagram text,
  logo_url text,
  banner_url text,
  descricao text,
  ativo boolean not null default true,
  exibir_home boolean not null default false,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index imobiliarias_slug_idx on public.imobiliarias (slug);
create index imobiliarias_ativo_idx on public.imobiliarias (ativo);

-- ---------------------------------------------------------------------------
-- imoveis
-- ---------------------------------------------------------------------------
create table public.imoveis (
  id uuid primary key default gen_random_uuid(),
  imobiliaria_id uuid not null references public.imobiliarias (id) on delete cascade,
  titulo text not null,
  slug text not null,
  tipo_imovel text not null,
  cidade text,
  bairro text,
  valor numeric(15, 2),
  exibir_valor_publico boolean not null default false,
  foto_principal_url text,
  descricao_curta text,
  descricao_completa text,
  link_externo text,
  whatsapp text,
  usar_whatsapp_imobiliaria boolean not null default true,
  status text not null default 'ativo'
    check (status in ('ativo', 'reservado', 'vendido', 'inativo')),
  destaque boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (imobiliaria_id, slug)
);

create index imoveis_imobiliaria_idx on public.imoveis (imobiliaria_id);
create index imoveis_status_idx on public.imoveis (status);
create index imoveis_ativo_idx on public.imoveis (ativo);
create index imoveis_cidade_idx on public.imoveis (cidade);

-- FK usuarios → imobiliarias
alter table public.usuarios
  add constraint usuarios_imobiliaria_id_fkey
  foreign key (imobiliaria_id) references public.imobiliarias (id) on delete set null;

-- FK leads → imobiliarias / imoveis (colunas já existem em 001)
alter table public.leads
  add constraint leads_imobiliaria_id_fkey
  foreign key (imobiliaria_id) references public.imobiliarias (id) on delete set null;

alter table public.leads
  add constraint leads_imovel_id_fkey
  foreign key (imovel_id) references public.imoveis (id) on delete set null;

alter table public.eventos_site
  add constraint eventos_imobiliaria_id_fkey
  foreign key (imobiliaria_id) references public.imobiliarias (id) on delete set null;

alter table public.eventos_site
  add constraint eventos_imovel_id_fkey
  foreign key (imovel_id) references public.imoveis (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Helpers RLS imobiliária
-- ---------------------------------------------------------------------------
create or replace function public.current_usuario_imobiliaria_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select u.imobiliaria_id
  from public.usuarios u
  where u.auth_user_id = auth.uid() and u.ativo = true and u.perfil = 'imobiliaria'
  limit 1;
$$;

create or replace function public.is_imobiliaria_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_usuario_imobiliaria_id() is not null;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.imobiliarias enable row level security;
alter table public.imoveis enable row level security;

-- imobiliarias: master all; imobiliária lê/atualiza a própria; staff lê
create policy imobiliarias_select on public.imobiliarias for select to authenticated
  using (
    public.is_master()
    or public.is_staff()
    or id = public.current_usuario_imobiliaria_id()
  );

create policy imobiliarias_insert_master on public.imobiliarias for insert to authenticated
  with check (public.is_master());

create policy imobiliarias_update on public.imobiliarias for update to authenticated
  using (
    public.is_master()
    or id = public.current_usuario_imobiliaria_id()
  )
  with check (
    public.is_master()
    or id = public.current_usuario_imobiliaria_id()
  );

create policy imobiliarias_delete_master on public.imobiliarias for delete to authenticated
  using (public.is_master());

-- imoveis: master all; staff read; imobiliária CRUD próprios
create policy imoveis_select on public.imoveis for select to authenticated
  using (
    public.is_master()
    or public.is_staff()
    or imobiliaria_id = public.current_usuario_imobiliaria_id()
  );

create policy imoveis_insert on public.imoveis for insert to authenticated
  with check (
    public.is_master()
    or imobiliaria_id = public.current_usuario_imobiliaria_id()
  );

create policy imoveis_update on public.imoveis for update to authenticated
  using (
    public.is_master()
    or imobiliaria_id = public.current_usuario_imobiliaria_id()
  )
  with check (
    public.is_master()
    or imobiliaria_id = public.current_usuario_imobiliaria_id()
  );

create policy imoveis_delete on public.imoveis for delete to authenticated
  using (
    public.is_master()
    or imobiliaria_id = public.current_usuario_imobiliaria_id()
  );

-- Leitura pública via service role nas páginas; opcional anon read ativos:
create policy imobiliarias_public_read on public.imobiliarias for select to anon
  using (ativo = true);

create policy imoveis_public_read on public.imoveis for select to anon
  using (ativo = true and status in ('ativo', 'reservado'));

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'imobiliarias',
    'imobiliarias',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  ),
  (
    'imoveis',
    'imoveis',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

create policy imobiliarias_storage_public_read on storage.objects for select to public
  using (bucket_id = 'imobiliarias');

create policy imoveis_storage_public_read on storage.objects for select to public
  using (bucket_id = 'imoveis');

create policy imobiliarias_storage_staff_write on storage.objects for insert to authenticated
  with check (
    bucket_id in ('imobiliarias', 'imoveis')
    and (
      public.is_master()
      or public.is_imobiliaria_user()
    )
  );

create policy imobiliarias_storage_staff_update on storage.objects for update to authenticated
  using (
    bucket_id in ('imobiliarias', 'imoveis')
    and (public.is_master() or public.is_imobiliaria_user())
  );

create policy imobiliarias_storage_staff_delete on storage.objects for delete to authenticated
  using (
    bucket_id in ('imobiliarias', 'imoveis')
    and (public.is_master() or public.is_imobiliaria_user())
  );

-- Config home oportunidades (seed chave)
insert into public.configuracoes_sistema (chave, valor)
values (
  'home_oportunidades_imobiliarias',
  jsonb_build_object(
    'exibir_home', false,
    'quantidade', 6,
    'mostrar_nome_imobiliaria', true,
    'mostrar_valor', true,
    'mostrar_botao_simular', true,
    'mostrar_botao_ver_oportunidades', true
  )
)
on conflict (chave) do nothing;

insert into public.whatsapp_origens (origem, ativo, exibir_botao_apos_lead, nome_atendimento, usar_whatsapp_principal_fallback)
values ('oportunidade_imobiliaria', true, true, 'Oportunidades imobiliárias', true)
on conflict (origem) do nothing;
