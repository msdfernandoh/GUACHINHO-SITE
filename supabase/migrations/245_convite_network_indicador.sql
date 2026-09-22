-- 245: Convite público do Network de Negócios atribuído ao indicador.
-- Estrutura aditiva e tenant-aware; nenhum cadastro histórico é alterado.
BEGIN;

CREATE TABLE IF NOT EXISTS public.programa_convites_network (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  indicador_id uuid NOT NULL REFERENCES public.programa_indicadores(id) ON DELETE RESTRICT,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  evento_codigo text NOT NULL,
  nome text NOT NULL,
  telefone text NOT NULL,
  atividade_profissional text NOT NULL,
  interesse_participacao text NOT NULL CHECK (interesse_participacao IN ('CONFIRMADO','MAIS_INFORMACOES')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, evento_codigo, telefone)
);

CREATE INDEX IF NOT EXISTS programa_convites_network_indicador_idx
  ON public.programa_convites_network (empresa_id, indicador_id, created_at DESC);

ALTER TABLE public.programa_convites_network ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS programa_convites_network_select ON public.programa_convites_network;
CREATE POLICY programa_convites_network_select ON public.programa_convites_network
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
DROP POLICY IF EXISTS programa_convites_network_write ON public.programa_convites_network;
CREATE POLICY programa_convites_network_write ON public.programa_convites_network
  FOR ALL TO authenticated USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

REVOKE ALL ON public.programa_convites_network FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.programa_convites_network TO authenticated, service_role;

COMMENT ON TABLE public.programa_convites_network IS
  'Confirmações do Network captadas por link curto do indicador, preservando tenant, lead e atribuição.';

COMMIT;
NOTIFY pgrst, 'reload schema';
