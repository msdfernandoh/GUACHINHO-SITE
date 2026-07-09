-- Alinha leitura do bucket contratacoes-documentos ao mesmo perfil das tabelas (staff comercial)

drop policy if exists contratacoes_docs_select_staff on storage.objects;
create policy contratacoes_docs_select_staff on storage.objects for select to authenticated
using (
  bucket_id = 'contratacoes-documentos'
  and exists (
    select 1 from public.usuarios u
    where u.auth_user_id = auth.uid()
      and u.ativo = true
      and lower(u.perfil) in ('master', 'srd', 'visualizador')
  )
);
