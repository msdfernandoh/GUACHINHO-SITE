-- 129: Séries recorrentes e duplicação transacional de Contas a Pagar
-- Cada ocorrência é um fato independente; documentos não são copiados.

BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_contas_pagar_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('AVULSA', 'RECORRENTE', 'DUPLICACAO')),
  descricao text NOT NULL CHECK (length(trim(descricao)) > 0),
  primeiro_vencimento date NOT NULL,
  intervalo_meses integer NOT NULL DEFAULT 1 CHECK (intervalo_meses BETWEEN 1 AND 120),
  total_ocorrencias integer NOT NULL CHECK (total_ocorrencias BETWEEN 1 AND 120),
  conta_origem_id uuid REFERENCES public.financeiro_contas_pagar(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(trim(idempotency_key)) BETWEEN 8 AND 200),
  criada_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key)
);

ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS serie_recorrencia_id uuid
    REFERENCES public.financeiro_contas_pagar_series(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS recorrencia_indice integer,
  ADD COLUMN IF NOT EXISTS recorrencia_total integer;

ALTER TABLE public.financeiro_contas_pagar_series ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_contas_pagar_series_read ON public.financeiro_contas_pagar_series;
DROP POLICY IF EXISTS financeiro_contas_pagar_series_write ON public.financeiro_contas_pagar_series;
CREATE POLICY financeiro_contas_pagar_series_read
  ON public.financeiro_contas_pagar_series
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY financeiro_contas_pagar_series_write
  ON public.financeiro_contas_pagar_series
  FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'gerenciar_financeiro'))
  WITH CHECK (public.has_company_permission(empresa_id, 'gerenciar_financeiro'));

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_contas_pagar_serie_indice_uidx
  ON public.financeiro_contas_pagar (empresa_id, serie_recorrencia_id, recorrencia_indice)
  WHERE serie_recorrencia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS financeiro_contas_pagar_series_empresa_idx
  ON public.financeiro_contas_pagar_series (empresa_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.rpc_criar_contas_pagar_recorrentes(
  p_empresa_id uuid,
  p_descricao text,
  p_fornecedor text,
  p_fornecedor_id uuid,
  p_centro_custo_id uuid,
  p_conta_bancaria_id uuid,
  p_primeiro_vencimento date,
  p_valor numeric,
  p_repeticoes integer,
  p_observacao text,
  p_pago_pessoalmente boolean,
  p_socio_pagador_usuario_id uuid,
  p_descontado_comissao boolean,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_serie public.financeiro_contas_pagar_series%ROWTYPE;
  v_conta_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_indice integer;
  v_vencimento date;
  v_repeticoes integer := coalesce(p_repeticoes, 1);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  IF length(trim(coalesce(p_descricao, ''))) = 0 OR length(p_descricao) > 500 THEN
    RAISE EXCEPTION 'Descrição inválida';
  END IF;
  IF p_primeiro_vencimento IS NULL OR p_valor IS NULL OR p_valor <= 0
     OR round(p_valor, 2) <> p_valor THEN
    RAISE EXCEPTION 'Vencimento ou valor inválido';
  END IF;
  IF v_repeticoes NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'A repetição deve estar entre 1 e 120 meses';
  END IF;
  IF length(trim(coalesce(p_idempotency_key, ''))) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  SELECT * INTO v_serie
  FROM public.financeiro_contas_pagar_series
  WHERE empresa_id = p_empresa_id AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN
    SELECT coalesce(jsonb_agg(id ORDER BY recorrencia_indice), '[]'::jsonb)
    INTO v_ids
    FROM public.financeiro_contas_pagar
    WHERE empresa_id = p_empresa_id AND serie_recorrencia_id = v_serie.id;
    RETURN jsonb_build_object('serie_id', v_serie.id, 'contas_ids', v_ids, 'reused', true);
  END IF;

  IF p_centro_custo_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_centros_custo
    WHERE id = p_centro_custo_id AND empresa_id = p_empresa_id AND ativo
  ) THEN RAISE EXCEPTION 'Centro de custo inválido para a empresa'; END IF;
  IF p_conta_bancaria_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_contas_bancarias
    WHERE id = p_conta_bancaria_id AND empresa_id = p_empresa_id AND ativo
  ) THEN RAISE EXCEPTION 'Conta bancária inválida para a empresa'; END IF;
  IF p_fornecedor_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.financeiro_fornecedores
    WHERE id = p_fornecedor_id AND empresa_id = p_empresa_id AND ativo
  ) THEN RAISE EXCEPTION 'Fornecedor inválido para a empresa'; END IF;
  IF coalesce(p_pago_pessoalmente, false) AND (
    p_socio_pagador_usuario_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.empresa_usuarios
      WHERE empresa_id = p_empresa_id AND usuario_id = p_socio_pagador_usuario_id
        AND ativo AND socio_pagador
    )
  ) THEN RAISE EXCEPTION 'Sócio pagador inválido para a empresa'; END IF;

  INSERT INTO public.financeiro_contas_pagar_series (
    empresa_id, tipo, descricao, primeiro_vencimento, intervalo_meses,
    total_ocorrencias, idempotency_key, criada_por_usuario_id
  ) VALUES (
    p_empresa_id, CASE WHEN v_repeticoes > 1 THEN 'RECORRENTE' ELSE 'AVULSA' END,
    trim(p_descricao), p_primeiro_vencimento, 1, v_repeticoes,
    trim(p_idempotency_key), public.current_usuario_id()
  ) RETURNING * INTO v_serie;

  FOR v_indice IN 1..v_repeticoes LOOP
    v_vencimento := p_primeiro_vencimento + make_interval(months => v_indice - 1);
    INSERT INTO public.financeiro_contas_pagar (
      empresa_id, descricao, fornecedor, fornecedor_id, centro_custo_id,
      conta_bancaria_id, vencimento, competencia, valor, status, pago_em,
      pago_pessoalmente, socio_pagador_usuario_id, descontado_comissao,
      observacao, serie_recorrencia_id, recorrencia_indice, recorrencia_total
    ) VALUES (
      p_empresa_id, trim(p_descricao), nullif(trim(p_fornecedor), ''), p_fornecedor_id,
      p_centro_custo_id, p_conta_bancaria_id, v_vencimento,
      to_char(v_vencimento, 'YYYY-MM'), p_valor, 'aberta', NULL,
      coalesce(p_pago_pessoalmente, false),
      CASE WHEN coalesce(p_pago_pessoalmente, false) THEN p_socio_pagador_usuario_id ELSE NULL END,
      coalesce(p_descontado_comissao, false), nullif(trim(p_observacao), ''),
      v_serie.id, v_indice, v_repeticoes
    ) RETURNING id INTO v_conta_id;
    v_ids := v_ids || jsonb_build_array(v_conta_id);
  END LOOP;

  RETURN jsonb_build_object('serie_id', v_serie.id, 'contas_ids', v_ids, 'reused', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_duplicar_conta_pagar_meses(
  p_empresa_id uuid,
  p_conta_id uuid,
  p_quantidade_meses integer,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_origem public.financeiro_contas_pagar%ROWTYPE;
  v_serie public.financeiro_contas_pagar_series%ROWTYPE;
  v_conta_id uuid;
  v_ids jsonb := '[]'::jsonb;
  v_indice integer;
  v_vencimento date;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  IF p_quantidade_meses IS NULL OR p_quantidade_meses NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'A duplicação deve estar entre 1 e 120 meses';
  END IF;
  IF length(trim(coalesce(p_idempotency_key, ''))) NOT BETWEEN 8 AND 200 THEN
    RAISE EXCEPTION 'Chave de idempotência inválida';
  END IF;

  SELECT * INTO v_serie FROM public.financeiro_contas_pagar_series
  WHERE empresa_id = p_empresa_id AND idempotency_key = trim(p_idempotency_key);
  IF FOUND THEN
    SELECT coalesce(jsonb_agg(id ORDER BY recorrencia_indice), '[]'::jsonb)
    INTO v_ids FROM public.financeiro_contas_pagar
    WHERE empresa_id = p_empresa_id AND serie_recorrencia_id = v_serie.id;
    RETURN jsonb_build_object('serie_id', v_serie.id, 'contas_ids', v_ids, 'reused', true);
  END IF;

  SELECT * INTO v_origem FROM public.financeiro_contas_pagar
  WHERE id = p_conta_id AND empresa_id = p_empresa_id AND status <> 'cancelada'
  FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta de origem não encontrada na empresa'; END IF;

  INSERT INTO public.financeiro_contas_pagar_series (
    empresa_id, tipo, descricao, primeiro_vencimento, intervalo_meses,
    total_ocorrencias, conta_origem_id, idempotency_key, criada_por_usuario_id
  ) VALUES (
    p_empresa_id, 'DUPLICACAO', v_origem.descricao,
    v_origem.vencimento + make_interval(months => 1), 1, p_quantidade_meses,
    v_origem.id, trim(p_idempotency_key), public.current_usuario_id()
  ) RETURNING * INTO v_serie;

  FOR v_indice IN 1..p_quantidade_meses LOOP
    v_vencimento := v_origem.vencimento + make_interval(months => v_indice);
    INSERT INTO public.financeiro_contas_pagar (
      empresa_id, descricao, fornecedor, fornecedor_id, centro_custo_id,
      conta_bancaria_id, vencimento, competencia, valor, status, pago_em,
      pago_pessoalmente, socio_pagador_usuario_id, descontado_comissao,
      observacao, serie_recorrencia_id, recorrencia_indice, recorrencia_total
    ) VALUES (
      p_empresa_id, v_origem.descricao, v_origem.fornecedor, v_origem.fornecedor_id,
      v_origem.centro_custo_id, v_origem.conta_bancaria_id, v_vencimento,
      to_char(v_vencimento, 'YYYY-MM'), v_origem.valor, 'aberta', NULL,
      v_origem.pago_pessoalmente, v_origem.socio_pagador_usuario_id,
      v_origem.descontado_comissao, v_origem.observacao,
      v_serie.id, v_indice, p_quantidade_meses
    ) RETURNING id INTO v_conta_id;
    v_ids := v_ids || jsonb_build_array(v_conta_id);
  END LOOP;

  RETURN jsonb_build_object('serie_id', v_serie.id, 'contas_ids', v_ids, 'reused', false);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_contas_pagar_recorrentes(
  uuid,text,text,uuid,uuid,uuid,date,numeric,integer,text,boolean,uuid,boolean,text
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_criar_contas_pagar_recorrentes(
  uuid,text,text,uuid,uuid,uuid,date,numeric,integer,text,boolean,uuid,boolean,text
) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_duplicar_conta_pagar_meses(uuid,uuid,integer,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_duplicar_conta_pagar_meses(uuid,uuid,integer,text)
  TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
