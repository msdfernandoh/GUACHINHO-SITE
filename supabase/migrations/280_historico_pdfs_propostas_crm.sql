-- =============================================================================
-- Migration 280 — Histórico privado de PDFs de propostas no CRM
-- =============================================================================
-- Mantém os PDFs em Storage privado e registra seus metadados em tabela
-- tenant-aware. O arquivo principal legado (<proposta>.pdf) permanece válido;
-- versões anexadas usam <proposta>/historico/<uuid>.pdf.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.propostas_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  proposta_id uuid NOT NULL,
  categoria text NOT NULL DEFAULT 'pdf_anexado'
    CHECK (categoria IN ('pdf_gerado', 'pdf_anexado')),
  storage_path text NOT NULL CHECK (length(trim(storage_path)) > 0),
  arquivo_nome text NOT NULL CHECK (length(trim(arquivo_nome)) > 0),
  mime_type text NOT NULL DEFAULT 'application/pdf',
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT propostas_arquivos_proposta_empresa_fkey
    FOREIGN KEY (proposta_id, empresa_id)
    REFERENCES public.propostas(id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT propostas_arquivos_storage_path_uidx UNIQUE (storage_path)
);

CREATE INDEX IF NOT EXISTS propostas_arquivos_proposta_created_idx
  ON public.propostas_arquivos(proposta_id, created_at DESC);

ALTER TABLE public.propostas_arquivos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.propostas_arquivos FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.propostas_arquivos TO authenticated, service_role;

DROP POLICY IF EXISTS propostas_arquivos_tenant_select ON public.propostas_arquivos;
CREATE POLICY propostas_arquivos_tenant_select ON public.propostas_arquivos
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS propostas_arquivos_tenant_write ON public.propostas_arquivos;
CREATE POLICY propostas_arquivos_tenant_write ON public.propostas_arquivos
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

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
    WHERE (
      p.id::text = split_part(p_name, '/', 1)
      OR p.id::text = split_part(p_name, '.', 1)
    )
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
    WHERE (
      p.id::text = split_part(p_name, '/', 1)
      OR p.id::text = split_part(p_name, '.', 1)
    )
      AND public.can_write_tenant_internal(p.empresa_id)
  )
$$;

COMMENT ON TABLE public.propostas_arquivos
IS 'Histórico privado de PDFs enviados ou gerados para uma proposta, preservado até o fechamento comercial.';

COMMIT;
NOTIFY pgrst, 'reload schema';
