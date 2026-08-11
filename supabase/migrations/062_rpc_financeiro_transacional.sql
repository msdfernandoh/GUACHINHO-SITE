-- Recebimento, elegibilidade proporcional, pagamento e compensação em transações únicas.

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_registrar_recebimento(
  p_empresa_id uuid,
  p_administradora_id uuid,
  p_competencia text,
  p_valor_total numeric,
  p_itens jsonb,
  p_idempotency_key text,
  p_data_recebimento date DEFAULT CURRENT_DATE,
  p_forma_pagamento text DEFAULT 'pix',
  p_referencia_documento text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_hash text;
  v_idem record;
  v_item jsonb;
  v_prev public.comissao_previsoes_franquia%ROWTYPE;
  v_receb public.financeiro_recebimentos%ROWTYPE;
  v_item_valor numeric(15,2);
  v_sum numeric(15,2);
  v_novo_liquidado numeric(15,2);
  v_nova_elegibilidade numeric(15,2);
  v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória'; END IF;
  IF p_valor_total IS NULL OR p_valor_total<=0 OR round(p_valor_total,2)<>p_valor_total THEN RAISE EXCEPTION 'Valor total inválido'; END IF;
  IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
  IF jsonb_typeof(p_itens)<>'array' OR jsonb_array_length(p_itens)=0 THEN RAISE EXCEPTION 'Recebimento exige itens'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_itens)) <>
     (SELECT count(DISTINCT e->>'previsao_franquia_id') FROM jsonb_array_elements(p_itens)e) THEN
    RAISE EXCEPTION 'Previsão duplicada nos itens de recebimento';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_itens)e WHERE COALESCE(e->>'valor_liquidado','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR (e->>'valor_liquidado')::numeric<=0) THEN
    RAISE EXCEPTION 'Valor de item inválido';
  END IF;
  SELECT sum((e->>'valor_liquidado')::numeric) INTO v_sum FROM jsonb_array_elements(p_itens)e;
  IF v_sum<>p_valor_total THEN RAISE EXCEPTION 'Soma dos itens difere do total do recebimento'; END IF;

  v_hash:=md5(concat_ws('|',p_administradora_id::text,p_competencia,p_valor_total::text,p_itens::text,p_data_recebimento::text,p_forma_pagamento,COALESCE(p_referencia_documento,'')));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':RECEBIMENTO:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='RECEBIMENTO' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente'; END IF;
    RETURN v_idem.resposta;
  END IF;

  -- Locks em ordem estável eliminam dupla liquidação concorrente.
  FOR v_prev IN
    SELECT f.* FROM public.comissao_previsoes_franquia f
    WHERE f.id IN (SELECT (e->>'previsao_franquia_id')::uuid FROM jsonb_array_elements(p_itens)e)
    ORDER BY f.id FOR UPDATE
  LOOP NULL; END LOOP;
  IF (SELECT count(*) FROM public.comissao_previsoes_franquia f WHERE f.id IN (SELECT (e->>'previsao_franquia_id')::uuid FROM jsonb_array_elements(p_itens)e))<>jsonb_array_length(p_itens) THEN
    RAISE EXCEPTION 'Previsão de franquia inexistente';
  END IF;

  INSERT INTO public.financeiro_recebimentos(
    empresa_id,administradora_id,competencia,data_recebimento,valor_total,forma_pagamento,
    referencia_documento,observacoes,status
  ) VALUES (
    p_empresa_id,p_administradora_id,p_competencia,p_data_recebimento,p_valor_total,p_forma_pagamento,
    p_referencia_documento,p_observacoes,'confirmado'
  ) RETURNING * INTO v_receb;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens)e ORDER BY e->>'previsao_franquia_id'
  LOOP
    SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=(v_item->>'previsao_franquia_id')::uuid FOR UPDATE;
    v_item_valor:=(v_item->>'valor_liquidado')::numeric;
    IF v_prev.empresa_id<>p_empresa_id OR v_prev.administradora_id<>p_administradora_id OR v_prev.competencia<>p_competencia THEN
      RAISE EXCEPTION 'Item de recebimento não corresponde a tenant/administradora/competência';
    END IF;
    IF v_prev.status IN ('suspensa','cancelada') THEN RAISE EXCEPTION 'Previsão de franquia não liquidável'; END IF;
    v_novo_liquidado:=v_prev.valor_liquidado+v_item_valor;
    IF v_novo_liquidado>v_prev.valor_previsto THEN RAISE EXCEPTION 'Recebimento excede saldo da previsão de franquia'; END IF;

    INSERT INTO public.financeiro_recebimento_itens(recebimento_id,previsao_franquia_id,valor_liquidado)
    VALUES(v_receb.id,v_prev.id,v_item_valor);
    UPDATE public.comissao_previsoes_franquia
      SET valor_liquidado=v_novo_liquidado,
          status=CASE WHEN v_novo_liquidado=v_prev.valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,
          updated_at=now()
      WHERE id=v_prev.id;

    UPDATE public.comissao_previsoes_participantes p
    SET valor_elegivel=x.elegivel,
        status=CASE
          WHEN p.valor_pago>=p.valor_previsto AND x.elegivel=p.valor_previsto THEN 'paga'
          WHEN p.valor_pago>0 THEN 'parcialmente_paga'
          WHEN x.elegivel=p.valor_previsto THEN 'elegivel'
          WHEN x.elegivel>0 THEN 'parcialmente_elegivel'
          ELSE 'prevista' END,
        updated_at=now()
    FROM (SELECT round(p2.valor_previsto*v_novo_liquidado/v_prev.valor_previsto,2) AS elegivel
          FROM public.comissao_previsoes_participantes p2
          WHERE p2.venda_id=v_prev.venda_id AND p2.ordem_etapa=v_prev.ordem_etapa AND p2.competencia=v_prev.competencia) x
    WHERE p.venda_id=v_prev.venda_id AND p.ordem_etapa=v_prev.ordem_etapa AND p.competencia=v_prev.competencia;
  END LOOP;

  INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
  VALUES(p_empresa_id,'entrada','recebimento_administradora',v_receb.id,p_data_recebimento,p_competencia,p_valor_total,
         'Recebimento de administradora - '||p_competencia||COALESCE(' - Doc: '||p_referencia_documento,''));

  v_response:=jsonb_build_object('recebimento',to_jsonb(v_receb),'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'RECEBIMENTO',p_idempotency_key,v_hash,v_receb.id,v_response);
  RETURN v_response;
END
$$;

CREATE OR REPLACE FUNCTION public.rpc_gerar_compensacao(
  p_empresa_id uuid,
  p_motivo text,
  p_valor numeric,
  p_idempotency_key text,
  p_participante_comercial_id uuid DEFAULT NULL,
  p_organizacao_parceira_id uuid DEFAULT NULL,
  p_venda_id uuid DEFAULT NULL,
  p_previsao_participante_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_hash text;v_idem record;v_comp public.financeiro_compensacoes%ROWTYPE;v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória'; END IF;
  IF p_valor IS NULL OR p_valor<=0 OR round(p_valor,2)<>p_valor THEN RAISE EXCEPTION 'Valor de compensação inválido'; END IF;
  IF (p_participante_comercial_id IS NULL)=(p_organizacao_parceira_id IS NULL) THEN RAISE EXCEPTION 'Informe exatamente um beneficiário'; END IF;
  IF length(trim(COALESCE(p_motivo,'')))=0 THEN RAISE EXCEPTION 'Motivo obrigatório'; END IF;
  IF p_participante_comercial_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.participantes_comerciais WHERE id=p_participante_comercial_id AND empresa_id=p_empresa_id) THEN RAISE EXCEPTION 'Participante de outro tenant'; END IF;
  IF p_organizacao_parceira_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.organizacoes_parceiras WHERE id=p_organizacao_parceira_id AND empresa_id=p_empresa_id) THEN RAISE EXCEPTION 'Organização de outro tenant'; END IF;
  IF p_venda_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.vendas WHERE id=p_venda_id AND empresa_id=p_empresa_id) THEN RAISE EXCEPTION 'Venda de outro tenant'; END IF;
  IF p_previsao_participante_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.comissao_previsoes_participantes WHERE id=p_previsao_participante_id AND empresa_id=p_empresa_id) THEN RAISE EXCEPTION 'Previsão de outro tenant'; END IF;

  v_hash:=md5(concat_ws('|',p_motivo,p_valor::text,COALESCE(p_participante_comercial_id::text,''),COALESCE(p_organizacao_parceira_id::text,''),COALESCE(p_venda_id::text,''),COALESCE(p_previsao_participante_id::text,'')));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':COMPENSACAO:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='COMPENSACAO' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente'; END IF;RETURN v_idem.resposta;END IF;
  INSERT INTO public.financeiro_compensacoes(empresa_id,participante_comercial_id,organizacao_parceira_id,venda_id,previsao_participante_id,motivo,valor_original,valor_saldo,status,idempotency_key)
  VALUES(p_empresa_id,p_participante_comercial_id,p_organizacao_parceira_id,p_venda_id,p_previsao_participante_id,trim(p_motivo),p_valor,p_valor,'pendente',p_idempotency_key)
  RETURNING * INTO v_comp;
  v_response:=jsonb_build_object('compensacao',to_jsonb(v_comp),'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'COMPENSACAO',p_idempotency_key,v_hash,v_comp.id,v_response);
  RETURN v_response;
END
$$;

CREATE OR REPLACE FUNCTION public.rpc_registrar_pagamento(
  p_empresa_id uuid,
  p_competencia text,
  p_valor_bruto numeric,
  p_itens jsonb,
  p_idempotency_key text,
  p_data_pagamento date DEFAULT CURRENT_DATE,
  p_forma_pagamento text DEFAULT 'pix',
  p_referencia_documento text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_hash text;v_idem record;v_item jsonb;v_prev public.comissao_previsoes_participantes%ROWTYPE;
  v_pag public.financeiro_pagamentos%ROWTYPE;v_comp public.financeiro_compensacoes%ROWTYPE;
  v_part uuid;v_org uuid;v_sum numeric(15,2);v_valor numeric(15,2);v_disponivel numeric(15,2);
  v_comp_saldo numeric(15,2);v_compensado numeric(15,2):=0;v_abate numeric(15,2);v_liquido numeric(15,2);
  v_allocs jsonb:='[]'::jsonb;v_alloc jsonb;v_response jsonb;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória'; END IF;
  IF p_valor_bruto IS NULL OR p_valor_bruto<=0 OR round(p_valor_bruto,2)<>p_valor_bruto THEN RAISE EXCEPTION 'Valor bruto inválido'; END IF;
  IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
  IF jsonb_typeof(p_itens)<>'array' OR jsonb_array_length(p_itens)=0 THEN RAISE EXCEPTION 'Pagamento exige itens'; END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_itens))<>(SELECT count(DISTINCT e->>'previsao_participante_id') FROM jsonb_array_elements(p_itens)e) THEN RAISE EXCEPTION 'Previsão duplicada nos itens'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_itens)e WHERE COALESCE(e->>'valor_liquidado','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR (e->>'valor_liquidado')::numeric<=0) THEN RAISE EXCEPTION 'Valor de item inválido'; END IF;
  SELECT sum((e->>'valor_liquidado')::numeric) INTO v_sum FROM jsonb_array_elements(p_itens)e;
  IF v_sum<>p_valor_bruto THEN RAISE EXCEPTION 'Soma dos itens difere do valor bruto'; END IF;

  v_hash:=md5(concat_ws('|',p_competencia,p_valor_bruto::text,p_itens::text,p_data_pagamento::text,p_forma_pagamento,COALESCE(p_referencia_documento,'')));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':PAGAMENTO:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='PAGAMENTO' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente'; END IF;RETURN v_idem.resposta;END IF;

  FOR v_prev IN SELECT p.* FROM public.comissao_previsoes_participantes p WHERE p.id IN(SELECT(e->>'previsao_participante_id')::uuid FROM jsonb_array_elements(p_itens)e) ORDER BY p.id FOR UPDATE LOOP NULL;END LOOP;
  IF (SELECT count(*) FROM public.comissao_previsoes_participantes p WHERE p.id IN(SELECT(e->>'previsao_participante_id')::uuid FROM jsonb_array_elements(p_itens)e))<>jsonb_array_length(p_itens) THEN RAISE EXCEPTION 'Previsão de participante inexistente'; END IF;

  FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens)e ORDER BY e->>'previsao_participante_id'
  LOOP
    SELECT * INTO v_prev FROM public.comissao_previsoes_participantes WHERE id=(v_item->>'previsao_participante_id')::uuid FOR UPDATE;
    v_valor:=(v_item->>'valor_liquidado')::numeric;
    IF v_prev.empresa_id<>p_empresa_id OR v_prev.competencia<>p_competencia THEN RAISE EXCEPTION 'Previsão não corresponde ao tenant/competência'; END IF;
    IF v_prev.status IN('suspensa','cancelada') THEN RAISE EXCEPTION 'Previsão não pagável'; END IF;
    v_disponivel:=v_prev.valor_elegivel-v_prev.valor_pago;
    IF v_valor>v_disponivel THEN RAISE EXCEPTION 'Pagamento excede valor elegível'; END IF;
    IF v_part IS NULL AND v_org IS NULL THEN v_part:=v_prev.participante_comercial_id;v_org:=v_prev.organizacao_parceira_id;
    ELSIF v_part IS DISTINCT FROM v_prev.participante_comercial_id OR v_org IS DISTINCT FROM v_prev.organizacao_parceira_id THEN RAISE EXCEPTION 'Pagamento mistura beneficiários';END IF;
  END LOOP;

  -- Compensações são travadas e alocadas em ordem estável; o histórico não é atualizado.
  FOR v_comp IN
    SELECT c.* FROM public.financeiro_compensacoes c
    WHERE c.empresa_id=p_empresa_id AND c.participante_comercial_id IS NOT DISTINCT FROM v_part AND c.organizacao_parceira_id IS NOT DISTINCT FROM v_org
    ORDER BY c.created_at,c.id FOR UPDATE
  LOOP
    EXIT WHEN v_compensado=p_valor_bruto;
    SELECT v_comp.valor_original-COALESCE(sum(CASE WHEN m.tipo='consumo' THEN m.valor ELSE -m.valor END),0)
      INTO v_comp_saldo FROM public.financeiro_compensacao_movimentos m WHERE m.compensacao_id=v_comp.id;
    IF v_comp_saldo<=0 THEN CONTINUE;END IF;
    v_abate:=least(v_comp_saldo,p_valor_bruto-v_compensado);
    v_allocs:=v_allocs||jsonb_build_array(jsonb_build_object('compensacao_id',v_comp.id,'valor',v_abate));
    v_compensado:=v_compensado+v_abate;
  END LOOP;
  v_liquido:=p_valor_bruto-v_compensado;
  IF v_liquido<0 THEN RAISE EXCEPTION 'Pagamento líquido negativo';END IF;

  INSERT INTO public.financeiro_pagamentos(empresa_id,participante_comercial_id,organizacao_parceira_id,competencia,data_pagamento,valor_bruto,valor_compensado,valor_liquido,forma_pagamento,referencia_documento,observacoes,status)
  VALUES(p_empresa_id,v_part,v_org,p_competencia,p_data_pagamento,p_valor_bruto,v_compensado,v_liquido,p_forma_pagamento,p_referencia_documento,p_observacoes,'confirmado')
  RETURNING * INTO v_pag;
  FOR v_alloc IN SELECT e FROM jsonb_array_elements(v_allocs)e LOOP
    INSERT INTO public.financeiro_compensacao_movimentos(empresa_id,compensacao_id,pagamento_id,tipo,valor)
    VALUES(p_empresa_id,(v_alloc->>'compensacao_id')::uuid,v_pag.id,'consumo',(v_alloc->>'valor')::numeric);
  END LOOP;
  FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens)e LOOP
    v_valor:=(v_item->>'valor_liquidado')::numeric;
    INSERT INTO public.financeiro_pagamento_itens(pagamento_id,previsao_participante_id,valor_liquidado)
    VALUES(v_pag.id,(v_item->>'previsao_participante_id')::uuid,v_valor);
    UPDATE public.comissao_previsoes_participantes
      SET valor_pago=valor_pago+v_valor,
          status=CASE WHEN valor_pago+v_valor=valor_previsto THEN 'paga' ELSE 'parcialmente_paga' END,
          updated_at=now()
      WHERE id=(v_item->>'previsao_participante_id')::uuid;
  END LOOP;
  IF v_liquido>0 THEN
    INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
    VALUES(p_empresa_id,'saida','pagamento_participante',v_pag.id,p_data_pagamento,p_competencia,v_liquido,
      'Pagamento de comissão - bruto '||p_valor_bruto::text||', compensado '||v_compensado::text);
  END IF;
  v_response:=jsonb_build_object('pagamento',to_jsonb(v_pag),'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'PAGAMENTO',p_idempotency_key,v_hash,v_pag.id,v_response);
  RETURN v_response;
END
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_recebimento(uuid,uuid,text,numeric,jsonb,text,date,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento(uuid,text,numeric,jsonb,text,date,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_gerar_compensacao(uuid,text,numeric,text,uuid,uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recebimento(uuid,uuid,text,numeric,jsonb,text,date,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pagamento(uuid,text,numeric,jsonb,text,date,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_compensacao(uuid,text,numeric,text,uuid,uuid,uuid,uuid) TO authenticated,service_role;

COMMIT;
