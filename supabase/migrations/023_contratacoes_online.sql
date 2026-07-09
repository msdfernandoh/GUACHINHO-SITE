-- Fechamento da proposta online (simulador / grupos)

create sequence if not exists public.contratacao_protocolo_seq start 1;

create table if not exists public.contratacoes_online (
  id uuid primary key default gen_random_uuid(),
  public_token text unique not null,
  protocolo text unique not null,
  origem text not null check (origem in ('simulador', 'grupos')),
  status text not null default 'link_gerado',
  lead_id uuid references public.leads (id) on delete set null,
  gerado_por_usuario_id uuid references public.usuarios (id) on delete set null,
  gerado_por_nome text,
  gerado_por_email text,
  nome text,
  telefone text,
  email text,
  tipo_pessoa text check (tipo_pessoa is null or tipo_pessoa in ('cpf', 'cnpj')),
  cpf text,
  data_nascimento date,
  razao_social text,
  cnpj text,
  responsavel_nome text,
  responsavel_cpf text,
  tipo_bem text,
  credito_selecionado numeric(15, 2),
  parcela_estimada numeric(15, 2),
  prazo integer,
  grupo_id uuid references public.grupos_consorcio (id) on delete set null,
  grupo_nome text,
  administradora text,
  cota_id text,
  dados_simulacao jsonb not null default '{}'::jsonb,
  forma_pagamento text check (forma_pagamento is null or forma_pagamento in ('pix', 'boleto', 'cartao')),
  pagamento_observacao text,
  pix_ativo_na_solicitacao boolean not null default false,
  pix_chave text,
  pix_recebedor text,
  pix_instrucoes text,
  pix_comprovante_url text,
  pix_status text not null default 'nao_enviado',
  confirmado_em timestamptz,
  finalizado_em timestamptz,
  primeiro_acesso_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contratacoes_online_status_idx on public.contratacoes_online (status);
create index if not exists contratacoes_online_created_idx on public.contratacoes_online (created_at desc);
create index if not exists contratacoes_online_public_token_idx on public.contratacoes_online (public_token);
create index if not exists contratacoes_online_lead_idx on public.contratacoes_online (lead_id);

create table if not exists public.contratacoes_documentos (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes_online (id) on delete cascade,
  tipo_documento text not null,
  arquivo_url text not null,
  arquivo_nome text,
  mime_type text,
  tamanho_bytes integer,
  created_at timestamptz not null default now()
);

create index if not exists contratacoes_documentos_contratacao_idx
  on public.contratacoes_documentos (contratacao_id);

alter table public.contratacoes_online enable row level security;
alter table public.contratacoes_documentos enable row level security;

drop policy if exists contratacoes_online_staff on public.contratacoes_online;
create policy contratacoes_online_staff on public.contratacoes_online
  for all to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  );

drop policy if exists contratacoes_documentos_staff on public.contratacoes_documentos;
create policy contratacoes_documentos_staff on public.contratacoes_documentos
  for all to authenticated
  using (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  )
  with check (
    exists (
      select 1 from public.usuarios u
      where u.auth_user_id = auth.uid()
        and u.ativo = true
        and lower(u.perfil) in ('master', 'srd', 'visualizador')
    )
  );

drop trigger if exists contratacoes_online_updated_at on public.contratacoes_online;
create trigger contratacoes_online_updated_at before update on public.contratacoes_online
  for each row execute function public.set_updated_at();

-- Storage bucket (privado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contratacoes-documentos',
  'contratacoes-documentos',
  false,
  5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists contratacoes_docs_select_staff on storage.objects;
create policy contratacoes_docs_select_staff on storage.objects for select to authenticated
using (
  bucket_id = 'contratacoes-documentos'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.ativo = true
  )
);

drop policy if exists contratacoes_docs_insert_service on storage.objects;
create policy contratacoes_docs_insert_service on storage.objects for insert to authenticated
with check (bucket_id = 'contratacoes-documentos');

drop policy if exists contratacoes_docs_update_service on storage.objects;
create policy contratacoes_docs_update_service on storage.objects for update to authenticated
using (bucket_id = 'contratacoes-documentos');

drop policy if exists contratacoes_docs_delete_master on storage.objects;
create policy contratacoes_docs_delete_master on storage.objects for delete to authenticated
using (
  bucket_id = 'contratacoes-documentos'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.perfil = 'master' and u.ativo = true
  )
);
