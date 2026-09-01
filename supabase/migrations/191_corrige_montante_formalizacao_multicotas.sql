-- 191: quando grupo, produto e quantidade estao corretos, a formalizacao
-- multicotas reconcilia o montante total com o valor canonico de cada cota.
BEGIN;

DO $migration$
DECLARE
  v_assinatura regprocedure :=
    'public.rpc_converter_contratacao_venda_multicotas(uuid,uuid,integer,text)'::regprocedure;
  v_definicao text;
  v_validacao_antiga text := $sql$
  IF abs(v_credito_total - (v_opcao.valor_credito * p_quantidade_cotas)) > 0.05 THEN
    RAISE EXCEPTION 'Crédito total aceito não corresponde ao produto multiplicado pela quantidade de cotas';
  END IF;
$sql$;
  v_reconciliacao text := $sql$
  IF abs(v_credito_total - (v_opcao.valor_credito * p_quantidade_cotas)) > 0.05 THEN
    INSERT INTO public.contratacoes_formalizacao_historico(
      empresa_id, contratacao_id, evento, descricao, dados
    ) VALUES (
      p_empresa_id,
      p_contratacao_id,
      'DADOS_COMERCIAIS_AJUSTADOS',
      'Montante total reconciliado pelo produto canônico e pela quantidade de cotas antes da formalização.',
      jsonb_build_object(
        'campo', 'credito_selecionado',
        'valor_anterior', v_credito_total,
        'valor_unitario_canonico', v_opcao.valor_credito,
        'quantidade_cotas', p_quantidade_cotas,
        'valor_corrigido', round(v_opcao.valor_credito * p_quantidade_cotas, 2),
        'motivo', 'RECONCILIACAO_PRODUTO_QUANTIDADE'
      )
    );
  END IF;

  -- Grupo, produto e quantidade validados são a fonte operacional do montante.
  v_credito_total := round(v_opcao.valor_credito * p_quantidade_cotas, 2);
$sql$;
  v_update_antigo text := $sql$
  UPDATE public.contratacoes_online SET
    quantidade_cotas = p_quantidade_cotas,
    dados_simulacao = COALESCE(dados_simulacao, '{}'::jsonb)
      || jsonb_build_object('quantidade_cotas_formalizacao', p_quantidade_cotas),
    updated_at = now()
  WHERE id = p_contratacao_id
    AND empresa_id = p_empresa_id;
$sql$;
  v_update_novo text := $sql$
  UPDATE public.contratacoes_online SET
    quantidade_cotas = p_quantidade_cotas,
    credito_selecionado = v_credito_total,
    dados_simulacao = COALESCE(dados_simulacao, '{}'::jsonb)
      || jsonb_build_object(
        'quantidade_cotas_formalizacao', p_quantidade_cotas,
        'credito_total_formalizacao', v_credito_total,
        'credito_unitario_formalizacao', v_opcao.valor_credito
      ),
    updated_at = now()
  WHERE id = p_contratacao_id
    AND empresa_id = p_empresa_id;
$sql$;
  v_venda_atualizada_antiga text := $sql$
  WHERE id = v_venda.id
  RETURNING * INTO v_venda;

  UPDATE public.cotas_definitivas SET
$sql$;
  v_venda_atualizada_nova text := $sql$
  WHERE id = v_venda.id
  RETURNING * INTO v_venda;

  -- O núcleo cria a primeira previsão antes de conhecer a cardinalidade total.
  -- Reconstrói imediatamente, ainda sem movimentação financeira, sobre o total
  -- reconciliado; o trigger multicotas apenas distribui esse total entre as cotas.
  IF NOT COALESCE((v_core->>'reused')::boolean, false) THEN
    v_core := jsonb_set(
      v_core,
      '{previsoes}',
      public.rpc_gerar_previsoes_comissao_v2(
        p_empresa_id,
        v_venda.id,
        p_idempotency_key || ':credito-total-multicotas'
      ),
      true
    );
  END IF;

  UPDATE public.cotas_definitivas SET
$sql$;
BEGIN
  SELECT pg_get_functiondef(v_assinatura) INTO v_definicao;

  IF position(v_validacao_antiga IN v_definicao) = 0 THEN
    RAISE EXCEPTION
      'Validação esperada não encontrada em rpc_converter_contratacao_venda_multicotas';
  END IF;
  IF position(v_update_antigo IN v_definicao) = 0 THEN
    RAISE EXCEPTION
      'Atualização esperada não encontrada em rpc_converter_contratacao_venda_multicotas';
  END IF;
  IF position(v_venda_atualizada_antiga IN v_definicao) = 0 THEN
    RAISE EXCEPTION
      'Ponto de reconstrução das comissões não encontrado na RPC multicotas';
  END IF;

  v_definicao := replace(v_definicao, v_validacao_antiga, v_reconciliacao);
  v_definicao := replace(v_definicao, v_update_antigo, v_update_novo);
  v_definicao := replace(
    v_definicao,
    v_venda_atualizada_antiga,
    v_venda_atualizada_nova
  );

  IF position('UPDATE public.operacoes_idempotentes' IN v_definicao) > 0 THEN
    RAISE EXCEPTION 'A RPC multicotas não pode alterar o ledger de idempotência append-only';
  END IF;

  EXECUTE v_definicao;
END
$migration$;

COMMENT ON FUNCTION public.rpc_converter_contratacao_venda_multicotas(uuid,uuid,integer,text)
IS 'Formaliza uma venda em N cotas e reconcilia, com auditoria, o montante pelo produto canônico multiplicado pela quantidade.';

COMMIT;
NOTIFY pgrst, 'reload schema';
