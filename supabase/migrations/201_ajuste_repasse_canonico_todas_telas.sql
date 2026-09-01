-- 201 — Ajuste de repasse torna o valor do relatório a verdade canônica efetiva.

BEGIN;

CREATE OR REPLACE FUNCTION public.aplicar_ajuste_repasse_canonico_201(p_resolucao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_r public.erp_repasse_atencao_resolucoes%ROWTYPE;v_f public.comissao_previsoes_franquia%ROWTYPE;v_p record;
 v_novo_f numeric;v_razao numeric;v_novo_p numeric;v_novo_eleg numeric;v_bruto numeric;v_imposto numeric;v_aliquota numeric;v_snapshot jsonb;
BEGIN
 SELECT * INTO v_r FROM public.erp_repasse_atencao_resolucoes WHERE id=p_resolucao_id FOR SHARE;
 IF v_r.id IS NULL OR v_r.decisao<>'AJUSTAR_DIFERENCA' OR v_r.valor_relatorio IS NULL THEN RETURN;END IF;
 SELECT * INTO v_f FROM public.comissao_previsoes_franquia WHERE id=v_r.previsao_franquia_id AND empresa_id=v_r.empresa_id FOR UPDATE;
 IF v_f.id IS NULL OR (v_f.snapshot_regra->'ajuste_repasse_canonico'->>'resolucao_id')=v_r.id::text THEN RETURN;END IF;
 v_novo_f:=round(v_r.valor_relatorio,2);
 IF v_novo_f<v_f.valor_liquidado THEN RAISE EXCEPTION 'O valor ajustado não pode ser menor que o valor já recebido';END IF;
 v_razao:=CASE WHEN v_f.valor_previsto>0 THEN v_novo_f/v_f.valor_previsto ELSE 0 END;

 FOR v_p IN SELECT * FROM public.comissao_previsoes_participantes WHERE empresa_id=v_r.empresa_id AND previsao_franquia_id=v_f.id ORDER BY id FOR UPDATE LOOP
  v_novo_p:=round(v_p.valor_previsto*v_razao,2);
  v_novo_eleg:=CASE WHEN v_novo_f>0 THEN least(v_novo_p,round(v_novo_p*v_f.valor_liquidado/v_novo_f,2)) ELSE 0 END;
  IF v_p.valor_pago>v_novo_p THEN RAISE EXCEPTION 'A comissão do participante já paga excede o novo valor ajustado; estorne o pagamento antes';END IF;
  v_aliquota:=CASE WHEN coalesce(v_p.snapshot_regra->'fiscal_lote'->>'imposto_aliquota','')~'^[0-9]+([.][0-9]+)?$' THEN (v_p.snapshot_regra->'fiscal_lote'->>'imposto_aliquota')::numeric ELSE NULL END;
  v_bruto:=CASE WHEN v_aliquota IS NOT NULL AND v_aliquota<100 THEN round(v_novo_p/(1-v_aliquota/100),2) ELSE v_novo_p END;
  v_imposto:=v_bruto-v_novo_p;
  v_snapshot:=coalesce(v_p.snapshot_regra,'{}'::jsonb)||jsonb_build_object('ajuste_repasse_canonico',jsonb_build_object('resolucao_id',v_r.id,'valor_anterior',v_p.valor_previsto,'valor_novo',v_novo_p,'aplicado_em',now()));
  IF v_p.snapshot_regra->'fiscal_lote' IS NOT NULL THEN v_snapshot:=v_snapshot||jsonb_build_object('fiscal_lote',(v_p.snapshot_regra->'fiscal_lote')||jsonb_build_object('valor_bruto',v_bruto,'imposto_valor',v_imposto,'valor_liquido',v_novo_p));END IF;
  UPDATE public.comissao_previsoes_participantes SET valor_previsto=v_novo_p,valor_elegivel=v_novo_eleg,base_calculo_valor=v_novo_f,snapshot_regra=v_snapshot,
   status=CASE WHEN valor_pago>=v_novo_p AND v_novo_p>0 THEN 'paga' WHEN valor_pago>0 THEN 'parcialmente_paga' WHEN v_novo_eleg=v_novo_p AND v_novo_p>0 THEN 'elegivel' WHEN v_novo_eleg>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,updated_at=now() WHERE id=v_p.id;
 END LOOP;
 UPDATE public.comissao_previsoes_franquia SET valor_previsto=v_novo_f,base_calculo_valor=v_novo_f,
  snapshot_regra=coalesce(snapshot_regra,'{}'::jsonb)||jsonb_build_object('ajuste_repasse_canonico',jsonb_build_object('resolucao_id',v_r.id,'valor_anterior',v_f.valor_previsto,'valor_novo',v_novo_f,'aplicado_em',now())),
  status=CASE WHEN valor_liquidado=v_novo_f THEN 'liquidada' WHEN valor_liquidado>0 THEN 'parcialmente_liquidada' ELSE 'prevista' END,updated_at=now() WHERE id=v_f.id;
END $$;

CREATE OR REPLACE FUNCTION public.erp_repasse_aplicar_ajuste_canonico_trigger_201() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN IF NEW.decisao='AJUSTAR_DIFERENCA' THEN PERFORM public.aplicar_ajuste_repasse_canonico_201(NEW.id);END IF;RETURN NEW;END $$;
DROP TRIGGER IF EXISTS trg_repasse_ajuste_canonico_201 ON public.erp_repasse_atencao_resolucoes;
CREATE TRIGGER trg_repasse_ajuste_canonico_201 AFTER INSERT ON public.erp_repasse_atencao_resolucoes FOR EACH ROW EXECUTE FUNCTION public.erp_repasse_aplicar_ajuste_canonico_trigger_201();

DO $$ DECLARE v_id uuid;BEGIN FOR v_id IN SELECT id FROM public.erp_repasse_atencao_resolucoes WHERE decisao='AJUSTAR_DIFERENCA' ORDER BY created_at,id LOOP PERFORM public.aplicar_ajuste_repasse_canonico_201(v_id);END LOOP;END $$;

REVOKE ALL ON FUNCTION public.aplicar_ajuste_repasse_canonico_201(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.erp_repasse_aplicar_ajuste_canonico_trigger_201() FROM PUBLIC,anon,authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
