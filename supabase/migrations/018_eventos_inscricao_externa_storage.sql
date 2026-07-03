-- Eventos: inscrição externa + bucket de imagens

alter table public.eventos
  add column if not exists inscricao_tipo text not null default 'interno',
  add column if not exists inscricao_url_externa text;

alter table public.eventos
  drop constraint if exists eventos_inscricao_tipo_check;

alter table public.eventos
  add constraint eventos_inscricao_tipo_check check (inscricao_tipo in ('interno', 'externo'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'eventos',
  'eventos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists eventos_storage_public_read on storage.objects;
create policy eventos_storage_public_read on storage.objects for select to public
  using (bucket_id = 'eventos');

drop policy if exists eventos_storage_master_write on storage.objects;
create policy eventos_storage_master_write on storage.objects for insert to authenticated
  with check (bucket_id = 'eventos' and public.is_master());

drop policy if exists eventos_storage_master_update on storage.objects;
create policy eventos_storage_master_update on storage.objects for update to authenticated
  using (bucket_id = 'eventos' and public.is_master());

drop policy if exists eventos_storage_master_delete on storage.objects;
create policy eventos_storage_master_delete on storage.objects for delete to authenticated
  using (bucket_id = 'eventos' and public.is_master());
