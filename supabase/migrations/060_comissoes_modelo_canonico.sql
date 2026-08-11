-- Motor canônico de comissões e fundação transacional.
-- Forward-only; preserva regras legadas, mas não as homologa para seleção automática.

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Regras: sem percentuais/defaults implícitos e com seleção formal.
-- --------------------------------------------------------------------------
ALTER TABLE public.comissao_regras_franquia
  ALTER COLUMN percentual_total_comissao DROP DEFAULT,
  ALTER COLUMN percentual_total_comissao DROP NOT NULL,
  ALTER COLUMN base_calculo DROP DEFAULT;

ALTER TABLE public.comissao_regras_franquia
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS opcao_cota_id uuid REFERENCES public.grupos_cotas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS plano_condicao text,
  ADD COLUMN IF NOT EXISTS valor_fixo_total numeric(15,2),
  ADD COLUMN IF NOT EXISTS configuracao_homologada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_configuracao text NOT NULL DEFAULT 'LEGADO_NAO_HOMOLOGADO';

ALTER TABLE public.comissao_regras_participantes
  ALTER COLUMN percentual_comissao DROP DEFAULT,
  ALTER COLUMN percentual_comissao DROP NOT NULL,
  ALTER COLUMN base_calculo DROP DEFAULT;

ALTER TABLE public.comissao_regras_participantes
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS vigencia_inicio date,
  ADD COLUMN IF NOT EXISTS vigencia_fim date,
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS opcao_cota_id uuid REFERENCES public.grupos_cotas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS plano_condicao text,
  ADD COLUMN IF NOT EXISTS valor_fixo_total numeric(15,2),
  ADD COLUMN IF NOT EXISTS etapas_cronograma jsonb,
  ADD COLUMN IF NOT EXISTS configuracao_homologada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem_configuracao text NOT NULL DEFAULT 'LEGADO_NAO_HOMOLOGADO';

UPDATE public.comissao_regras_participantes
SET vigencia_inicio = COALESCE(vigencia_inicio, created_at::date),
    etapas_cronograma = COALESCE(
      etapas_cronograma,
      '[{"ordem":1,"mes_relativo":1,"percentual_etapa":100,"nome":"Parcela Única"}]'::jsonb
    )
WHERE vigencia_inicio IS NULL OR etapas_cronograma IS NULL;

ALTER TABLE public.comissao_regras_participantes
  ALTER COLUMN vigencia_inicio SET NOT NULL,
  ALTER COLUMN etapas_cronograma SET NOT NULL;

ALTER TABLE public.comissao_regras_franquia
  DROP CONSTRAINT IF EXISTS comissao_regras_franquia_base_calculo_check;
ALTER TABLE public.comissao_regras_participantes
  DROP CONSTRAINT IF EXISTS comissao_regras_participantes_base_calculo_check;

ALTER TABLE public.comissao_regras_franquia
  ADD CONSTRAINT comissao_regra_franquia_base_check
    CHECK (base_calculo IN ('credito','valor_fixo')),
  ADD CONSTRAINT comissao_regra_franquia_valor_check
    CHECK (
      (base_calculo = 'credito' AND percentual_total_comissao > 0 AND valor_fixo_total IS NULL)
      OR
      (base_calculo = 'valor_fixo' AND valor_fixo_total > 0 AND percentual_total_comissao IS NULL)
    ),
  ADD CONSTRAINT comissao_regra_franquia_vigencia_check
    CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  ADD CONSTRAINT comissao_regra_franquia_versao_check CHECK (versao > 0),
  ADD CONSTRAINT comissao_regra_franquia_cronograma_array_check
    CHECK (jsonb_typeof(etapas_cronograma) = 'array' AND jsonb_array_length(etapas_cronograma) > 0);

ALTER TABLE public.comissao_regras_participantes
  ADD CONSTRAINT comissao_regra_participante_base_check
    CHECK (base_calculo IN ('credito','valor_fixo')),
  ADD CONSTRAINT comissao_regra_participante_valor_check
    CHECK (
      (base_calculo = 'credito' AND percentual_comissao > 0 AND valor_fixo_total IS NULL)
      OR
      (base_calculo = 'valor_fixo' AND valor_fixo_total > 0 AND percentual_comissao IS NULL)
    ),
  ADD CONSTRAINT comissao_regra_participante_vigencia_check
    CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  ADD CONSTRAINT comissao_regra_participante_versao_check CHECK (versao > 0),
  ADD CONSTRAINT comissao_regra_participante_escopo_check
    CHECK (NOT (participante_comercial_id IS NOT NULL AND organizacao_parceira_id IS NOT NULL)),
  ADD CONSTRAINT comissao_regra_participante_cronograma_array_check
    CHECK (jsonb_typeof(etapas_cronograma) = 'array' AND jsonb_array_length(etapas_cronograma) > 0);

COMMENT ON COLUMN public.comissao_regras_franquia.configuracao_homologada IS
  'Somente true permite seleção automática. Regras legadas 4% permanecem false até autorização explícita.';
COMMENT ON COLUMN public.comissao_regras_participantes.configuracao_homologada IS
  'Somente true permite seleção automática. Regras legadas 1,5% permanecem false até autorização explícita.';

CREATE INDEX IF NOT EXISTS comissao_regra_franquia_selecao_idx
  ON public.comissao_regras_franquia
  (empresa_id, ativa, configuracao_homologada, vigencia_inicio, vigencia_fim, modalidade, opcao_cota_id);
CREATE INDEX IF NOT EXISTS comissao_regra_participante_selecao_idx
  ON public.comissao_regras_participantes
  (empresa_id, ativa, configuracao_homologada, vigencia_inicio, vigencia_fim, participante_comercial_id, organizacao_parceira_id);

-- --------------------------------------------------------------------------
-- 2. Previsões: saldos monetários explícitos em numeric.
-- --------------------------------------------------------------------------
ALTER TABLE public.comissao_previsoes_franquia
  ALTER COLUMN percentual_aplicado DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS valor_fixo_aplicado numeric(15,2),
  ADD COLUMN IF NOT EXISTS valor_liquidado numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.comissao_previsoes_participantes
  ALTER COLUMN percentual_aplicado DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS valor_fixo_aplicado numeric(15,2),
  ADD COLUMN IF NOT EXISTS valor_elegivel numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_pago numeric(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.comissao_previsoes_franquia
  DROP CONSTRAINT IF EXISTS comissao_previsoes_franquia_status_check;
ALTER TABLE public.comissao_previsoes_participantes
  DROP CONSTRAINT IF EXISTS comissao_previsoes_participantes_status_check;

ALTER TABLE public.comissao_previsoes_franquia
  ADD CONSTRAINT comissao_previsao_franquia_status_check
    CHECK (status IN ('prevista','parcialmente_liquidada','liquidada','suspensa','cancelada')),
  ADD CONSTRAINT comissao_previsao_franquia_saldos_check
    CHECK (valor_previsto >= 0 AND valor_liquidado >= 0 AND valor_liquidado <= valor_previsto);

ALTER TABLE public.comissao_previsoes_participantes
  ADD CONSTRAINT comissao_previsao_participante_status_check
    CHECK (status IN ('prevista','parcialmente_elegivel','elegivel','parcialmente_paga','paga','suspensa','cancelada')),
  ADD CONSTRAINT comissao_previsao_participante_saldos_check
    CHECK (
      valor_previsto >= 0
      AND valor_elegivel >= 0 AND valor_elegivel <= valor_previsto
      AND valor_pago >= 0 AND valor_pago <= valor_previsto
    );

-- Uma contratação produz exatamente uma venda e uma venda exatamente uma cota.
CREATE UNIQUE INDEX IF NOT EXISTS vendas_empresa_idempotency_uidx
  ON public.vendas (empresa_id, contratacao_id) WHERE contratacao_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cotas_definitivas_venda_uidx
  ON public.cotas_definitivas (venda_id);

-- --------------------------------------------------------------------------
-- 3. Idempotência transversal.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operacoes_idempotentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  operacao text NOT NULL CHECK (operacao IN (
    'CONVERSAO_VENDA','GERACAO_PREVISOES','RECEBIMENTO','PAGAMENTO',
    'COMPENSACAO','CANCELAMENTO_VENDA','ESTORNO_RECEBIMENTO','ESTORNO_PAGAMENTO'
  )),
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  recurso_id uuid,
  resposta jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operacoes_idempotentes_key_nonempty CHECK (length(trim(idempotency_key)) >= 8),
  CONSTRAINT operacoes_idempotentes_uidx UNIQUE (empresa_id, operacao, idempotency_key)
);

ALTER TABLE public.operacoes_idempotentes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.operacoes_idempotentes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.operacoes_idempotentes TO service_role;

-- --------------------------------------------------------------------------
-- 4. Histórico de compensações e estornos, ambos append-only.
-- --------------------------------------------------------------------------
ALTER TABLE public.financeiro_compensacoes
  ADD COLUMN IF NOT EXISTS previsao_participante_id uuid
    REFERENCES public.comissao_previsoes_participantes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_compensacoes_idempotency_uidx
  ON public.financeiro_compensacoes (empresa_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.financeiro_compensacao_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  compensacao_id uuid NOT NULL REFERENCES public.financeiro_compensacoes(id) ON DELETE RESTRICT,
  pagamento_id uuid REFERENCES public.financeiro_pagamentos(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('consumo','reversao_consumo','cancelamento')),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_estornos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('recebimento','pagamento')),
  recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
  pagamento_id uuid REFERENCES public.financeiro_pagamentos(id) ON DELETE RESTRICT,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  motivo text NOT NULL CHECK (length(trim(motivo)) > 0),
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_estorno_origem_check CHECK (
    (tipo = 'recebimento' AND recebimento_id IS NOT NULL AND pagamento_id IS NULL)
    OR
    (tipo = 'pagamento' AND pagamento_id IS NOT NULL AND recebimento_id IS NULL)
  ),
  CONSTRAINT financeiro_estorno_origem_uidx UNIQUE NULLS NOT DISTINCT
    (tipo, recebimento_id, pagamento_id),
  CONSTRAINT financeiro_estorno_idempotency_uidx UNIQUE (empresa_id, idempotency_key)
);

ALTER TABLE public.financeiro_compensacao_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_estornos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.financeiro_compensacao_movimentos, public.financeiro_estornos
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.financeiro_compensacao_movimentos, public.financeiro_estornos
  TO service_role;

CREATE INDEX IF NOT EXISTS financeiro_comp_mov_compensacao_idx
  ON public.financeiro_compensacao_movimentos (compensacao_id, created_at);
CREATE INDEX IF NOT EXISTS financeiro_estornos_empresa_idx
  ON public.financeiro_estornos (empresa_id, created_at);

COMMIT;
