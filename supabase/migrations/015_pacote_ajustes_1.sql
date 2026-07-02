-- Pacote ajustes 1 — leads (indicação/especialista) + seguradoras

alter table public.leads
  add column if not exists parceiro_indicador_nome text,
  add column if not exists parceiro_indicador_empresa text,
  add column if not exists tipo_credito text,
  add column if not exists valor_credito numeric(15, 2),
  add column if not exists observacao_indicacao text;

-- ---------------------------------------------------------------------------
-- seguradoras
-- ---------------------------------------------------------------------------
create table if not exists public.seguradoras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique,
  logo_url text,
  imagem_url text,
  cidade text,
  estado text,
  endereco text,
  numero text,
  bairro text,
  complemento text,
  telefone text,
  whatsapp text,
  site_url text,
  descricao text,
  observacoes text,
  ativo boolean not null default true,
  publicado boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists seguradoras_slug_idx on public.seguradoras (slug);
create index if not exists seguradoras_ativo_idx on public.seguradoras (ativo);
create index if not exists seguradoras_publicado_idx on public.seguradoras (publicado);

alter table public.seguradoras enable row level security;

drop policy if exists seguradoras_select on public.seguradoras;
create policy seguradoras_select on public.seguradoras for select to authenticated
  using (public.is_master() or public.is_staff());

drop policy if exists seguradoras_insert_master on public.seguradoras;
create policy seguradoras_insert_master on public.seguradoras for insert to authenticated
  with check (public.is_master());

drop policy if exists seguradoras_update_master on public.seguradoras;
create policy seguradoras_update_master on public.seguradoras for update to authenticated
  using (public.is_master())
  with check (public.is_master());

drop policy if exists seguradoras_delete_master on public.seguradoras;
create policy seguradoras_delete_master on public.seguradoras for delete to authenticated
  using (public.is_master());

drop policy if exists seguradoras_public_read on public.seguradoras;
create policy seguradoras_public_read on public.seguradoras for select to anon
  using (ativo = true and publicado = true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'seguradoras',
  'seguradoras',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists seguradoras_storage_public_read on storage.objects;
create policy seguradoras_storage_public_read on storage.objects for select to public
  using (bucket_id = 'seguradoras');

drop policy if exists seguradoras_storage_staff_write on storage.objects;
create policy seguradoras_storage_staff_write on storage.objects for insert to authenticated
  with check (bucket_id = 'seguradoras' and public.is_master());

drop policy if exists seguradoras_storage_staff_update on storage.objects;
create policy seguradoras_storage_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'seguradoras' and public.is_master());

drop policy if exists seguradoras_storage_staff_delete on storage.objects;
create policy seguradoras_storage_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'seguradoras' and public.is_master());

drop trigger if exists seguradoras_updated_at on public.seguradoras;
create trigger seguradoras_updated_at before update on public.seguradoras
  for each row execute function public.set_updated_at();
