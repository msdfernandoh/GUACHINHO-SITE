-- 301: edição auditada da data de pagamento em contas pagas.
-- Forward-only. O caixa permanece append-only: quando existe saída vinculada,
-- a correção cria uma entrada compensatória e uma nova saída na data informada.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_alterar_conta_pagar(
  p_empresa_id uuid,
  p_conta_id uuid,
  p_descricao text,
  p_fornecedor text,
  p_vencimento date,
  p_valor numeric,
  p_centro_custo_id uuid,
  p_conta_bancaria_id uuid,
  p_observacao text,
  p_pago_pessoalmente boolean,
  p_socio_pagador_usuario_id uuid,
  p_pago_em date
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v public.financeiro_contas_pagar%ROWTYPE;
  v_movimento public.caixa_movimentos%ROWTYPE;
  v_campos jsonb := '[]'::jsonb;
  v_is_master boolean;
  v_valor_final numeric;
  v_pessoal_final boolean;
  v_socio_final uuid;
  v_pago_em_final date;
  v_novo_movimento_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;
  IF NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Você não tem permissão para alterar despesas nesta empresa';
  END IF;

  v_is_master := public.is_financeiro_tenant_master(p_empresa_id);

  SELECT * INTO v
  FROM public.financeiro_contas_pagar
  WHERE id = p_conta_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND OR v.status = 'cancelada' THEN
    RAISE EXCEPTION 'Despesa ativa não encontrada';
  END IF;
  IF length(trim(coalesce(p_descricao, ''))) = 0 THEN
    RAISE EXCEPTION 'A descrição é obrigatória';
  END IF;
  IF p_vencimento IS NULL THEN
    RAISE EXCEPTION 'A data de vencimento é obrigatória';
  END IF;

  v_valor_final := p_valor;
  v_pessoal_final := p_pago_pessoalmente;
  v_socio_final := p_socio_pagador_usuario_id;
  v_pago_em_final := CASE WHEN v.status = 'paga' THEN coalesce(p_pago_em, v.pago_em) ELSE NULL END;

  IF v.status = 'paga' THEN
    IF v_pago_em_final IS NULL THEN
      RAISE EXCEPTION 'A data do pagamento é obrigatória para conta paga';
    END IF;
    IF v_pago_em_final > current_date THEN
      RAISE EXCEPTION 'A data do pagamento não pode estar no futuro';
    END IF;
    IF v_pago_em_final IS DISTINCT FROM v.pago_em AND NOT v_is_master THEN
      RAISE EXCEPTION 'Apenas usuário master pode alterar a data do pagamento';
    END IF;
  END IF;

  IF v.status = 'paga' AND NOT v_is_master THEN
    -- Operadores preservam os fatos financeiros depois da baixa.
    v_valor_final := v.valor;
    v_pessoal_final := v.pago_pessoalmente;
    v_socio_final := v.socio_pagador_usuario_id;
  ELSIF v_valor_final <= 0 THEN
    RAISE EXCEPTION 'O valor deve ser maior que zero';
  END IF;

  IF v_pessoal_final AND v_socio_final IS NULL THEN
    RAISE EXCEPTION 'Informe o sócio pagador';
  END IF;

  IF v.status = 'paga'
    AND v_pago_em_final IS DISTINCT FROM v.pago_em
    AND NOT v.pago_pessoalmente
    AND v.caixa_movimento_id IS NOT NULL
  THEN
    SELECT * INTO v_movimento
    FROM public.caixa_movimentos
    WHERE id = v.caixa_movimento_id
      AND empresa_id = p_empresa_id
      AND origem_tipo = 'conta_pagar'
      AND origem_id = v.id
      AND tipo_movimento = 'saida'
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'A saída de caixa vinculada ao pagamento não foi encontrada';
    END IF;

    INSERT INTO public.caixa_movimentos(
      empresa_id, tipo_movimento, origem_tipo, origem_id,
      data_movimento, competencia, valor, descricao
    ) VALUES (
      p_empresa_id, 'entrada', 'estorno_conta_pagar', v.id,
      v.pago_em, v_movimento.competencia, v_movimento.valor,
      'Correção da data de pagamento: ' || v.descricao
    );

    INSERT INTO public.caixa_movimentos(
      empresa_id, tipo_movimento, origem_tipo, origem_id,
      data_movimento, competencia, valor, descricao
    ) VALUES (
      p_empresa_id, 'saida', 'conta_pagar', v.id,
      v_pago_em_final, to_char(v_pago_em_final, 'YYYY-MM'), v_movimento.valor,
      'Conta paga (data corrigida): ' || trim(p_descricao)
    ) RETURNING id INTO v_novo_movimento_id;
  ELSE
    v_novo_movimento_id := v.caixa_movimento_id;
  END IF;

  SELECT coalesce(jsonb_agg(k ORDER BY k), '[]'::jsonb) INTO v_campos
  FROM jsonb_each(jsonb_build_object(
    'descricao', p_descricao IS DISTINCT FROM v.descricao,
    'fornecedor', p_fornecedor IS DISTINCT FROM v.fornecedor,
    'vencimento', p_vencimento IS DISTINCT FROM v.vencimento,
    'data_pagamento', v_pago_em_final IS DISTINCT FROM v.pago_em,
    'valor', v_valor_final IS DISTINCT FROM v.valor,
    'centro_custo_id', p_centro_custo_id IS DISTINCT FROM v.centro_custo_id,
    'conta_bancaria_id', p_conta_bancaria_id IS DISTINCT FROM v.conta_bancaria_id,
    'observacao', p_observacao IS DISTINCT FROM v.observacao,
    'pagamento_pessoal', v_pessoal_final IS DISTINCT FROM v.pago_pessoalmente,
    'socio_pagador', v_socio_final IS DISTINCT FROM v.socio_pagador_usuario_id
  )) e(k, val)
  WHERE (val)::boolean;

  UPDATE public.financeiro_contas_pagar
  SET descricao = trim(p_descricao),
      fornecedor = nullif(trim(coalesce(p_fornecedor, '')), ''),
      vencimento = p_vencimento,
      competencia = to_char(p_vencimento, 'YYYY-MM'),
      valor = v_valor_final,
      centro_custo_id = p_centro_custo_id,
      conta_bancaria_id = p_conta_bancaria_id,
      observacao = nullif(trim(coalesce(p_observacao, '')), ''),
      pago_pessoalmente = v_pessoal_final,
      socio_pagador_usuario_id = CASE WHEN v_pessoal_final THEN v_socio_final ELSE NULL END,
      pago_em = v_pago_em_final,
      caixa_movimento_id = v_novo_movimento_id,
      updated_at = now()
  WHERE id = v.id;

  INSERT INTO public.financeiro_contas_pagar_logs(
    empresa_id, conta_id, usuario_id, acao, fornecedor, descricao, valor, detalhes
  ) VALUES (
    p_empresa_id,
    v.id,
    public.current_usuario_id(),
    'ALTERACAO',
    nullif(trim(coalesce(p_fornecedor, '')), ''),
    trim(p_descricao),
    v_valor_final,
    jsonb_build_object(
      'campos_alterados', v_campos,
      'status', v.status,
      'pago_em_anterior', v.pago_em,
      'pago_em_novo', v_pago_em_final
    )
  );

  RETURN jsonb_build_object('id', v.id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_alterar_conta_pagar(
  uuid, uuid, text, text, date, numeric, uuid, uuid, text, boolean, uuid, date
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_alterar_conta_pagar(
  uuid, uuid, text, text, date, numeric, uuid, uuid, text, boolean, uuid, date
) TO authenticated;

COMMIT;
