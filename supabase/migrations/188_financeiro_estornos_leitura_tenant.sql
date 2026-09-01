-- 188 — Permite que a visão de extrato societário consulte estornos com isolamento tenant.
BEGIN;

ALTER TABLE public.financeiro_estornos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_estornos_read_tenant ON public.financeiro_estornos;
CREATE POLICY financeiro_estornos_read_tenant
  ON public.financeiro_estornos
  FOR SELECT
  TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

GRANT SELECT ON TABLE public.financeiro_estornos TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
