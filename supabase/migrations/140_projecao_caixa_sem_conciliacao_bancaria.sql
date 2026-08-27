-- 140 — Projeção operacional de caixa (somente leitura).
-- Não cria conciliação bancária, importação de extrato ou sincronização externa.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_projetar_caixa(
  p_empresa_id uuid,
  p_inicio date DEFAULT date_trunc('month',current_date)::date,
  p_meses integer DEFAULT 12
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_inicio date; v_fim date; v_saldo numeric(15,2); v_series jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_meses<1 OR p_meses>36 THEN RAISE EXCEPTION 'Período deve ter entre 1 e 36 meses'; END IF;
  v_inicio:=date_trunc('month',coalesce(p_inicio,current_date))::date;
  v_fim:=(v_inicio+(p_meses||' months')::interval)::date;
  SELECT coalesce(sum(CASE WHEN tipo_movimento='entrada' THEN valor ELSE -valor END),0)
  INTO v_saldo FROM public.caixa_movimentos WHERE empresa_id=p_empresa_id;

  WITH meses AS (
    SELECT d::date mes FROM generate_series(v_inicio,v_fim-interval '1 month',interval '1 month') d
  ), entradas AS (
    SELECT to_date(competencia||'-01','YYYY-MM-DD') mes,
      sum(coalesce(valor_liquido,valor_previsto)) valor
    FROM public.comissao_previsoes_franquia
    WHERE empresa_id=p_empresa_id AND status IN ('prevista','elegivel')
      AND to_date(competencia||'-01','YYYY-MM-DD')>=v_inicio
      AND to_date(competencia||'-01','YYYY-MM-DD')<v_fim GROUP BY 1
  ), saidas AS (
    SELECT date_trunc('month',vencimento)::date mes,sum(valor) valor
    FROM public.financeiro_contas_pagar
    WHERE empresa_id=p_empresa_id AND status='aberta' AND NOT pago_pessoalmente
      AND vencimento>=v_inicio AND vencimento<v_fim GROUP BY 1
  ), fluxo AS (
    SELECT m.mes,coalesce(e.valor,0)::numeric entradas,coalesce(s.valor,0)::numeric saidas
    FROM meses m LEFT JOIN entradas e USING(mes) LEFT JOIN saidas s USING(mes)
  ), calculado AS (
    SELECT mes,entradas,saidas,(v_saldo+sum(entradas-saidas) OVER(ORDER BY mes))::numeric saldo_projetado FROM fluxo
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'mes',to_char(mes,'YYYY-MM'),'entradas_previstas',entradas,'saidas_previstas',saidas,
    'resultado_mes',entradas-saidas,'saldo_projetado',saldo_projetado
  ) ORDER BY mes),'[]'::jsonb) INTO v_series FROM calculado;
  RETURN jsonb_build_object('saldo_atual',v_saldo,'inicio',v_inicio,'meses',p_meses,'serie',v_series,
    'escopo','PREVISOES_COMISSOES_E_CONTAS_ABERTAS','inclui_conciliacao_bancaria',false);
END $$;

REVOKE ALL ON FUNCTION public.rpc_projetar_caixa(uuid,date,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_projetar_caixa(uuid,date,integer) TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
