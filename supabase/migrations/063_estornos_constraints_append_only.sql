-- Cancelamentos/estornos compensatórios e fechamento append-only do financeiro.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_cancelar_venda_comissoes(
  p_empresa_id uuid,p_venda_id uuid,p_motivo text,p_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_hash text;v_idem record;v_venda public.vendas%ROWTYPE;v_prev public.comissao_previsoes_participantes%ROWTYPE;
  v_ja_compensado numeric(15,2);v_compensar numeric(15,2);v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória';END IF;
  IF length(trim(COALESCE(p_motivo,'')))=0 THEN RAISE EXCEPTION 'Motivo obrigatório';END IF;
  v_hash:=md5(p_venda_id::text||'|'||trim(p_motivo));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CANCELAMENTO_VENDA:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='CANCELAMENTO_VENDA' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente';END IF;RETURN v_idem.resposta;END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id=p_venda_id FOR UPDATE;
  IF NOT FOUND OR v_venda.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Venda inexistente ou de outro tenant';END IF;
  FOR v_prev IN SELECT * FROM public.comissao_previsoes_participantes WHERE venda_id=p_venda_id ORDER BY id FOR UPDATE
  LOOP
    IF v_prev.valor_pago>0 THEN
      SELECT COALESCE(sum(c.valor_original-COALESCE((
        SELECT sum(m.valor) FROM public.financeiro_compensacao_movimentos m
        WHERE m.compensacao_id=c.id AND m.tipo='cancelamento'
      ),0)),0) INTO v_ja_compensado
      FROM public.financeiro_compensacoes c WHERE c.previsao_participante_id=v_prev.id;
      v_compensar:=greatest(0,v_prev.valor_pago-v_ja_compensado);
      IF v_compensar>0 THEN
        PERFORM public.rpc_gerar_compensacao(p_empresa_id,'Cancelamento: '||trim(p_motivo),v_compensar,
          p_idempotency_key||':prev:'||v_prev.id::text,v_prev.participante_comercial_id,v_prev.organizacao_parceira_id,p_venda_id,v_prev.id);
      END IF;
    END IF;
  END LOOP;
  UPDATE public.comissao_previsoes_franquia SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';
  UPDATE public.comissao_previsoes_participantes SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';
  UPDATE public.cotas_definitivas SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';
  UPDATE public.vendas SET status='cancelada',updated_at=now() WHERE id=p_venda_id;
  v_response:=jsonb_build_object('venda_id',p_venda_id,'status','cancelada','reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'CANCELAMENTO_VENDA',p_idempotency_key,v_hash,p_venda_id,v_response);
  RETURN v_response;
END$$;

CREATE OR REPLACE FUNCTION public.rpc_estornar_recebimento(
  p_empresa_id uuid,p_recebimento_id uuid,p_motivo text,p_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_hash text;v_idem record;v_rec public.financeiro_recebimentos%ROWTYPE;v_est public.financeiro_estornos%ROWTYPE;
  v_item record;v_prev public.comissao_previsoes_franquia%ROWTYPE;v_novo numeric(15,2);v_eleg numeric(15,2);
  v_pp public.comissao_previsoes_participantes%ROWTYPE;v_ja_comp numeric(15,2);v_comp numeric(15,2);v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória';END IF;
  IF length(trim(COALESCE(p_motivo,'')))=0 THEN RAISE EXCEPTION 'Motivo obrigatório';END IF;
  v_hash:=md5(p_recebimento_id::text||'|'||trim(p_motivo));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':ESTORNO_RECEBIMENTO:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='ESTORNO_RECEBIMENTO' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente';END IF;RETURN v_idem.resposta;END IF;
  SELECT * INTO v_rec FROM public.financeiro_recebimentos WHERE id=p_recebimento_id FOR UPDATE;
  IF NOT FOUND OR v_rec.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Recebimento inexistente ou de outro tenant';END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_estornos WHERE tipo='recebimento' AND recebimento_id=p_recebimento_id) THEN RAISE EXCEPTION 'Recebimento já estornado';END IF;
  INSERT INTO public.financeiro_estornos(empresa_id,tipo,recebimento_id,valor,motivo,idempotency_key)
  VALUES(p_empresa_id,'recebimento',p_recebimento_id,v_rec.valor_total,trim(p_motivo),p_idempotency_key) RETURNING * INTO v_est;
  FOR v_item IN SELECT i.* FROM public.financeiro_recebimento_itens i WHERE i.recebimento_id=p_recebimento_id ORDER BY i.previsao_franquia_id
  LOOP
    SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=v_item.previsao_franquia_id FOR UPDATE;
    v_novo:=v_prev.valor_liquidado-v_item.valor_liquidado;
    IF v_novo<0 THEN RAISE EXCEPTION 'Estorno produziria liquidação negativa';END IF;
    UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_novo,
      status=CASE WHEN v_novo=0 THEN 'prevista' WHEN v_novo=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now()
    WHERE id=v_prev.id;
    FOR v_pp IN SELECT * FROM public.comissao_previsoes_participantes WHERE venda_id=v_prev.venda_id AND ordem_etapa=v_prev.ordem_etapa AND competencia=v_prev.competencia FOR UPDATE
    LOOP
      v_eleg:=round(v_pp.valor_previsto*v_novo/v_prev.valor_previsto,2);
      UPDATE public.comissao_previsoes_participantes SET valor_elegivel=v_eleg,
        status=CASE WHEN valor_pago>0 THEN 'parcialmente_paga' WHEN v_eleg=valor_previsto THEN 'elegivel' WHEN v_eleg>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,
        updated_at=now() WHERE id=v_pp.id;
      IF v_pp.valor_pago>v_eleg THEN
        SELECT COALESCE(sum(c.valor_original-COALESCE((
          SELECT sum(m.valor) FROM public.financeiro_compensacao_movimentos m
          WHERE m.compensacao_id=c.id AND m.tipo='cancelamento'
        ),0)),0) INTO v_ja_comp
        FROM public.financeiro_compensacoes c WHERE c.previsao_participante_id=v_pp.id;
        v_comp:=greatest(0,v_pp.valor_pago-v_eleg-v_ja_comp);
        IF v_comp>0 THEN PERFORM public.rpc_gerar_compensacao(p_empresa_id,'Estorno de recebimento: '||trim(p_motivo),v_comp,
          p_idempotency_key||':prev:'||v_pp.id::text,v_pp.participante_comercial_id,v_pp.organizacao_parceira_id,v_prev.venda_id,v_pp.id);END IF;
      END IF;
    END LOOP;
  END LOOP;
  INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
  VALUES(p_empresa_id,'saida','estorno_recebimento',p_recebimento_id,CURRENT_DATE,v_rec.competencia,v_rec.valor_total,'Estorno de recebimento: '||trim(p_motivo));
  v_response:=jsonb_build_object('estorno',to_jsonb(v_est),'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'ESTORNO_RECEBIMENTO',p_idempotency_key,v_hash,v_est.id,v_response);
  RETURN v_response;
END$$;

CREATE OR REPLACE FUNCTION public.rpc_estornar_pagamento(
  p_empresa_id uuid,p_pagamento_id uuid,p_motivo text,p_idempotency_key text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_hash text;v_idem record;v_pag public.financeiro_pagamentos%ROWTYPE;v_est public.financeiro_estornos%ROWTYPE;
  v_item record;v_mov public.financeiro_compensacao_movimentos%ROWTYPE;v_prev public.comissao_previsoes_participantes%ROWTYPE;
  v_comp public.financeiro_compensacoes%ROWTYPE;v_credito numeric(15,2);v_necessario numeric(15,2);
  v_cancelar numeric(15,2);v_saldo numeric(15,2);v_abate numeric(15,2);v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória';END IF;
  IF length(trim(COALESCE(p_motivo,'')))=0 THEN RAISE EXCEPTION 'Motivo obrigatório';END IF;
  v_hash:=md5(p_pagamento_id::text||'|'||trim(p_motivo));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':ESTORNO_PAGAMENTO:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='ESTORNO_PAGAMENTO' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente';END IF;RETURN v_idem.resposta;END IF;
  SELECT * INTO v_pag FROM public.financeiro_pagamentos WHERE id=p_pagamento_id FOR UPDATE;
  IF NOT FOUND OR v_pag.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Pagamento inexistente ou de outro tenant';END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_estornos WHERE tipo='pagamento' AND pagamento_id=p_pagamento_id) THEN RAISE EXCEPTION 'Pagamento já estornado';END IF;
  INSERT INTO public.financeiro_estornos(empresa_id,tipo,pagamento_id,valor,motivo,idempotency_key)
  VALUES(p_empresa_id,'pagamento',p_pagamento_id,v_pag.valor_bruto,trim(p_motivo),p_idempotency_key) RETURNING * INTO v_est;
  FOR v_item IN SELECT i.* FROM public.financeiro_pagamento_itens i WHERE i.pagamento_id=p_pagamento_id ORDER BY i.previsao_participante_id
  LOOP
    PERFORM 1 FROM public.comissao_previsoes_participantes WHERE id=v_item.previsao_participante_id FOR UPDATE;
    UPDATE public.comissao_previsoes_participantes SET valor_pago=valor_pago-v_item.valor_liquidado,
      status=CASE WHEN valor_pago-v_item.valor_liquidado=0 THEN CASE WHEN valor_elegivel=valor_previsto THEN 'elegivel' WHEN valor_elegivel>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END ELSE 'parcialmente_paga' END,
      updated_at=now() WHERE id=v_item.previsao_participante_id AND valor_pago>=v_item.valor_liquidado;
    IF NOT FOUND THEN RAISE EXCEPTION 'Estorno produziria pagamento acumulado negativo';END IF;
    SELECT * INTO v_prev FROM public.comissao_previsoes_participantes WHERE id=v_item.previsao_participante_id;
    SELECT COALESCE(sum(c.valor_original-COALESCE((
      SELECT sum(m.valor) FROM public.financeiro_compensacao_movimentos m
      WHERE m.compensacao_id=c.id AND m.tipo='cancelamento'
    ),0)),0) INTO v_credito
    FROM public.financeiro_compensacoes c WHERE c.previsao_participante_id=v_prev.id;
    v_necessario:=greatest(0,v_prev.valor_pago-v_prev.valor_elegivel);
    v_cancelar:=greatest(0,v_credito-v_necessario);
    FOR v_comp IN
      SELECT * FROM public.financeiro_compensacoes
      WHERE previsao_participante_id=v_prev.id ORDER BY created_at DESC,id DESC FOR UPDATE
    LOOP
      EXIT WHEN v_cancelar=0;
      SELECT v_comp.valor_original-COALESCE(sum(
        CASE WHEN m.tipo IN('consumo','cancelamento') THEN m.valor ELSE -m.valor END
      ),0) INTO v_saldo
      FROM public.financeiro_compensacao_movimentos m WHERE m.compensacao_id=v_comp.id;
      v_saldo:=greatest(0,COALESCE(v_saldo,v_comp.valor_original));
      IF v_saldo=0 THEN CONTINUE;END IF;
      v_abate:=least(v_saldo,v_cancelar);
      INSERT INTO public.financeiro_compensacao_movimentos(empresa_id,compensacao_id,pagamento_id,tipo,valor)
      VALUES(p_empresa_id,v_comp.id,p_pagamento_id,'cancelamento',v_abate);
      v_cancelar:=v_cancelar-v_abate;
    END LOOP;
    IF v_cancelar>0 THEN
      RAISE EXCEPTION 'Compensação de sobrepagamento já consumida; estorne primeiro os pagamentos posteriores';
    END IF;
  END LOOP;
  FOR v_mov IN SELECT * FROM public.financeiro_compensacao_movimentos WHERE pagamento_id=p_pagamento_id AND tipo='consumo' ORDER BY id FOR UPDATE
  LOOP
    INSERT INTO public.financeiro_compensacao_movimentos(empresa_id,compensacao_id,pagamento_id,tipo,valor)
    VALUES(p_empresa_id,v_mov.compensacao_id,p_pagamento_id,'reversao_consumo',v_mov.valor);
  END LOOP;
  IF v_pag.valor_liquido>0 THEN
    INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
    VALUES(p_empresa_id,'entrada','estorno_pagamento',p_pagamento_id,CURRENT_DATE,v_pag.competencia,v_pag.valor_liquido,'Estorno de pagamento: '||trim(p_motivo));
  END IF;
  v_response:=jsonb_build_object('estorno',to_jsonb(v_est),'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'ESTORNO_PAGAMENTO',p_idempotency_key,v_hash,v_est.id,v_response);
  RETURN v_response;
END$$;

-- Integridade dos novos históricos.
CREATE OR REPLACE FUNCTION public.validate_financeiro_historico_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_empresa uuid;
BEGIN
  IF TG_TABLE_NAME='financeiro_compensacao_movimentos' THEN
    SELECT empresa_id INTO v_empresa FROM public.financeiro_compensacoes WHERE id=NEW.compensacao_id;
    IF v_empresa IS DISTINCT FROM NEW.empresa_id THEN RAISE EXCEPTION 'Movimento de compensação cross-tenant';END IF;
    IF NEW.pagamento_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.financeiro_pagamentos WHERE id=NEW.pagamento_id AND empresa_id=NEW.empresa_id) THEN RAISE EXCEPTION 'Pagamento do movimento cross-tenant';END IF;
  ELSE
    IF NEW.recebimento_id IS NOT NULL THEN SELECT empresa_id INTO v_empresa FROM public.financeiro_recebimentos WHERE id=NEW.recebimento_id;END IF;
    IF NEW.pagamento_id IS NOT NULL THEN SELECT empresa_id INTO v_empresa FROM public.financeiro_pagamentos WHERE id=NEW.pagamento_id;END IF;
    IF v_empresa IS DISTINCT FROM NEW.empresa_id THEN RAISE EXCEPTION 'Estorno cross-tenant';END IF;
  END IF;
  RETURN NEW;
END$$;

DROP TRIGGER IF EXISTS trg_comp_mov_tenant_integrity ON public.financeiro_compensacao_movimentos;
CREATE TRIGGER trg_comp_mov_tenant_integrity BEFORE INSERT ON public.financeiro_compensacao_movimentos FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_historico_tenant();
DROP TRIGGER IF EXISTS trg_estorno_tenant_integrity ON public.financeiro_estornos;
CREATE TRIGGER trg_estorno_tenant_integrity BEFORE INSERT ON public.financeiro_estornos FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_historico_tenant();

-- Todos os fatos financeiros passam a ser append-only, inclusive via service_role.
DO $$DECLARE v_table text;BEGIN
  FOREACH v_table IN ARRAY ARRAY['financeiro_recebimentos','financeiro_recebimento_itens','financeiro_pagamentos','financeiro_pagamento_itens','financeiro_compensacoes','financeiro_compensacao_movimentos','financeiro_estornos','operacoes_idempotentes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','trg_'||v_table||'_append_only',v_table);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.block_append_only_mutation()','trg_'||v_table||'_append_only',v_table);
    EXECUTE format('REVOKE INSERT,UPDATE,DELETE ON TABLE public.%I FROM authenticated,service_role',v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role',v_table);
  END LOOP;
END$$;

CREATE OR REPLACE VIEW public.financeiro_compensacoes_saldos
WITH (security_invoker=true) AS
SELECT c.*,
  (c.valor_original-COALESCE(sum(m.valor) FILTER(WHERE m.tipo='cancelamento'),0))::numeric(15,2) AS valor_credito_efetivo,
  greatest(0,c.valor_original-COALESCE(sum(CASE WHEN m.tipo IN('consumo','cancelamento') THEN m.valor ELSE -m.valor END),0))::numeric(15,2) AS saldo_calculado,
  CASE
    WHEN c.valor_original-COALESCE(sum(CASE WHEN m.tipo IN('consumo','cancelamento') THEN m.valor ELSE -m.valor END),0)<=0 THEN 'compensada'
    WHEN COALESCE(sum(CASE WHEN m.tipo IN('consumo','cancelamento') THEN m.valor ELSE -m.valor END),0)>0 THEN 'parcial'
    ELSE 'pendente' END AS status_calculado
FROM public.financeiro_compensacoes c
LEFT JOIN public.financeiro_compensacao_movimentos m ON m.compensacao_id=c.id
GROUP BY c.id;
REVOKE ALL ON public.financeiro_compensacoes_saldos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.financeiro_compensacoes_saldos TO service_role;

REVOKE ALL ON FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rpc_estornar_recebimento(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rpc_estornar_pagamento(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.validate_financeiro_historico_tenant() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_estornar_recebimento(uuid,uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_estornar_pagamento(uuid,uuid,text,text) TO authenticated,service_role;

COMMIT;
