-- Storage privado: a autorização depende do registro de negócio e do vínculo N:N
-- do usuário com a empresa. Caminhos legados são preservados para não mover objetos.
BEGIN;

CREATE OR REPLACE FUNCTION public.storage_can_read_proposta_pdf(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.propostas AS p
    WHERE p.id::text = split_part(p_name, '.', 1)
      AND public.can_read_tenant_internal(p.empresa_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_proposta_pdf(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.propostas AS p
    WHERE p.id::text = split_part(p_name, '.', 1)
      AND public.can_write_tenant_internal(p.empresa_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_read_contratacao_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contratacoes_online AS c
    WHERE c.id::text = split_part(p_name, '/', 1)
      AND public.can_read_tenant_internal(c.empresa_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_contratacao_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contratacoes_online AS c
    WHERE c.id::text = split_part(p_name, '/', 1)
      AND public.can_write_tenant_internal(c.empresa_id)
  )
$$;

DROP POLICY IF EXISTS propostas_pdf_select_staff ON storage.objects;
DROP POLICY IF EXISTS propostas_pdf_insert_service ON storage.objects;
DROP POLICY IF EXISTS propostas_pdf_update_service ON storage.objects;
DROP POLICY IF EXISTS propostas_pdf_delete_master ON storage.objects;

CREATE POLICY propostas_pdf_tenant_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'propostas-pdf' AND public.storage_can_read_proposta_pdf(name));

CREATE POLICY propostas_pdf_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'propostas-pdf' AND public.storage_can_write_proposta_pdf(name));

CREATE POLICY propostas_pdf_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'propostas-pdf' AND public.storage_can_write_proposta_pdf(name))
  WITH CHECK (bucket_id = 'propostas-pdf' AND public.storage_can_write_proposta_pdf(name));

CREATE POLICY propostas_pdf_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'propostas-pdf' AND public.storage_can_write_proposta_pdf(name));

DROP POLICY IF EXISTS contratacoes_docs_select_staff ON storage.objects;
DROP POLICY IF EXISTS contratacoes_docs_insert_service ON storage.objects;
DROP POLICY IF EXISTS contratacoes_docs_update_service ON storage.objects;
DROP POLICY IF EXISTS contratacoes_docs_delete_master ON storage.objects;

CREATE POLICY contratacoes_docs_tenant_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'contratacoes-documentos' AND public.storage_can_read_contratacao_documento(name));

CREATE POLICY contratacoes_docs_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contratacoes-documentos' AND public.storage_can_write_contratacao_documento(name));

CREATE POLICY contratacoes_docs_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'contratacoes-documentos' AND public.storage_can_write_contratacao_documento(name))
  WITH CHECK (bucket_id = 'contratacoes-documentos' AND public.storage_can_write_contratacao_documento(name));

CREATE POLICY contratacoes_docs_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'contratacoes-documentos' AND public.storage_can_write_contratacao_documento(name));

COMMIT;
