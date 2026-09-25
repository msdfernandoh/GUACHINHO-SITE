-- Fecha as policies legadas is_staff() que concediam acesso a todos os
-- tenants. Registros históricos sem empresa_id continuam visíveis somente
-- a quem possui acesso à empresa original Gauchinho.
BEGIN;

DO $$
DECLARE
  v_gauchinho_id uuid;
  v_condicao_leitura text;
BEGIN
  SELECT id INTO STRICT v_gauchinho_id
  FROM public.empresas
  WHERE slug = 'gauchinho';

  v_condicao_leitura := format(
    'public.is_staff() AND (public.can_read_tenant_internal(empresa_id) OR (empresa_id IS NULL AND public.can_read_tenant_internal(%L::uuid)))',
    v_gauchinho_id
  );

  EXECUTE 'DROP POLICY IF EXISTS leads_staff ON public.leads';
  EXECUTE format(
    'CREATE POLICY leads_staff ON public.leads FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
    v_condicao_leitura, v_condicao_leitura
  );

  EXECUTE 'DROP POLICY IF EXISTS propostas_staff ON public.propostas';
  EXECUTE format(
    'CREATE POLICY propostas_staff ON public.propostas FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',
    v_condicao_leitura, v_condicao_leitura
  );
END $$;

-- O histórico herda o escopo da linha de lead autorizada pela RLS acima.
DROP POLICY IF EXISTS leads_historico_staff ON public.leads_historico;
CREATE POLICY leads_historico_staff ON public.leads_historico
  FOR ALL TO authenticated
  USING (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id
    )
  )
  WITH CHECK (
    public.is_staff() AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id
    )
  );

COMMIT;
