-- Garante bucket parceiros + SVG para logomarcas (idempotente)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'parceiros',
    'parceiros',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists conteudo_storage_public_read on storage.objects;
create policy conteudo_storage_public_read on storage.objects for select to public
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros'));

drop policy if exists conteudo_storage_staff_write on storage.objects;
create policy conteudo_storage_staff_write on storage.objects for insert to authenticated
  with check (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());

drop policy if exists conteudo_storage_staff_update on storage.objects;
create policy conteudo_storage_staff_update on storage.objects for update to authenticated
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());

drop policy if exists conteudo_storage_staff_delete on storage.objects;
create policy conteudo_storage_staff_delete on storage.objects for delete to authenticated
  using (bucket_id in ('conteudo', 'depoimentos', 'parceiros') and public.is_staff());
