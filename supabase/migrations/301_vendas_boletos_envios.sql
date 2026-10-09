-- 301: Controle de Boletos com etapas de Baixado e Enviado por competência
CREATE TABLE IF NOT EXISTS public.vendas_boletos_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
  cota_id UUID REFERENCES public.cotas_definitivas(id) ON DELETE SET NULL,
  competencia TEXT NOT NULL,
  status_boleto TEXT NOT NULL DEFAULT 'enviado' CHECK (status_boleto IN ('aguardando', 'baixado', 'enviado')),
  baixado_em TIMESTAMPTZ,
  baixado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  baixado_por_nome TEXT,
  enviado_em TIMESTAMPTZ,
  enviado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  enviado_por_nome TEXT,
  canal TEXT NOT NULL DEFAULT 'whatsapp',
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vendas_boletos_envios_empresa_comp_idx
  ON public.vendas_boletos_envios (empresa_id, competencia);

CREATE INDEX IF NOT EXISTS vendas_boletos_envios_venda_idx
  ON public.vendas_boletos_envios (empresa_id, venda_id);

CREATE INDEX IF NOT EXISTS vendas_boletos_envios_cota_idx
  ON public.vendas_boletos_envios (empresa_id, cota_id);

ALTER TABLE public.vendas_boletos_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendas_boletos_envios_tenant_policy"
  ON public.vendas_boletos_envios
  FOR ALL
  USING (empresa_id = ((current_setting('request.jwt.claims', true))::json ->> 'empresa_id')::uuid
         OR can_read_tenant_internal(empresa_id)
         OR auth.role() = 'service_role');
