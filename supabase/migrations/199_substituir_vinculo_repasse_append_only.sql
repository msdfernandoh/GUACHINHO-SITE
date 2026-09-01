-- 199 — Substituição de vínculo por lançamentos compensatórios append-only.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_corrigir_vinculo_item_repasse(
  p_empresa_id uuid,p_item_id uuid,p_nova_previsao_franquia_id uuid,p_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_anterior public.comissao_previsoes_franquia%ROWTYPE;
  v_nova public.comissao_previsoes_franquia%ROWTYPE;
  v_existente public.erp_repasse_vinculo_correcoes%ROWTYPE;
  v_baixa numeric:=0; v_liquidado_anterior numeric; v_liquidado_novo numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para corrigir vínculos de repasse nesta empresa';
  END IF;
  IF length(trim(coalesce(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Chave de idempotência obrigatória'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CORRIGIR_VINCULO:'||p_item_id::text,0));
  SELECT * INTO v_existente FROM public.erp_repasse_vinculo_correcoes
   WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('ok',true,'alterado',true,'idempotente',true,'baixa_transferida',v_existente.valor_baixa_transferido); END IF;

  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha do relatório não encontrada no tenant'; END IF;
  IF v_item.previsao_franquia_id IS NULL THEN
    PERFORM public.rpc_vincular_item_repasse_manual(p_empresa_id,p_item_id,p_nova_previsao_franquia_id);
    RETURN jsonb_build_object('ok',true,'alterado',true,'baixa_transferida',0);
  END IF;
  IF v_item.previsao_franquia_id=p_nova_previsao_franquia_id THEN RETURN jsonb_build_object('ok',true,'alterado',false,'baixa_transferida',0); END IF;

  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes WHERE id=v_item.importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
  SELECT * INTO v_anterior FROM public.comissao_previsoes_franquia WHERE id=v_item.previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
  SELECT * INTO v_nova FROM public.comissao_previsoes_franquia WHERE id=p_nova_previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_anterior.id IS NULL OR v_nova.id IS NULL OR v_nova.administradora_id<>v_importacao.administradora_id THEN RAISE EXCEPTION 'Comissão de destino incompatível com o relatório'; END IF;
  IF EXISTS(SELECT 1 FROM public.erp_repasse_importacao_itens i WHERE i.empresa_id=p_empresa_id AND i.previsao_franquia_id=v_nova.id AND i.id<>v_item.id) THEN RAISE EXCEPTION 'A nova comissão já está vinculada a outra linha'; END IF;
  IF EXISTS(SELECT 1 FROM public.comissao_previsoes_participantes p WHERE p.empresa_id=p_empresa_id AND p.venda_id IN(v_anterior.venda_id,v_nova.venda_id) AND coalesce(p.valor_pago,0)>0) THEN RAISE EXCEPTION 'Uma das comissões já foi paga. Estorne o pagamento antes de corrigir o vínculo'; END IF;

  IF v_importacao.recebimento_id IS NOT NULL THEN
    PERFORM 1 FROM public.financeiro_recebimento_itens WHERE recebimento_id=v_importacao.recebimento_id AND previsao_franquia_id=v_anterior.id FOR UPDATE;
    SELECT coalesce(sum(valor_liquidado),0) INTO v_baixa FROM public.financeiro_recebimento_itens WHERE recebimento_id=v_importacao.recebimento_id AND previsao_franquia_id=v_anterior.id;
  END IF;
  IF v_baixa>0 AND v_nova.valor_liquidado+v_baixa>v_nova.valor_previsto THEN RAISE EXCEPTION 'A baixa de % excede o saldo da nova comissão',v_baixa; END IF;

  IF v_baixa>0 THEN
    -- Reverte a classificação anterior e cria a nova sem alterar lançamentos existentes.
    INSERT INTO public.financeiro_recebimento_itens(recebimento_id,previsao_franquia_id,valor_liquidado)
      VALUES(v_importacao.recebimento_id,v_anterior.id,-v_baixa),(v_importacao.recebimento_id,v_nova.id,v_baixa);
    v_liquidado_anterior:=v_anterior.valor_liquidado-v_baixa;
    v_liquidado_novo:=v_nova.valor_liquidado+v_baixa;
    IF v_liquidado_anterior<0 THEN RAISE EXCEPTION 'Correção produziria liquidação negativa na comissão anterior'; END IF;
    UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_liquidado_anterior,status=CASE WHEN v_liquidado_anterior=0 THEN 'prevista' WHEN v_liquidado_anterior=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now() WHERE id=v_anterior.id;
    UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_liquidado_novo,status=CASE WHEN v_liquidado_novo=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now() WHERE id=v_nova.id;
    UPDATE public.comissao_previsoes_participantes p SET valor_elegivel=round(p.valor_previsto*v_liquidado_anterior/v_anterior.valor_previsto,2),status=CASE WHEN round(p.valor_previsto*v_liquidado_anterior/v_anterior.valor_previsto,2)=p.valor_previsto THEN 'elegivel' WHEN round(p.valor_previsto*v_liquidado_anterior/v_anterior.valor_previsto,2)>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,updated_at=now()
      WHERE p.empresa_id=p_empresa_id AND p.venda_id=v_anterior.venda_id AND p.ordem_etapa=v_anterior.ordem_etapa AND p.competencia=v_anterior.competencia AND p.cota_definitiva_id IS NOT DISTINCT FROM v_anterior.cota_definitiva_id;
    UPDATE public.comissao_previsoes_participantes p SET valor_elegivel=round(p.valor_previsto*v_liquidado_novo/v_nova.valor_previsto,2),status=CASE WHEN round(p.valor_previsto*v_liquidado_novo/v_nova.valor_previsto,2)=p.valor_previsto THEN 'elegivel' WHEN round(p.valor_previsto*v_liquidado_novo/v_nova.valor_previsto,2)>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,updated_at=now()
      WHERE p.empresa_id=p_empresa_id AND p.venda_id=v_nova.venda_id AND p.ordem_etapa=v_nova.ordem_etapa AND p.competencia=v_nova.competencia AND p.cota_definitiva_id IS NOT DISTINCT FROM v_nova.cota_definitiva_id;
  END IF;

  UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=v_nova.id,previsao_sugerida_id=v_nova.id,venda_id=v_nova.venda_id,status_conciliacao='VINCULADO_MANUAL',vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=v_item.id;
  INSERT INTO public.erp_repasse_vinculo_correcoes(empresa_id,item_importacao_id,recebimento_id,previsao_anterior_id,previsao_nova_id,valor_baixa_transferido,idempotency_key,corrigido_por_usuario_id)
    VALUES(p_empresa_id,v_item.id,v_importacao.recebimento_id,v_anterior.id,v_nova.id,v_baixa,trim(p_idempotency_key),public.current_usuario_id());
  RETURN jsonb_build_object('ok',true,'alterado',true,'idempotente',false,'baixa_transferida',v_baixa);
END $$;

REVOKE ALL ON FUNCTION public.rpc_corrigir_vinculo_item_repasse(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_corrigir_vinculo_item_repasse(uuid,uuid,uuid,text) TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';
