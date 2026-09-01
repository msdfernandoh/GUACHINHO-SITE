-- 196 — Conta de entrada opcional para comissões e correção compensatória do destino.
BEGIN;

DROP FUNCTION IF EXISTS public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text);
DROP FUNCTION IF EXISTS public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text,uuid);
CREATE FUNCTION public.rpc_registrar_pagamento_bancario(
  p_empresa_id uuid,p_conta_origem_id uuid,p_competencia text,p_valor_bruto numeric,p_itens jsonb,
  p_idempotency_key text,p_data_pagamento date DEFAULT CURRENT_DATE,p_forma_pagamento text DEFAULT 'pix',
  p_referencia_documento text DEFAULT NULL,p_observacoes text DEFAULT NULL,p_conta_destino_id uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_result jsonb;v_pag public.financeiro_pagamentos%ROWTYPE;v_saldo numeric;v_socio record;
  v_conta_destino jsonb;v_destino_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira';END IF;
  PERFORM 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_origem_id AND empresa_id=p_empresa_id AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancária de origem inválida';END IF;
  IF p_conta_destino_id=p_conta_origem_id THEN RAISE EXCEPTION 'Conta de origem e entrada não podem ser iguais';END IF;
  IF p_conta_destino_id IS NOT NULL THEN
    PERFORM 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_destino_id AND empresa_id=p_empresa_id AND ativo FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancária de entrada inválida';END IF;
  END IF;
  v_result:=public.rpc_registrar_pagamento(p_empresa_id,p_competencia,p_valor_bruto,p_itens,p_idempotency_key,p_data_pagamento,p_forma_pagamento,p_referencia_documento,p_observacoes);
  SELECT * INTO v_pag FROM public.financeiro_pagamentos WHERE id=(v_result#>>'{pagamento,id}')::uuid;
  IF v_pag.id IS NULL THEN RAISE EXCEPTION 'Pagamento não retornado pelo motor financeiro';END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key='pagamento-saida:'||v_pag.id::text) THEN
    RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'conta_destino_id',p_conta_destino_id,'reused',true);
  END IF;
  SELECT saldo_atual INTO v_saldo FROM public.financeiro_contas_saldos WHERE id=p_conta_origem_id;
  IF coalesce(v_saldo,0)<v_pag.valor_liquido THEN RAISE EXCEPTION 'Saldo bancário insuficiente';END IF;
  IF p_conta_destino_id IS NULL THEN
    SELECT id INTO v_destino_id FROM public.financeiro_contas_bancarias
    WHERE empresa_id=p_empresa_id AND participante_comercial_id=v_pag.participante_comercial_id AND ativo LIMIT 1 FOR UPDATE;
  ELSE v_destino_id:=p_conta_destino_id; END IF;
  SELECT s.*,to_jsonb(c)-'empresa_id'-'socio_id'-'created_at'-'updated_at' conta INTO v_socio
  FROM public.participantes_comerciais pc JOIN public.empresa_socios s ON s.empresa_id=pc.empresa_id AND s.usuario_id=pc.usuario_id AND s.ativo
  LEFT JOIN public.empresa_socio_contas c ON c.socio_id=s.id AND c.ativo AND c.principal
  WHERE pc.id=v_pag.participante_comercial_id AND pc.empresa_id=p_empresa_id LIMIT 1;
  v_conta_destino:=CASE WHEN v_socio.id IS NULL THEN NULL ELSE v_socio.conta END;
  INSERT INTO public.financeiro_pagamento_contas(empresa_id,pagamento_id,conta_origem_id,conta_destino_snapshot)
  VALUES(p_empresa_id,v_pag.id,p_conta_origem_id,coalesce(v_conta_destino,jsonb_build_object('conta_bancaria_id',v_destino_id))) ON CONFLICT (pagamento_id) DO NOTHING;
  IF v_pag.valor_liquido>0 THEN
    INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
    VALUES(p_empresa_id,p_conta_origem_id,'SAIDA',CASE WHEN v_socio.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,v_pag.valor_liquido,p_data_pagamento,'Pagamento de comissão - '||p_competencia,v_pag.id,'pagamento-saida:'||v_pag.id::text,public.current_usuario_id());
    IF v_destino_id IS NOT NULL THEN
      INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
      VALUES(p_empresa_id,v_destino_id,'ENTRADA',CASE WHEN v_socio.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,v_pag.valor_liquido,p_data_pagamento,'Comissão recebida - '||p_competencia,v_pag.id,'pagamento-entrada:'||v_pag.id::text,public.current_usuario_id());
    END IF;
  END IF;
  RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'conta_destino_id',v_destino_id,'socio_destino_id',v_socio.id);
END $$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text,uuid) TO authenticated,service_role;

-- O crédito do pagamento 871098fa foi inicialmente lançado na conta Fernando.
-- A solicitação operacional determina Gauchinho Particular como destino. O ajuste é
-- uma transferência append-only entre contas, sem alterar ou apagar o pagamento.
WITH dados AS (
  SELECT
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid empresa_id,
    'e53b8f7b-db22-4a5a-8696-833d0dda392c'::uuid origem_id,
    '69f8a1da-5c18-410c-b271-3609b75ea70d'::uuid destino_id,
    6187.50::numeric valor
), nova AS (
  INSERT INTO public.financeiro_transferencias_contas(empresa_id,conta_origem_id,conta_destino_id,valor,data_transferencia,descricao,comprovante_referencia,idempotency_key,criado_por)
  SELECT empresa_id,origem_id,destino_id,valor,'2026-09-01','Correção do destino da comissão paga ao sócio','Pagamento 871098fa-555f-4081-b67b-60000b608785','correcao-destino-comissao:871098fa-555f-4081-b67b-60000b608785',NULL
  FROM dados ON CONFLICT (empresa_id,idempotency_key) DO NOTHING RETURNING *
)
INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,transferencia_conta_id,idempotency_key,criado_por)
SELECT n.empresa_id,x.conta_id,x.tipo,'TRANSFERENCIA_INTERNA',n.valor,n.data_transferencia,n.descricao,n.id,x.chave,NULL
FROM nova n CROSS JOIN LATERAL (VALUES
  (n.conta_origem_id,'SAIDA'::text,'correcao-destino-saida:'||n.id::text),
  (n.conta_destino_id,'ENTRADA'::text,'correcao-destino-entrada:'||n.id::text)
) x(conta_id,tipo,chave)
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

COMMIT;
