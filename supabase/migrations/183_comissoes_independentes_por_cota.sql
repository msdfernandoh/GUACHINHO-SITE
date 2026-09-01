-- 183: cada cota definitiva possui cronograma de comissão próprio, preservando
-- exatamente o total calculado para a venda (inclusive centavos de arredondamento).
BEGIN;

ALTER TABLE public.comissao_previsoes_franquia
  DROP CONSTRAINT IF EXISTS uq_previsao_franquia_venda_etapa;
CREATE UNIQUE INDEX IF NOT EXISTS comissao_previsao_franquia_cota_etapa_uidx
  ON public.comissao_previsoes_franquia(venda_id,cota_definitiva_id,ordem_etapa);
DROP INDEX IF EXISTS public.comissao_previsao_franquia_contemplacao_uidx;
CREATE UNIQUE INDEX comissao_previsao_franquia_contemplacao_uidx
  ON public.comissao_previsoes_franquia(venda_id,cota_definitiva_id)
  WHERE tipo_gatilho='CONTEMPLACAO';
DROP INDEX IF EXISTS public.comissao_previsao_participante_contemplacao_uidx;
CREATE UNIQUE INDEX comissao_previsao_participante_contemplacao_uidx
  ON public.comissao_previsoes_participantes(venda_id,cota_definitiva_id,participante_comercial_id)
  WHERE tipo_gatilho='CONTEMPLACAO' AND participante_comercial_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.distribuir_previsoes_por_cota(p_empresa_id uuid,p_venda_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_quantidade integer;
  v_cotas integer;
  v_cota record;
  v_prev_f public.comissao_previsoes_franquia%ROWTYPE;
  v_prev_p public.comissao_previsoes_participantes%ROWTYPE;
  v_nova_f_id uuid;
  v_f_id uuid;
  v_base numeric;
  v_valor numeric;
  v_fixo numeric;
  v_ordem integer;
  v_geradas_f integer:=0;
  v_geradas_p integer:=0;
BEGIN
  SELECT quantidade_cotas INTO v_quantidade FROM public.vendas
  WHERE id=p_venda_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_quantidade IS NULL THEN RAISE EXCEPTION 'Venda multicotas não encontrada'; END IF;
  SELECT count(*) INTO v_cotas FROM public.cotas_definitivas
  WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id;
  IF v_quantidade<=1 OR v_cotas<>v_quantidade THEN
    RETURN jsonb_build_object('distribuido',false,'quantidade_esperada',v_quantidade,'cotas_encontradas',v_cotas);
  END IF;
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia
    WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id
      AND coalesce((snapshot_regra->>'multicotas_distribuida')::boolean,false)) THEN
    RETURN jsonb_build_object('distribuido',false,'idempotente',true);
  END IF;
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia
      WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id AND valor_liquidado>0)
     OR EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes
      WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id AND (valor_elegivel>0 OR valor_pago>0)) THEN
    RETURN jsonb_build_object('distribuido',false,'bloqueado','COMISSOES_JA_MOVIMENTADAS');
  END IF;

  FOR v_prev_f IN SELECT * FROM public.comissao_previsoes_franquia
    WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id ORDER BY created_at,id
  LOOP
    v_ordem:=0;
    FOR v_cota IN SELECT * FROM public.cotas_definitivas
      WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id ORDER BY ordem_cota,id
    LOOP
      v_ordem:=v_ordem+1;
      v_base:=CASE WHEN v_ordem=v_quantidade THEN v_prev_f.base_calculo_valor-(trunc(v_prev_f.base_calculo_valor*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_f.base_calculo_valor*100/v_quantidade)/100 END;
      v_valor:=CASE WHEN v_ordem=v_quantidade THEN v_prev_f.valor_previsto-(trunc(v_prev_f.valor_previsto*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_f.valor_previsto*100/v_quantidade)/100 END;
      v_fixo:=CASE WHEN v_prev_f.valor_fixo_aplicado IS NULL THEN NULL
        WHEN v_ordem=v_quantidade THEN v_prev_f.valor_fixo_aplicado-(trunc(v_prev_f.valor_fixo_aplicado*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_f.valor_fixo_aplicado*100/v_quantidade)/100 END;
      IF v_ordem=1 THEN
        UPDATE public.comissao_previsoes_franquia SET cota_definitiva_id=v_cota.id,
          base_calculo_valor=v_base,valor_previsto=v_valor,valor_fixo_aplicado=v_fixo,
          snapshot_regra=coalesce(snapshot_regra,'{}')||jsonb_build_object(
            'multicotas_distribuida',true,'previsao_origem_id',v_prev_f.id,'ordem_cota',v_ordem,
            'quantidade_cotas',v_quantidade,'valor_total_original',v_prev_f.valor_previsto),updated_at=now()
        WHERE id=v_prev_f.id;
      ELSE
        INSERT INTO public.comissao_previsoes_franquia
        SELECT (jsonb_populate_record(NULL::public.comissao_previsoes_franquia,
          to_jsonb(v_prev_f)||jsonb_build_object('id',gen_random_uuid(),'cota_definitiva_id',v_cota.id,
            'base_calculo_valor',v_base,'valor_previsto',v_valor,'valor_liquidado',0,
            'valor_fixo_aplicado',v_fixo,'snapshot_regra',coalesce(v_prev_f.snapshot_regra,'{}')||jsonb_build_object(
              'multicotas_distribuida',true,'previsao_origem_id',v_prev_f.id,'ordem_cota',v_ordem,
              'quantidade_cotas',v_quantidade,'valor_total_original',v_prev_f.valor_previsto),
            'created_at',now(),'updated_at',now()))).* RETURNING id INTO v_nova_f_id;
        v_geradas_f:=v_geradas_f+1;
      END IF;
    END LOOP;
  END LOOP;

  FOR v_prev_p IN SELECT * FROM public.comissao_previsoes_participantes
    WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id ORDER BY created_at,id
  LOOP
    v_ordem:=0;
    FOR v_cota IN SELECT * FROM public.cotas_definitivas
      WHERE venda_id=p_venda_id AND empresa_id=p_empresa_id ORDER BY ordem_cota,id
    LOOP
      v_ordem:=v_ordem+1;
      v_base:=CASE WHEN v_ordem=v_quantidade THEN v_prev_p.base_calculo_valor-(trunc(v_prev_p.base_calculo_valor*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_p.base_calculo_valor*100/v_quantidade)/100 END;
      v_valor:=CASE WHEN v_ordem=v_quantidade THEN v_prev_p.valor_previsto-(trunc(v_prev_p.valor_previsto*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_p.valor_previsto*100/v_quantidade)/100 END;
      v_fixo:=CASE WHEN v_prev_p.valor_fixo_aplicado IS NULL THEN NULL
        WHEN v_ordem=v_quantidade THEN v_prev_p.valor_fixo_aplicado-(trunc(v_prev_p.valor_fixo_aplicado*100/v_quantidade)/100)*(v_quantidade-1)
        ELSE trunc(v_prev_p.valor_fixo_aplicado*100/v_quantidade)/100 END;
      SELECT f.id INTO v_f_id FROM public.comissao_previsoes_franquia f
      WHERE f.venda_id=p_venda_id AND f.cota_definitiva_id=v_cota.id
        AND (f.snapshot_regra->>'previsao_origem_id')=v_prev_p.previsao_franquia_id::text LIMIT 1;
      IF v_ordem=1 THEN
        UPDATE public.comissao_previsoes_participantes SET cota_definitiva_id=v_cota.id,
          previsao_franquia_id=coalesce(v_f_id,previsao_franquia_id),base_calculo_valor=v_base,
          valor_previsto=v_valor,valor_fixo_aplicado=v_fixo,
          snapshot_regra=coalesce(snapshot_regra,'{}')||jsonb_build_object(
            'multicotas_distribuida',true,'previsao_origem_id',v_prev_p.id,'ordem_cota',v_ordem,
            'quantidade_cotas',v_quantidade,'valor_total_original',v_prev_p.valor_previsto),updated_at=now()
        WHERE id=v_prev_p.id;
      ELSE
        INSERT INTO public.comissao_previsoes_participantes
        SELECT (jsonb_populate_record(NULL::public.comissao_previsoes_participantes,
          to_jsonb(v_prev_p)||jsonb_build_object('id',gen_random_uuid(),'cota_definitiva_id',v_cota.id,
            'previsao_franquia_id',v_f_id,'base_calculo_valor',v_base,'valor_previsto',v_valor,
            'valor_elegivel',0,'valor_pago',0,'valor_fixo_aplicado',v_fixo,
            'snapshot_regra',coalesce(v_prev_p.snapshot_regra,'{}')||jsonb_build_object(
              'multicotas_distribuida',true,'previsao_origem_id',v_prev_p.id,'ordem_cota',v_ordem,
              'quantidade_cotas',v_quantidade,'valor_total_original',v_prev_p.valor_previsto),
            'created_at',now(),'updated_at',now()))).*;
        v_geradas_p:=v_geradas_p+1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('distribuido',true,'cotas',v_quantidade,
    'previsoes_franquia_criadas',v_geradas_f,'previsoes_participantes_criadas',v_geradas_p);
END $$;

CREATE OR REPLACE FUNCTION public.distribuir_previsoes_multicotas_apos_cota()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_esperada integer; v_atual integer;
BEGIN
  SELECT quantidade_cotas INTO v_esperada FROM public.vendas WHERE id=NEW.venda_id;
  SELECT count(*) INTO v_atual FROM public.cotas_definitivas WHERE venda_id=NEW.venda_id;
  IF v_esperada>1 AND v_atual=v_esperada THEN
    PERFORM public.distribuir_previsoes_por_cota(NEW.empresa_id,NEW.venda_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_distribuir_previsoes_multicotas ON public.cotas_definitivas;
CREATE TRIGGER trg_distribuir_previsoes_multicotas AFTER INSERT ON public.cotas_definitivas
FOR EACH ROW EXECUTE FUNCTION public.distribuir_previsoes_multicotas_apos_cota();

-- Contemplação e cancelamento passam a operar somente o cronograma da cota
-- selecionada, sem antecipar/cancelar as demais cotas da mesma venda.
DO $patch$
DECLARE v_def text; v_nova text;
BEGIN
  SELECT pg_get_functiondef('public.rpc_registrar_contemplacao_comissoes(uuid,uuid,text,date,boolean,text,text)'::regprocedure) INTO v_def;
  v_nova:=replace(v_def,'WHERE venda_id = v_venda.id AND status IN',
    'WHERE venda_id = v_venda.id AND cota_definitiva_id = p_cota_id AND status IN');
  IF v_nova=v_def THEN RAISE EXCEPTION 'Não foi possível isolar a contemplação por cota'; END IF;
  EXECUTE v_nova;

  SELECT pg_get_functiondef('public.rpc_cancelar_cota_com_estorno(uuid,uuid,text,date)'::regprocedure) INTO v_def;
  v_nova:=replace(v_def,
    'WHERE venda_id = v_venda.id AND status = ''paga''',
    'WHERE venda_id = v_venda.id AND cota_definitiva_id = p_cota_id AND status = ''paga''');
  v_nova:=replace(v_nova,
    'WHERE venda_id = v_venda.id AND status IN',
    'WHERE venda_id = v_venda.id AND cota_definitiva_id = p_cota_id AND status IN');
  v_nova:=replace(v_nova,
    'SET status = ''cancelada'', updated_at = now()',
    'SET status = CASE WHEN EXISTS (SELECT 1 FROM public.cotas_definitivas c WHERE c.venda_id=v_venda.id AND c.status<>''cancelada'') THEN ''confirmada'' ELSE ''cancelada'' END, updated_at = now()');
  IF position('cota_definitiva_id = p_cota_id' IN v_nova)=0 THEN
    RAISE EXCEPTION 'Não foi possível isolar o cancelamento por cota';
  END IF;
  IF position('c.status<>''cancelada''' IN v_nova)=0 THEN
    RAISE EXCEPTION 'Não foi possível preservar a venda ao cancelar somente uma cota';
  END IF;
  EXECUTE v_nova;
END $patch$;

-- Reconcilia somente vendas multicotas ainda sem movimentação financeira.
DO $$DECLARE v record; BEGIN
  FOR v IN SELECT empresa_id,id FROM public.vendas WHERE quantidade_cotas>1 LOOP
    PERFORM public.distribuir_previsoes_por_cota(v.empresa_id,v.id);
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.distribuir_previsoes_por_cota(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.distribuir_previsoes_multicotas_apos_cota() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.distribuir_previsoes_por_cota(uuid,uuid) TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
