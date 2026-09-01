-- 186 — A linha do relatório vinculada à previsão é a confirmação operacional
-- do recebimento. Baixa automática, idempotente e individual por cota.

BEGIN;

CREATE OR REPLACE FUNCTION public.repasse_baixar_itens_vinculados(p_importacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item record;
  v_saldo_previsao numeric;
  v_saldo_recebimento numeric;
  v_valor numeric;
  v_baixados integer := 0;
BEGIN
  SELECT * INTO v_importacao
  FROM public.erp_repasse_importacoes
  WHERE id = p_importacao_id
  FOR UPDATE;

  IF v_importacao.id IS NULL OR v_importacao.recebimento_id IS NULL THEN
    RETURN jsonb_build_object('baixados', 0, 'aguardando_recebimento', true);
  END IF;

  FOR v_item IN
    SELECT i.id, i.previsao_franquia_id, i.valor_comissao
    FROM public.erp_repasse_importacao_itens i
    WHERE i.importacao_id = v_importacao.id
      AND i.empresa_id = v_importacao.empresa_id
      AND i.previsao_franquia_id IS NOT NULL
      AND i.status_conciliacao IN ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO')
      AND NOT EXISTS (
        SELECT 1
        FROM public.financeiro_recebimento_itens ri
        WHERE ri.recebimento_id = v_importacao.recebimento_id
          AND ri.previsao_franquia_id = i.previsao_franquia_id
      )
    ORDER BY i.linha
  LOOP
    SELECT greatest(f.valor_previsto - coalesce(f.valor_liquidado, 0), 0)
      INTO v_saldo_previsao
    FROM public.comissao_previsoes_franquia f
    WHERE f.id = v_item.previsao_franquia_id
      AND f.empresa_id = v_importacao.empresa_id
      AND f.administradora_id = v_importacao.administradora_id
    FOR UPDATE;

    SELECT greatest(
      r.valor_total
      - coalesce((SELECT sum(ri.valor_liquidado) FROM public.financeiro_recebimento_itens ri WHERE ri.recebimento_id = r.id), 0)
      - coalesce((SELECT sum(rc.valor) FROM public.financeiro_recebimento_classificacoes rc WHERE rc.recebimento_id = r.id), 0),
      0
    )
      INTO v_saldo_recebimento
    FROM public.financeiro_recebimentos r
    WHERE r.id = v_importacao.recebimento_id
      AND r.empresa_id = v_importacao.empresa_id
    FOR UPDATE;

    v_valor := least(coalesce(v_item.valor_comissao, 0), coalesce(v_saldo_previsao, 0), coalesce(v_saldo_recebimento, 0));
    IF v_valor > 0 THEN
      PERFORM public.rpc_conciliar_recebimento_manual(
        v_importacao.empresa_id,
        v_importacao.recebimento_id,
        jsonb_build_array(jsonb_build_object(
          'previsao_franquia_id', v_item.previsao_franquia_id,
          'valor', v_valor
        )),
        '[]'::jsonb,
        'repasse-auto:item:' || v_item.id::text
      );
      v_baixados := v_baixados + 1;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM public.erp_repasse_importacao_itens i
    WHERE i.importacao_id = v_importacao.id
      AND i.status_conciliacao IN ('ATENCAO', 'NAO_ENCONTRADO')
  ) AND EXISTS (
    SELECT 1 FROM public.financeiro_recebimentos r
    WHERE r.id = v_importacao.recebimento_id
      AND coalesce((SELECT sum(ri.valor_liquidado) FROM public.financeiro_recebimento_itens ri WHERE ri.recebimento_id = r.id), 0)
        + coalesce((SELECT sum(rc.valor) FROM public.financeiro_recebimento_classificacoes rc WHERE rc.recebimento_id = r.id), 0)
        >= r.valor_total
  ) THEN
    UPDATE public.erp_repasse_importacoes
    SET status = 'CONFIRMADO', updated_at = now()
    WHERE id = v_importacao.id;
  END IF;

  RETURN jsonb_build_object('baixados', v_baixados, 'aguardando_recebimento', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.repasse_baixa_automatica_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_TABLE_NAME = 'erp_repasse_importacoes' THEN
    IF NEW.recebimento_id IS NOT NULL THEN
      PERFORM public.repasse_baixar_itens_vinculados(NEW.id);
    END IF;
  ELSE
    IF NEW.previsao_franquia_id IS NOT NULL
       AND NEW.status_conciliacao IN ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO') THEN
      PERFORM public.repasse_baixar_itens_vinculados(NEW.importacao_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repasse_importacao_baixa_automatica ON public.erp_repasse_importacoes;
CREATE TRIGGER trg_repasse_importacao_baixa_automatica
AFTER INSERT OR UPDATE OF recebimento_id ON public.erp_repasse_importacoes
FOR EACH ROW EXECUTE FUNCTION public.repasse_baixa_automatica_trigger();

DROP TRIGGER IF EXISTS trg_repasse_item_baixa_automatica ON public.erp_repasse_importacao_itens;
CREATE TRIGGER trg_repasse_item_baixa_automatica
AFTER INSERT OR UPDATE OF previsao_franquia_id, status_conciliacao ON public.erp_repasse_importacao_itens
FOR EACH ROW EXECUTE FUNCTION public.repasse_baixa_automatica_trigger();

-- A elegibilidade do participante acompanha somente a mesma cota da previsão
-- recebida. Evita liberar outra cota da mesma venda por engano.
CREATE OR REPLACE FUNCTION public.rpc_conciliar_recebimento_manual(
 p_empresa_id uuid,p_recebimento_id uuid,p_itens jsonb,p_classificacoes jsonb,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_receb record;v_prev record;v_item jsonb;v_class jsonb;v_valor numeric;v_novo numeric;v_existente numeric;v_novo_total numeric;v_hash text;v_idem record;v_status text;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF jsonb_typeof(p_itens)<>'array' OR jsonb_typeof(p_classificacoes)<>'array' THEN RAISE EXCEPTION 'Itens e classificações devem ser listas';END IF;
 IF jsonb_array_length(p_itens)+jsonb_array_length(p_classificacoes)=0 THEN RAISE EXCEPTION 'Informe ao menos uma conciliação/classificação';END IF;
 v_hash:=md5(p_recebimento_id::text||p_itens::text||p_classificacoes::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CONCILIAR:'||p_idempotency_key,0));
 SELECT * INTO v_idem FROM public.financeiro_recebimento_conciliacoes WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF v_idem.id IS NOT NULL THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Chave reutilizada com dados diferentes';END IF;RETURN jsonb_build_object('recebimento_id',p_recebimento_id,'reused',true);END IF;
 SELECT * INTO v_receb FROM public.financeiro_recebimentos WHERE id=p_recebimento_id AND empresa_id=p_empresa_id AND origem_registro='MANUAL' AND status='confirmado' FOR UPDATE;
 IF v_receb.id IS NULL THEN RAISE EXCEPTION 'Recebimento manual não encontrado';END IF;
 SELECT coalesce(sum(valor_liquidado),0)+(SELECT coalesce(sum(valor),0) FROM public.financeiro_recebimento_classificacoes WHERE recebimento_id=p_recebimento_id) INTO v_existente FROM public.financeiro_recebimento_itens WHERE recebimento_id=p_recebimento_id;
 SELECT coalesce(sum((s.e->>'valor')::numeric),0) INTO v_novo_total FROM (SELECT e FROM jsonb_array_elements(p_itens)e UNION ALL SELECT e FROM jsonb_array_elements(p_classificacoes)e)s;
 IF v_novo_total<=0 OR v_existente+v_novo_total>v_receb.valor_total THEN RAISE EXCEPTION 'Classificação excede o saldo do recebimento';END IF;
 FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens)e LOOP
  v_valor:=(v_item->>'valor')::numeric;
  SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=(v_item->>'previsao_franquia_id')::uuid FOR UPDATE;
  IF v_valor<=0 OR v_prev.id IS NULL OR v_prev.empresa_id<>p_empresa_id OR v_prev.administradora_id<>v_receb.administradora_id THEN RAISE EXCEPTION 'Previsão inválida para este recebimento';END IF;
  v_novo:=v_prev.valor_liquidado+v_valor; IF v_novo>v_prev.valor_previsto THEN RAISE EXCEPTION 'Valor excede o saldo da previsão';END IF;
  INSERT INTO public.financeiro_recebimento_itens(recebimento_id,previsao_franquia_id,valor_liquidado) VALUES(v_receb.id,v_prev.id,v_valor);
  UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_novo,status=CASE WHEN v_novo=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now() WHERE id=v_prev.id;
  UPDATE public.comissao_previsoes_participantes p SET
    valor_elegivel=round(p.valor_previsto*v_novo/v_prev.valor_previsto,2),
    status=CASE WHEN p.valor_pago>=p.valor_previsto THEN 'paga' WHEN p.valor_pago>0 THEN 'parcialmente_paga' WHEN round(p.valor_previsto*v_novo/v_prev.valor_previsto,2)=p.valor_previsto THEN 'elegivel' WHEN round(p.valor_previsto*v_novo/v_prev.valor_previsto,2)>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,
    updated_at=now()
   WHERE p.venda_id=v_prev.venda_id AND p.ordem_etapa=v_prev.ordem_etapa AND p.competencia=v_prev.competencia
     AND p.cota_definitiva_id IS NOT DISTINCT FROM v_prev.cota_definitiva_id
     AND coalesce(p.snapshot_regra->>'modo','AUTOMATICA')<>'MANUAL';
 END LOOP;
 FOR v_class IN SELECT e FROM jsonb_array_elements(p_classificacoes)e LOOP
  v_valor:=(v_class->>'valor')::numeric;
  INSERT INTO public.financeiro_recebimento_classificacoes(empresa_id,recebimento_id,tipo,valor,descricao,created_by_usuario_id)
   VALUES(p_empresa_id,v_receb.id,v_class->>'tipo',v_valor,nullif(trim(coalesce(v_class->>'descricao','')),''),public.current_usuario_id());
 END LOOP;
 v_novo_total:=v_existente+v_novo_total;
 v_status:=CASE WHEN v_novo_total=v_receb.valor_total THEN 'CONCILIADO' WHEN v_novo_total>0 THEN 'PARCIALMENTE_CONCILIADO' ELSE 'PENDENTE_CLASSIFICACAO' END;
 -- O recebimento e um fato financeiro append-only. O estado da conciliacao e
 -- derivado dos itens/classificacoes imutaveis, sem atualizar o lancamento-base.
 INSERT INTO public.financeiro_recebimento_conciliacoes(empresa_id,recebimento_id,idempotency_key,payload_hash,created_by_usuario_id) VALUES(p_empresa_id,v_receb.id,p_idempotency_key,v_hash,public.current_usuario_id());
 RETURN jsonb_build_object('recebimento_id',v_receb.id,'valor_classificado',v_novo_total,'saldo',v_receb.valor_total-v_novo_total,'status',v_status,'reused',false);
END $$;

-- Reconcilia os vínculos já existentes sem duplicar lançamentos.
DO $$
DECLARE v_importacao record;
BEGIN
  FOR v_importacao IN
    SELECT id FROM public.erp_repasse_importacoes WHERE recebimento_id IS NOT NULL ORDER BY created_at
  LOOP
    PERFORM public.repasse_baixar_itens_vinculados(v_importacao.id);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.repasse_baixar_itens_vinculados(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.repasse_baixa_automatica_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repasse_baixar_itens_vinculados(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
