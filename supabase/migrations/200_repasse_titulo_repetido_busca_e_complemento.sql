-- 200 — Completa a baixa após troca e resolve título comprovado em outro PDF.

BEGIN;

ALTER TABLE public.erp_repasse_atencao_resolucoes DROP CONSTRAINT IF EXISTS erp_repasse_atencao_resolucoes_decisao_check;
ALTER TABLE public.erp_repasse_atencao_resolucoes ADD CONSTRAINT erp_repasse_atencao_resolucoes_decisao_check
 CHECK(decisao IN('AGUARDAR_PROXIMO','GERAR_CREDITO','AJUSTAR_DIFERENCA','MANTER_COMO_ESTA','TITULO_JA_BAIXADO','CANCELAR_COTA'));

CREATE OR REPLACE FUNCTION public.rpc_completar_baixa_item_repasse(p_empresa_id uuid,p_item_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_item public.erp_repasse_importacao_itens%ROWTYPE;v_imp public.erp_repasse_importacoes%ROWTYPE;v_prev public.comissao_previsoes_franquia%ROWTYPE;
 v_atual numeric:=0;v_complemento numeric:=0;v_saldo_recebimento numeric:=0;v_novo numeric:=0;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':COMPLETAR_BAIXA:'||p_item_id::text,0));
 SELECT * INTO v_item FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
 IF v_item.id IS NULL OR v_item.previsao_franquia_id IS NULL THEN RAISE EXCEPTION 'Linha ainda não possui título vinculado';END IF;
 SELECT * INTO v_imp FROM public.erp_repasse_importacoes WHERE id=v_item.importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
 SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=v_item.previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
 SELECT coalesce(sum(valor_liquidado),0) INTO v_atual FROM public.financeiro_recebimento_itens WHERE recebimento_id=v_imp.recebimento_id AND previsao_franquia_id=v_prev.id;
 SELECT greatest(r.valor_total-coalesce((SELECT sum(i.valor_liquidado) FROM public.financeiro_recebimento_itens i WHERE i.recebimento_id=r.id),0)-coalesce((SELECT sum(c.valor) FROM public.financeiro_recebimento_classificacoes c WHERE c.recebimento_id=r.id),0),0)
  INTO v_saldo_recebimento FROM public.financeiro_recebimentos r WHERE r.id=v_imp.recebimento_id AND r.empresa_id=p_empresa_id FOR UPDATE;
 v_complemento:=least(greatest(v_item.valor_comissao-v_atual,0),greatest(v_prev.valor_previsto-v_prev.valor_liquidado,0),coalesce(v_saldo_recebimento,0));
 IF v_complemento>0 THEN
  INSERT INTO public.financeiro_recebimento_itens(recebimento_id,previsao_franquia_id,valor_liquidado) VALUES(v_imp.recebimento_id,v_prev.id,v_complemento);
  v_novo:=v_prev.valor_liquidado+v_complemento;
  UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_novo,status=CASE WHEN v_novo=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now() WHERE id=v_prev.id;
  UPDATE public.comissao_previsoes_participantes p SET valor_elegivel=round(p.valor_previsto*v_novo/v_prev.valor_previsto,2),status=CASE WHEN round(p.valor_previsto*v_novo/v_prev.valor_previsto,2)=p.valor_previsto THEN 'elegivel' ELSE 'parcialmente_elegivel' END,updated_at=now()
   WHERE p.empresa_id=p_empresa_id AND p.venda_id=v_prev.venda_id AND p.ordem_etapa=v_prev.ordem_etapa AND p.competencia=v_prev.competencia AND p.cota_definitiva_id IS NOT DISTINCT FROM v_prev.cota_definitiva_id AND coalesce(p.valor_pago,0)=0;
 END IF;
 RETURN jsonb_build_object('ok',true,'complemento',v_complemento,'valor_vinculado',v_atual+v_complemento);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_resolver_titulo_repasse_ja_baixado(p_empresa_id uuid,p_previsao_franquia_id uuid,p_importacao_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_prev public.comissao_previsoes_franquia%ROWTYPE;v_imp public.erp_repasse_importacoes%ROWTYPE;v_origem record;v_res public.erp_repasse_atencao_resolucoes%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão';END IF;
 SELECT * INTO v_res FROM public.erp_repasse_atencao_resolucoes WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN RETURN jsonb_build_object('ok',true,'arquivo_origem',v_res.motivo,'valor_comprovado',v_res.valor_sistema);END IF;
 SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id;
 SELECT * INTO v_imp FROM public.erp_repasse_importacoes WHERE id=p_importacao_id AND empresa_id=p_empresa_id;
 SELECT o.arquivo_nome,sum(ri.valor_liquidado) valor INTO v_origem FROM public.erp_repasse_importacao_itens i JOIN public.erp_repasse_importacoes o ON o.id=i.importacao_id
  JOIN public.financeiro_recebimento_itens ri ON ri.recebimento_id=o.recebimento_id AND ri.previsao_franquia_id=i.previsao_franquia_id
  WHERE i.empresa_id=p_empresa_id AND i.previsao_franquia_id=p_previsao_franquia_id AND i.importacao_id<>p_importacao_id
  GROUP BY o.id,o.arquivo_nome HAVING sum(ri.valor_liquidado)>0 ORDER BY max(o.created_at) DESC LIMIT 1;
 IF v_prev.id IS NULL OR v_imp.id IS NULL THEN RAISE EXCEPTION 'Título ou relatório não encontrado';END IF;
 IF v_origem.arquivo_nome IS NULL THEN RAISE EXCEPTION 'Não foi encontrada baixa deste título em outro relatório';END IF;
 INSERT INTO public.erp_repasse_atencao_resolucoes(empresa_id,importacao_id,previsao_franquia_id,tipo,decisao,valor_sistema,valor_relatorio,valor_diferenca,motivo,idempotency_key,resolvido_por_usuario_id)
 VALUES(p_empresa_id,p_importacao_id,p_previsao_franquia_id,'SISTEMA_SEM_RELATORIO','TITULO_JA_BAIXADO',v_origem.valor,NULL,0,v_origem.arquivo_nome,p_idempotency_key,public.current_usuario_id());
 RETURN jsonb_build_object('ok',true,'arquivo_origem',v_origem.arquivo_nome,'valor_comprovado',v_origem.valor);
END $$;

REVOKE ALL ON FUNCTION public.rpc_completar_baixa_item_repasse(uuid,uuid,text) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.rpc_resolver_titulo_repasse_ja_baixado(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_completar_baixa_item_repasse(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_resolver_titulo_repasse_ja_baixado(uuid,uuid,uuid,text) TO authenticated;

COMMIT;
NOTIFY pgrst,'reload schema';
