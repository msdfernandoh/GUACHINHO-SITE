-- 197 — Divergência de repasse com decisões explícitas e auditáveis.
-- CPF/telefone continuam sendo pendências exclusivas do cadastro do cliente;
-- o cadastro mínimo já conclui atomicamente cliente, cota, comissão e vínculo.

BEGIN;

ALTER TABLE public.erp_repasse_atencao_resolucoes
  DROP CONSTRAINT IF EXISTS erp_repasse_atencao_resolucoes_decisao_check;
ALTER TABLE public.erp_repasse_atencao_resolucoes
  ADD CONSTRAINT erp_repasse_atencao_resolucoes_decisao_check
  CHECK (decisao IN ('AGUARDAR_PROXIMO','GERAR_CREDITO','AJUSTAR_DIFERENCA','MANTER_COMO_ESTA','CANCELAR_COTA'));

CREATE OR REPLACE FUNCTION public.rpc_resolver_atencao_repasse(
  p_empresa_id uuid,
  p_previsao_franquia_id uuid,
  p_decisao text,
  p_importacao_id uuid DEFAULT NULL,
  p_item_importacao_id uuid DEFAULT NULL,
  p_valor_ajuste numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_previsao public.comissao_previsoes_franquia%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_existente public.erp_repasse_atencao_resolucoes%ROWTYPE;
  v_recebido_item numeric := 0;
  v_valor_sistema numeric := 0;
  v_valor_relatorio numeric := NULL;
  v_diferenca numeric := 0;
  v_ajuste numeric := 0;
  v_tipo text;
  v_idempotency text;
  v_cancelamento jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para resolver atenções de repasse nesta empresa';
  END IF;
  IF p_decisao NOT IN ('AGUARDAR_PROXIMO','GERAR_CREDITO','AJUSTAR_DIFERENCA','MANTER_COMO_ESTA','CANCELAR_COTA') THEN
    RAISE EXCEPTION 'Decisão de repasse inválida';
  END IF;
  IF length(trim(coalesce(p_motivo,''))) > 500 THEN RAISE EXCEPTION 'Motivo deve ter no máximo 500 caracteres'; END IF;

  v_idempotency := coalesce(nullif(trim(p_idempotency_key),''),
    p_decisao||':'||p_previsao_franquia_id::text||':'||coalesce(p_item_importacao_id::text,'sem-item'));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':REPASSE_ATENCAO:'||v_idempotency,0));
  SELECT * INTO v_existente FROM public.erp_repasse_atencao_resolucoes
  WHERE empresa_id=p_empresa_id AND idempotency_key=v_idempotency;
  IF v_existente.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'idempotente',true,'resolucao_id',v_existente.id,'decisao',v_existente.decisao);
  END IF;

  SELECT * INTO v_previsao FROM public.comissao_previsoes_franquia
  WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_previsao.id IS NULL THEN RAISE EXCEPTION 'Comissão do sistema não encontrada no tenant'; END IF;

  IF p_importacao_id IS NOT NULL THEN
    SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
    WHERE id=p_importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
    IF v_importacao.id IS NULL OR v_importacao.administradora_id<>v_previsao.administradora_id THEN
      RAISE EXCEPTION 'Relatório incompatível com a comissão selecionada';
    END IF;
  END IF;

  IF p_item_importacao_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
    WHERE id=p_item_importacao_id AND empresa_id=p_empresa_id
      AND (p_importacao_id IS NULL OR importacao_id=p_importacao_id)
    FOR UPDATE;
    IF v_item.id IS NULL THEN RAISE EXCEPTION 'Linha do relatório não encontrada no tenant'; END IF;
    IF v_item.previsao_franquia_id IS NOT NULL AND v_item.previsao_franquia_id<>v_previsao.id THEN
      RAISE EXCEPTION 'A linha já está vinculada a outra comissão';
    END IF;
    IF v_item.previsao_franquia_id IS NULL
       AND v_item.previsao_sugerida_id IS NOT NULL
       AND v_item.previsao_sugerida_id<>v_previsao.id THEN
      RAISE EXCEPTION 'A comissão escolhida difere da sugestão conferida';
    END IF;
    v_valor_relatorio := v_item.valor_comissao;
    IF v_importacao.recebimento_id IS NOT NULL THEN
      SELECT coalesce(sum(ri.valor_liquidado),0) INTO v_recebido_item
      FROM public.financeiro_recebimento_itens ri
      WHERE ri.recebimento_id=v_importacao.recebimento_id
        AND ri.previsao_franquia_id=v_previsao.id;
    END IF;
    v_valor_sistema := greatest(v_previsao.valor_previsto-coalesce(v_previsao.valor_liquidado,0)+v_recebido_item,0);
    v_tipo := 'VALOR_DIVERGENTE';
  ELSE
    v_valor_sistema := greatest(v_previsao.valor_previsto-coalesce(v_previsao.valor_liquidado,0),0);
    v_tipo := 'SISTEMA_SEM_RELATORIO';
  END IF;
  v_diferenca := round(v_valor_sistema-coalesce(v_valor_relatorio,0),2);

  IF p_decisao IN ('GERAR_CREDITO','AJUSTAR_DIFERENCA','MANTER_COMO_ESTA') THEN
    IF v_item.id IS NULL THEN RAISE EXCEPTION 'A decisão exige uma linha do relatório'; END IF;
    IF abs(v_diferenca)<=0.02 THEN RAISE EXCEPTION 'A linha não possui diferença financeira a resolver'; END IF;
    IF p_decisao='GERAR_CREDITO' AND v_diferenca<=0 THEN
      RAISE EXCEPTION 'Crédito só é permitido quando o valor do sistema é maior que o relatório';
    END IF;
    -- Toda decisão conclui o vínculo. Dados cadastrais incompletos do cliente não participam desta validação.
    IF v_item.previsao_franquia_id IS NULL THEN
      PERFORM public.rpc_vincular_item_repasse_manual(p_empresa_id,v_item.id,v_previsao.id);
    END IF;
    IF p_decisao='AJUSTAR_DIFERENCA' THEN
      v_ajuste:=coalesce(p_valor_ajuste,abs(v_diferenca));
      IF abs(v_ajuste-abs(v_diferenca))>0.02 THEN
        RAISE EXCEPTION 'O ajuste deve resolver exatamente a diferença de %',abs(v_diferenca);
      END IF;
      -- Quando o relatório supera o previsto, a parcela excedente precisa ser classificada no livro.
      -- Quando o sistema supera o relatório, a resolução append-only encerra o saldo operacional
      -- sem reescrever o snapshot histórico da regra de comissão.
      IF v_diferenca<0 THEN
        PERFORM public.rpc_conciliar_recebimento_manual(
          p_empresa_id,v_importacao.recebimento_id,'[]'::jsonb,
          jsonb_build_array(jsonb_build_object('tipo','AJUSTE_ADMINISTRADORA','valor',v_ajuste,
            'descricao','Sistema ajustado ao valor do relatório, linha '||v_item.linha||': '||coalesce(nullif(trim(p_motivo),''),'sem observação'))),
          'repasse-ajuste-sistema:'||v_idempotency
        );
      END IF;
    END IF;
  ELSIF p_decisao='CANCELAR_COTA' THEN
    IF v_previsao.cota_definitiva_id IS NULL THEN RAISE EXCEPTION 'A comissão não possui cota para cancelar'; END IF;
    IF length(trim(coalesce(p_motivo,'')))<5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento da cota'; END IF;
    v_cancelamento:=public.rpc_cancelar_cota_com_estorno(
      p_empresa_id,v_previsao.cota_definitiva_id,trim(p_motivo),current_date);
  END IF;

  INSERT INTO public.erp_repasse_atencao_resolucoes(
    empresa_id,importacao_id,item_importacao_id,previsao_franquia_id,tipo,decisao,
    valor_sistema,valor_relatorio,valor_diferenca,motivo,idempotency_key,resolvido_por_usuario_id
  ) VALUES(
    p_empresa_id,p_importacao_id,p_item_importacao_id,p_previsao_franquia_id,v_tipo,p_decisao,
    v_valor_sistema,v_valor_relatorio,v_diferenca,nullif(trim(coalesce(p_motivo,'')),''),v_idempotency,public.current_usuario_id()
  ) RETURNING * INTO v_existente;

  RETURN jsonb_build_object('ok',true,'idempotente',false,'resolucao_id',v_existente.id,
    'decisao',p_decisao,'valor_sistema',v_valor_sistema,'valor_relatorio',v_valor_relatorio,
    'diferenca',v_diferenca,'cancelamento',v_cancelamento);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resolver_atencao_repasse(uuid,uuid,text,uuid,uuid,numeric,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_resolver_atencao_repasse(uuid,uuid,text,uuid,uuid,numeric,text,text)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
