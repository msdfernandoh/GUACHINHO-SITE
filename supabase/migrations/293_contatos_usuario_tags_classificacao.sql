-- Hotfix 294: classificação privada de contatos por tags.
alter table public.contatos_usuario
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists contatos_usuario_tags_idx
  on public.contatos_usuario using gin (tags);
