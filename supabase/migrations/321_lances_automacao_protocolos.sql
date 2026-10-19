-- 321: Registro, Protocolos e Histórico de Ofertas de Lance Automatizadas (Robô Newcon Franquia)

-- 1. Enriquecimento da tabela cota_estrategias_lance com metadados de protocolo do Newcon
ALTER TABLE public.cota_estrategias_lance
  ADD COLUMN IF NOT EXISTS protocolo_lance_livre TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_lance_fixo TEXT,
  ADD COLUMN IF NOT EXISTS protocolo_segundo_lance_fixo TEXT,
  ADD COLUMN IF NOT EXISTS assembleia_numero TEXT,
  ADD COLUMN IF NOT EXISTS assembleia_data DATE,
  ADD COLUMN IF NOT EXISTS repetir_seis_assembleias BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS ultimo_lance_ofertado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oferta_origem TEXT DEFAULT 'ROBO_NEWCON';

-- 2. Tabela de ofertas de lance individuais com protocolo e auditoria
CREATE TABLE IF NOT EXISTS public.cota_lances_ofertados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cota_definitiva_id UUID NOT NULL REFERENCES public.cotas_definitivas(id) ON DELETE CASCADE,
  numero_grupo TEXT NOT NULL,
  numero_cota TEXT NOT NULL,
  assembleia_numero TEXT,
  assembleia_data DATE,
  tipo_lance TEXT NOT NULL CHECK (tipo_lance IN ('LIVRE', 'FIXO', 'SEGUNDO_FIXO', 'LIMITADO', 'FIDELIDADE')),
  opcao_reducao TEXT NOT NULL DEFAULT 'REDUZIR_PARCELA',
  percentual_lance NUMERIC(8,4) NOT NULL,
  percentual_embutido NUMERIC(8,4) DEFAULT 0,
  valor_lance NUMERIC(14,2),
  valor_embutido NUMERIC(14,2),
  protocolo TEXT NOT NULL,
  comprovante_storage_path TEXT,
  comprovante_url TEXT,
  repetir_seis_assembleias BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'CONFIRMADO',
  ofertado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cota_lances_ofertados_empresa_cota_idx
  ON public.cota_lances_ofertados (empresa_id, cota_definitiva_id);

CREATE INDEX IF NOT EXISTS cota_lances_ofertados_empresa_grupo_cota_idx
  ON public.cota_lances_ofertados (empresa_id, numero_grupo, numero_cota);

ALTER TABLE public.cota_lances_ofertados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cota_lances_ofertados' AND policyname = 'cota_lances_ofertados_tenant_policy'
  ) THEN
    CREATE POLICY "cota_lances_ofertados_tenant_policy"
      ON public.cota_lances_ofertados
      FOR ALL
      USING (
        empresa_id = ((current_setting('request.jwt.claims', true))::json ->> 'empresa_id')::uuid
        OR can_read_tenant_internal(empresa_id)
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;
