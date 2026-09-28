-- 298: Acerto inicial auditável dos sócios e entradas sem imposto.
-- Preserva o histórico; apenas corrige classificações que não representam a
-- origem econômica informada pelos sócios.
BEGIN;

-- Receita de evento é entrada operacional da empresa e não gera reserva
-- fiscal de comissão. A rotina bancária continua exigindo conta e comprovante.
CREATE OR REPLACE FUNCTION public.rpc_registrar_movimento_bancario(
  p_empresa_id uuid,p_conta_id uuid,p_tipo text,p_categoria text,p_valor numeric,
  p_data date,p_descricao text,p_comprovante text,p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_id uuid; v_caixa_id uuid; v_usuario uuid := public.current_usuario_id();
BEGIN
  IF NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira'; END IF;
  IF p_tipo NOT IN ('ENTRADA','SAIDA') OR p_categoria NOT IN ('APORTE_SOCIO','EMPRESTIMO','RECEITA_DIVERSA','RECEITA_EVENTO','DESPESA','AJUSTE') THEN RAISE EXCEPTION 'Tipo ou categoria inválida'; END IF;
  IF p_valor IS NULL OR p_valor<=0 OR p_data IS NULL OR length(trim(coalesce(p_descricao,'')))<3 OR length(trim(coalesce(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Dados inválidos para movimento bancário'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_id AND empresa_id=p_empresa_id AND ativo) THEN RAISE EXCEPTION 'Conta bancária inválida'; END IF;
  SELECT id INTO v_id FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('movimento_id',v_id,'reused',true); END IF;
  INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
  VALUES(p_empresa_id,lower(p_tipo),'ajuste_caixa',NULL,p_data,to_char(p_data,'YYYY-MM'),p_valor,trim(p_descricao)) RETURNING id INTO v_caixa_id;
  INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,caixa_movimento_id,comprovante_referencia,idempotency_key,criado_por)
  VALUES(p_empresa_id,p_conta_id,p_tipo,p_categoria,p_valor,p_data,trim(p_descricao),v_caixa_id,nullif(trim(p_comprovante),''),p_idempotency_key,v_usuario)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('movimento_id',v_id,'reused',false);
END $$;

-- As contas que Eroni apenas operou com recursos da empresa não são aporte dele.
UPDATE public.financeiro_contas_pagar
SET pago_pessoalmente=false,
    socio_pagador_usuario_id=NULL,
    pagador_operacional='EMPRESA',
    origem_recurso_economico='CAIXA_LIVRE_EMPRESA',
    valor_recurso_proprio=0,
    valor_recurso_comissao_retida=0,
    updated_at=now()
WHERE empresa_id='7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND status='paga'
  AND socio_pagador_usuario_id='b12a20d7-14e8-4480-bd18-9faf88f07b07'::uuid
  AND origem_recurso_economico='CAIXA_LIVRE_EMPRESA'
  AND pagador_operacional='EMPRESA';

-- O lançamento histórico de R$ 9.300 inferia uma comissão de Fernando usada
-- nas despesas. O sócio confirmou R$ 9.790,61 de dinheiro próprio, portanto
-- essa inferência é anulada, sem apagar seus dois registros originais.
UPDATE public.socio_conta_corrente_movimentos
SET estornado=true,
    descricao=descricao||' [ANULADO NO ACERTO INICIAL: a origem correta é dinheiro próprio de Fernando, R$ 9.790,61.]'
WHERE empresa_id='7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND origem_tipo='classificacao_historica'
  AND valor=9300
  AND NOT estornado;

-- O recebimento é append-only. Completa-se a trilha de extrato por um novo
-- movimento idempotente na conta PJ, preservando o texto original do PDF.
INSERT INTO public.financeiro_conta_movimentos(
  empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,recebimento_id,idempotency_key,criado_por
) VALUES (
  '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
  'b4d93ad8-50be-4bfb-b6e5-eaa604a3f235'::uuid,
  'ENTRADA','REPASSE_ADMINISTRADORA',17961.66,'2026-09-17',
  'Repasse Racon setembro/2026 — PEDIDO DE COMPRA 15-9.pdf',
  '3fb9c2bb-e1e1-4796-ac45-ebeb13faab5b'::uuid,
  'repasse-empresa:3fb9c2bb-e1e1-4796-ac45-ebeb13faab5b',NULL
) ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

COMMIT;
NOTIFY pgrst,'reload schema';
