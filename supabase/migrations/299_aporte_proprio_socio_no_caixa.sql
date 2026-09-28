-- 299: aporte real de dinheiro próprio, separado de comissão retida.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_registrar_aporte_proprio_socio_servidor(
  p_empresa_id uuid, p_socio_id uuid, p_conta_bancaria_id uuid,
  p_valor numeric, p_data date, p_descricao text, p_comprovante text,
  p_idempotency_key text, p_auth_user_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_usuario uuid; v_socio record; v_caixa uuid; v_movimento uuid; v_ledger uuid;
BEGIN
  IF current_setting('request.jwt.claim.role',true) IS DISTINCT FROM 'service_role' OR p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'O aporte só pode ser registrado pelo servidor autorizado';
  END IF;
  IF p_valor IS NULL OR p_valor<=0 OR round(p_valor,2)<>p_valor OR p_data IS NULL
    OR length(trim(coalesce(p_descricao,'')))<3 OR length(trim(coalesce(p_comprovante,'')))<5 THEN
    RAISE EXCEPTION 'Informe valor, data, descrição e referência do depósito';
  END IF;
  SELECT u.id INTO v_usuario FROM public.usuarios u JOIN public.empresa_usuarios eu ON eu.usuario_id=u.id
  WHERE u.auth_user_id=p_auth_user_id AND u.ativo AND eu.empresa_id=p_empresa_id AND eu.ativo LIMIT 1;
  IF v_usuario IS NULL THEN RAISE EXCEPTION 'Usuário sem vínculo ativo com a empresa'; END IF;
  SELECT s.* INTO v_socio FROM public.empresa_socios s WHERE s.id=p_socio_id AND s.empresa_id=p_empresa_id AND s.ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sócio inválido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financeiro_contas_bancarias b WHERE b.id=p_conta_bancaria_id AND b.empresa_id=p_empresa_id AND b.ativo) THEN
    RAISE EXCEPTION 'Conta da empresa inválida';
  END IF;
  SELECT id INTO v_movimento FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key='aporte-proprio:mov:'||p_idempotency_key;
  IF FOUND THEN RETURN v_movimento; END IF;
  INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
  VALUES(p_empresa_id,'entrada','aporte_socio',p_socio_id,p_data,to_char(p_data,'YYYY-MM'),p_valor,trim(p_descricao)) RETURNING id INTO v_caixa;
  INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,caixa_movimento_id,comprovante_referencia,idempotency_key,criado_por)
  VALUES(p_empresa_id,p_conta_bancaria_id,'ENTRADA','APORTE_SOCIO',p_valor,p_data,trim(p_descricao),v_caixa,trim(p_comprovante),'aporte-proprio:mov:'||p_idempotency_key,v_usuario)
  RETURNING id INTO v_movimento;
  INSERT INTO public.socio_conta_corrente_movimentos(empresa_id,socio_id,usuario_id,data_movimento,competencia,natureza,tipo_movimento,valor,saldo_apos,descricao,origem_tipo,origem_id,idempotency_key,criado_por)
  VALUES(p_empresa_id,p_socio_id,v_socio.usuario_id,p_data,to_char(p_data,'YYYY-MM'),'CREDITO','TRANSFERENCIA_APORTE',p_valor,0,
    'Dinheiro próprio colocado na conta da empresa: '||trim(p_descricao),'aporte_dinheiro_proprio',v_movimento,'aporte-proprio:ledger:'||p_idempotency_key,v_usuario)
  RETURNING id INTO v_ledger;
  RETURN v_movimento;
END $$;

REVOKE ALL ON FUNCTION public.rpc_registrar_aporte_proprio_socio_servidor(uuid,uuid,uuid,numeric,date,text,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_aporte_proprio_socio_servidor(uuid,uuid,uuid,numeric,date,text,text,text,uuid) TO service_role;
COMMIT;
NOTIFY pgrst,'reload schema';
