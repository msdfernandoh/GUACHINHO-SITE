-- 128: Hardening de Contas a Pagar
-- - documentos privados e tenant-aware
-- - referências UUID sempre pertencentes à mesma empresa
-- - índices para consultas financeiras por período
-- Forward-only; preserva arquivos e lançamentos existentes.

BEGIN;

UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'text/xml', 'application/xml'
  ]
WHERE id = 'contas-pagar-documentos';

CREATE OR REPLACE FUNCTION public.storage_can_read_conta_pagar_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
    AND public.can_read_tenant_internal(split_part(p_name, '/', 1)::uuid)
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_conta_pagar_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT
    p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
    AND public.has_company_permission(
      split_part(p_name, '/', 1)::uuid,
      'gerenciar_financeiro'
    )
$$;

REVOKE ALL ON FUNCTION public.storage_can_read_conta_pagar_documento(text)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.storage_can_write_conta_pagar_documento(text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.storage_can_read_conta_pagar_documento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_write_conta_pagar_documento(text) TO authenticated;

DROP POLICY IF EXISTS "contas_pagar_documentos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "contas_pagar_documentos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "contas_pagar_documentos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "contas_pagar_documentos_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS contas_pagar_documentos_tenant_read ON storage.objects;
DROP POLICY IF EXISTS contas_pagar_documentos_tenant_insert ON storage.objects;
DROP POLICY IF EXISTS contas_pagar_documentos_tenant_update ON storage.objects;
DROP POLICY IF EXISTS contas_pagar_documentos_tenant_delete ON storage.objects;

CREATE POLICY contas_pagar_documentos_tenant_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'contas-pagar-documentos'
    AND public.storage_can_read_conta_pagar_documento(name)
  );

CREATE POLICY contas_pagar_documentos_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contas-pagar-documentos'
    AND public.storage_can_write_conta_pagar_documento(name)
  );

CREATE POLICY contas_pagar_documentos_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contas-pagar-documentos'
    AND public.storage_can_write_conta_pagar_documento(name)
  )
  WITH CHECK (
    bucket_id = 'contas-pagar-documentos'
    AND public.storage_can_write_conta_pagar_documento(name)
  );

CREATE POLICY contas_pagar_documentos_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'contas-pagar-documentos'
    AND public.storage_can_write_conta_pagar_documento(name)
  );

CREATE OR REPLACE FUNCTION public.validar_referencias_conta_pagar_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.centro_custo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_centros_custo c
    WHERE c.id = NEW.centro_custo_id AND c.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Centro de custo não pertence à empresa da conta';
  END IF;

  IF NEW.conta_bancaria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_contas_bancarias b
    WHERE b.id = NEW.conta_bancaria_id AND b.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Conta bancária não pertence à empresa da conta';
  END IF;

  IF NEW.fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_fornecedores f
    WHERE f.id = NEW.fornecedor_id AND f.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Fornecedor não pertence à empresa da conta';
  END IF;

  IF NEW.pago_pessoalmente AND (
    NEW.socio_pagador_usuario_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.empresa_id = NEW.empresa_id
        AND eu.usuario_id = NEW.socio_pagador_usuario_id
        AND eu.ativo
        AND eu.socio_pagador
    )
  ) THEN
    RAISE EXCEPTION 'Sócio pagador não está habilitado na empresa da conta';
  END IF;

  IF NOT NEW.pago_pessoalmente AND NEW.socio_pagador_usuario_id IS NOT NULL THEN
    RAISE EXCEPTION 'Conta não pessoal não pode manter sócio pagador';
  END IF;

  IF NEW.comprovante_url IS NOT NULL
     AND NEW.comprovante_url !~* '^https?://'
     AND NEW.comprovante_url NOT LIKE NEW.empresa_id::text || '/%' THEN
    RAISE EXCEPTION 'Documento financeiro pertence a outra empresa';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_referencias_conta_pagar_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validar_referencias_conta_pagar_tenant
  ON public.financeiro_contas_pagar;
CREATE TRIGGER trg_validar_referencias_conta_pagar_tenant
BEFORE INSERT OR UPDATE OF
  empresa_id, centro_custo_id, conta_bancaria_id, fornecedor_id,
  pago_pessoalmente, socio_pagador_usuario_id, comprovante_url
ON public.financeiro_contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.validar_referencias_conta_pagar_tenant();

CREATE INDEX IF NOT EXISTS financeiro_contas_pagar_empresa_vencimento_status_idx
  ON public.financeiro_contas_pagar (empresa_id, vencimento, status)
  WHERE status <> 'cancelada';

CREATE INDEX IF NOT EXISTS financeiro_contas_pagar_empresa_pago_em_idx
  ON public.financeiro_contas_pagar (empresa_id, pago_em DESC)
  WHERE status = 'paga';

CREATE INDEX IF NOT EXISTS caixa_movimentos_empresa_data_idx
  ON public.caixa_movimentos (empresa_id, data_movimento DESC);

COMMIT;

NOTIFY pgrst, 'reload schema';
