-- ===========================================================================
-- Migration 223: Conta-Corrente dos Sócios — Origem Econômica de Recursos,
--                Estágios de Despesa e Classificação Histórica Auditável
-- Forward-only: Preserva 100% dos dados comerciais, societários e de contas existentes.
-- ===========================================================================

BEGIN;

-- 1. NOVAS COLUNAS EM financeiro_contas_pagar
ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS pagador_operacional text DEFAULT 'EMPRESA',
  ADD COLUMN IF NOT EXISTS origem_recurso_economico text DEFAULT 'CAIXA_LIVRE_EMPRESA',
  ADD COLUMN IF NOT EXISTS socio_origem_recurso_id uuid REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS valor_recurso_proprio numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_recurso_comissao_retida numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estagio_despesa text DEFAULT 'LANCADA';

-- Atualiza estágio das contas existentes com base no status
UPDATE public.financeiro_contas_pagar
SET estagio_despesa = CASE
  WHEN status = 'paga' THEN 'PAGA'
  ELSE 'LANCADA'
END
WHERE estagio_despesa IS NULL OR estagio_despesa = 'LANCADA';

-- Constraints seguras para os novos campos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_cp_estagio_check') THEN
    ALTER TABLE public.financeiro_contas_pagar
      ADD CONSTRAINT financeiro_cp_estagio_check
      CHECK (estagio_despesa IN ('PREVISAO', 'LANCADA', 'PAGA'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_cp_pagador_operacional_check') THEN
    ALTER TABLE public.financeiro_contas_pagar
      ADD CONSTRAINT financeiro_cp_pagador_operacional_check
      CHECK (pagador_operacional IN ('EMPRESA', 'FERNANDO', 'ERONI', 'OUTRO'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'financeiro_cp_origem_recurso_check') THEN
    ALTER TABLE public.financeiro_contas_pagar
      ADD CONSTRAINT financeiro_cp_origem_recurso_check
      CHECK (origem_recurso_economico IN (
        'CAIXA_LIVRE_EMPRESA',
        'DINHEIRO_PROPRIO_FERNANDO',
        'DINHEIRO_PROPRIO_ERONI',
        'COMISSAO_RETIDA_FERNANDO',
        'COMISSAO_RETIDA_ERONI',
        'RESERVA_IMPOSTOS',
        'OUTRA_RESERVA',
        'OUTRO'
      ));
  END IF;
END $$;

-- 2. EXPANDIR TIPOS NO LEDGER DOS SÓCIOS (socio_conta_corrente_movimentos)
ALTER TABLE public.socio_conta_corrente_movimentos
  DROP CONSTRAINT IF EXISTS socio_conta_corrente_movimentos_tipo_movimento_check;

ALTER TABLE public.socio_conta_corrente_movimentos
  ADD CONSTRAINT socio_conta_corrente_movimentos_tipo_movimento_check
  CHECK (tipo_movimento IN (
    'COMISSAO_GARANTIDA',
    'DESPESA_PAGA_PESSOAL',
    'RESPONSABILIDADE_DESPESA',
    'COMPENSACAO_COMISSAO',
    'SAQUE_REPASSE',
    'RESERVA_RETIDA',
    'RESERVA_LIBERADA',
    'AJUSTE',
    'ESTORNO',
    'DINHEIRO_PROPRIO_UTILIZADO',
    'COMISSAO_RETIDA',
    'TRANSFERENCIA_APORTE',
    'RESPONSABILIDADE_DESPESA_PAGA',
    'REPASSE_SAQUE',
    'COMPENSACAO'
  ));

-- 3. TABELA DE CLASSIFICAÇÃO HISTÓRICA AUDITÁVEL (Item 37)
CREATE TABLE IF NOT EXISTS public.financeiro_ajustes_classificacao_historica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_beneficiario_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  socio_operacional_id uuid REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  tipo_classificacao text NOT NULL CHECK (tipo_classificacao IN (
    'COMISSAO_RETIDA_UTILIZADA',
    'DINHEIRO_PROPRIO_RECLASSIFICADO',
    'AJUSTE_COMPENSATORIO',
    'RESERVA_IMPOSTO_APLICADA'
  )),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  descricao text NOT NULL CHECK (length(trim(descricao)) >= 3),
  competencia varchar(7),
  data_ajuste date NOT NULL DEFAULT CURRENT_DATE,
  idempotency_key text NOT NULL UNIQUE,
  aprovado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_ajustes_classificacao_idx
  ON public.financeiro_ajustes_classificacao_historica (empresa_id, socio_beneficiario_id, data_ajuste);

-- 4. RLS MULTI-TENANT PARA A NOVA TABELA
ALTER TABLE public.financeiro_ajustes_classificacao_historica ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_ajustes_classificacao_historica FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.financeiro_ajustes_classificacao_historica TO authenticated;
GRANT ALL ON public.financeiro_ajustes_classificacao_historica TO service_role;

DROP POLICY IF EXISTS financeiro_ajustes_classificacao_tenant_select ON public.financeiro_ajustes_classificacao_historica;
CREATE POLICY financeiro_ajustes_classificacao_tenant_select
  ON public.financeiro_ajustes_classificacao_historica
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_ajustes_classificacao_tenant_write ON public.financeiro_ajustes_classificacao_historica;
CREATE POLICY financeiro_ajustes_classificacao_tenant_write
  ON public.financeiro_ajustes_classificacao_historica
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

COMMIT;
