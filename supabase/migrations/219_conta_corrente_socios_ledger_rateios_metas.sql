-- 219: Módulo Conta-Corrente dos Sócios, Rateios de Despesas, Ledger e Metas de Break-Even.
-- Forward-only: Preserva 100% das tabelas financeiro_contas_pagar, empresa_socios, vendas e comissões existentes.
BEGIN;

-- 1. Ledger Contábil e Extrato dos Sócios (Append-Only)
CREATE TABLE IF NOT EXISTS public.socio_conta_corrente_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  data_movimento date NOT NULL DEFAULT CURRENT_DATE,
  competencia varchar(7) NOT NULL, -- Ex: '2026-09'
  natureza text NOT NULL CHECK (natureza IN ('CREDITO', 'DEBITO')),
  tipo_movimento text NOT NULL CHECK (tipo_movimento IN (
    'COMISSAO_GARANTIDA',
    'DESPESA_PAGA_PESSOAL',
    'RESPONSABILIDADE_DESPESA',
    'COMPENSACAO_COMISSAO',
    'SAQUE_REPASSE',
    'RESERVA_RETIDA',
    'RESERVA_LIBERADA',
    'AJUSTE',
    'ESTORNO'
  )),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  saldo_apos numeric(15,2) NOT NULL DEFAULT 0,
  descricao text NOT NULL CHECK (length(trim(descricao)) >= 3),
  origem_tipo text, -- 'conta_pagar', 'previsao_comissao', 'reserva', 'fechamento', 'manual'
  origem_id uuid,
  comprovante_url text,
  comprovante_nome text,
  observacoes text,
  idempotency_key text NOT NULL,
  estornado boolean NOT NULL DEFAULT false,
  estorno_movimento_id uuid REFERENCES public.socio_conta_corrente_movimentos(id) ON DELETE RESTRICT,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS socio_cc_movimentos_empresa_socio_idx
  ON public.socio_conta_corrente_movimentos (empresa_id, socio_id, competencia, data_movimento);

-- 2. Detalhamento e Regras de Rateio por Despesa
CREATE TABLE IF NOT EXISTS public.financeiro_despesa_rateios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_pagar_id uuid NOT NULL REFERENCES public.financeiro_contas_pagar(id) ON DELETE CASCADE,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  forma_rateio text NOT NULL DEFAULT 'IGUAL_50_50' CHECK (forma_rateio IN (
    'IGUAL_50_50',
    'PERCENTUAL_SOCIETARIO',
    'PERCENTUAL_CUSTOM',
    'VALOR_FIXO',
    'EXCLUSIVO_SOCIO',
    'EMPRESA_INTEGRAL'
  )),
  percentual_atribuido numeric(7,4) NOT NULL DEFAULT 0,
  valor_responsabilidade numeric(15,2) NOT NULL DEFAULT 0,
  valor_pago_socio numeric(15,2) NOT NULL DEFAULT 0,
  saldo_diferenca numeric(15,2) NOT NULL DEFAULT 0, -- Pago - Responsabilidade (+ crédito, - a compensar)
  quem_pagou text NOT NULL DEFAULT 'EMPRESA', -- 'EMPRESA', 'SOCIO_PESSOAL', 'OUTRO'
  pago_por_socio_id uuid REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_pagar_id, socio_id)
);

CREATE INDEX IF NOT EXISTS financeiro_despesa_rateios_conta_idx
  ON public.financeiro_despesa_rateios (empresa_id, conta_pagar_id);
CREATE INDEX IF NOT EXISTS financeiro_despesa_rateios_socio_idx
  ON public.financeiro_despesa_rateios (empresa_id, socio_id);

-- 3. Reservas Retidas para Despesas Futuras (Garantia de Caixa da Empresa)
CREATE TABLE IF NOT EXISTS public.financeiro_reservas_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  competencia varchar(7) NOT NULL, -- Ex: '2026-09'
  categoria text NOT NULL CHECK (categoria IN ('ALUGUEL', 'FOLHA_SALARIOS', 'IMPOSTOS', 'CONTINGENCIA', 'OUTRA')),
  valor_reservado numeric(15,2) NOT NULL CHECK (valor_reservado > 0),
  descricao text NOT NULL,
  status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'LIBERADA', 'UTILIZADA')),
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_reservas_socios_idx
  ON public.financeiro_reservas_socios (empresa_id, socio_id, competencia, status);

-- 4. Previsões Orçamentárias Mensais (Fixas, Variáveis e Extraordinárias)
CREATE TABLE IF NOT EXISTS public.financeiro_previsoes_orcamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  competencia varchar(7) NOT NULL,
  categoria text NOT NULL,
  tipo text NOT NULL DEFAULT 'FIXA' CHECK (tipo IN ('FIXA', 'VARIAVEL', 'EXTRAORDINARIA')),
  valor_sugerido_sistema numeric(15,2) NOT NULL DEFAULT 0,
  valor_previsto_admin numeric(15,2) NOT NULL DEFAULT 0,
  observacoes text,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia, categoria)
);

CREATE INDEX IF NOT EXISTS financeiro_previsoes_orcamento_idx
  ON public.financeiro_previsoes_orcamento (empresa_id, competencia);

-- 5. Compensação Auditada de Comissões por Despesas
CREATE TABLE IF NOT EXISTS public.financeiro_compensacoes_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  previsao_participante_id uuid NOT NULL REFERENCES public.comissao_previsoes_participantes(id) ON DELETE RESTRICT,
  valor_compensado numeric(15,2) NOT NULL CHECK (valor_compensado > 0),
  saldo_devedor_anterior numeric(15,2) NOT NULL,
  saldo_devedor_restante numeric(15,2) NOT NULL,
  motivo text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_compensacoes_comissoes_idx
  ON public.financeiro_compensacoes_comissoes (empresa_id, socio_id, created_at);

-- 6. Metas e Break-Even Comercial por Sócio
CREATE TABLE IF NOT EXISTS public.financeiro_metas_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  competencia varchar(7) NOT NULL,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  meta_vendas_valor numeric(15,2) NOT NULL DEFAULT 0,
  vendas_realizadas_valor numeric(15,2) NOT NULL DEFAULT 0,
  percentual_divisao numeric(7,4) NOT NULL DEFAULT 50,
  comissao_taxa_referencia numeric(7,4) NOT NULL DEFAULT 3.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, competencia, socio_id)
);

CREATE INDEX IF NOT EXISTS financeiro_metas_socios_idx
  ON public.financeiro_metas_socios (empresa_id, competencia);

-- 7. Trigger de Proteção Append-Only no Ledger do Sócio
CREATE OR REPLACE FUNCTION public.bloquear_delete_ledger_socio()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Registros de conta-corrente do sócio são imutáveis; realize um lançamento de estorno ou ajuste compensatório';
END $$;

DROP TRIGGER IF EXISTS trg_socio_cc_bloquear_delete ON public.socio_conta_corrente_movimentos;
CREATE TRIGGER trg_socio_cc_bloquear_delete
BEFORE DELETE ON public.socio_conta_corrente_movimentos
FOR EACH ROW EXECUTE FUNCTION public.bloquear_delete_ledger_socio();

-- 8. Permissões e RLS Multi-tenant
DO $$
DECLARE
  v_tab text;
BEGIN
  FOREACH v_tab IN ARRAY ARRAY[
    'socio_conta_corrente_movimentos',
    'financeiro_despesa_rateios',
    'financeiro_reservas_socios',
    'financeiro_previsoes_orcamento',
    'financeiro_compensacoes_comissoes',
    'financeiro_metas_socios'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v_tab);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO authenticated', v_tab);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', v_tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_tab || '_tenant_select', v_tab);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))', v_tab || '_tenant_select', v_tab);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_tab || '_tenant_write', v_tab);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id))', v_tab || '_tenant_write', v_tab);
  END LOOP;
END $$;

COMMIT;
