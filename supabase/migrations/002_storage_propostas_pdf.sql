-- Bucket para PDFs de propostas (rodar após 001)
-- Dashboard alternativo: Storage → New bucket → propostas-pdf (private)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'propostas-pdf',
  'propostas-pdf',
  false,
  5242880,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  allowed_mime_types = excluded.allowed_mime_types;

-- Upload/delete: service role (API servidor). Leitura: staff autenticado com perfil master/srd/imobiliaria/visualizador via usuarios.

create policy "propostas_pdf_select_staff"
on storage.objects for select to authenticated
using (
  bucket_id = 'propostas-pdf'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.ativo = true
  )
);

create policy "propostas_pdf_insert_service"
on storage.objects for insert to authenticated
with check (bucket_id = 'propostas-pdf');

create policy "propostas_pdf_update_service"
on storage.objects for update to authenticated
using (bucket_id = 'propostas-pdf');

create policy "propostas_pdf_delete_master"
on storage.objects for delete to authenticated
using (
  bucket_id = 'propostas-pdf'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid() and u.perfil = 'master' and u.ativo = true
  )
);
