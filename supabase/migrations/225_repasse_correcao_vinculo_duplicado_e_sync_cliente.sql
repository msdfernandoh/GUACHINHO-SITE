-- 225_repasse_correcao_vinculo_duplicado_e_sync_cliente.sql
-- 1. Remove trigger duplicado de baixa automatica em itens de repasse que causava estouro de saldo
-- 2. Protege recalculacao e sincronizacao canonica contra estouro de saldo e duplicacoes
-- 3. Sincroniza alteracoes cadastrais de clientes para a tabela vendas em tempo real
-- 4. Corrige vendas e limpa alertas obsoletos de divergencia de nome

BEGIN;

-- 1. Desativar trigger redundante da migration 186 que duplicava baixas ao vincular manualmente
DROP TRIGGER IF EXISTS trg_repasse_item_baixa_automatica ON public.erp_repasse_importacao_itens;

-- Ajustar a funcao do trigger para que nao dispare em itens
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
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Recalculo de liquidacao protegido contra violacao da check constraint (valor_liquidado <= valor_previsto)
CREATE OR REPLACE FUNCTION public.recalcular_liquidacao_previsao_repasse_203(
  p_empresa_id uuid,
  p_previsao_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previsao public.comissao_previsoes_franquia%ROWTYPE;
  v_liquidado numeric(14,2);
  v_proporcao numeric;
BEGIN
  SELECT * INTO v_previsao
  FROM public.comissao_previsoes_franquia
  WHERE id = p_previsao_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  SELECT round(greatest(COALESCE(sum(valor_liquidado), 0), 0), 2)
  INTO v_liquidado
  FROM public.financeiro_recebimento_itens fri
  JOIN public.financeiro_recebimentos fr ON fr.id = fri.recebimento_id
  WHERE fr.empresa_id = p_empresa_id AND fri.previsao_franquia_id = p_previsao_id;

  -- Defesa rigorosa: o valor liquidado nunca pode ultrapassar o valor previsto da previsao
  v_liquidado := round(least(v_liquidado, v_previsao.valor_previsto), 2);

  UPDATE public.comissao_previsoes_franquia
  SET valor_liquidado = v_liquidado,
      status = CASE
        WHEN v_liquidado <= 0 THEN 'prevista'
        WHEN v_liquidado + 0.009 >= valor_previsto THEN 'liquidada'
        ELSE 'parcialmente_liquidada'
      END,
      updated_at = now()
  WHERE id = p_previsao_id;

  v_proporcao := CASE
    WHEN COALESCE(v_previsao.valor_previsto, 0) > 0
      THEN least(1, v_liquidado / v_previsao.valor_previsto)
    ELSE 0
  END;

  UPDATE public.comissao_previsoes_participantes
  SET valor_elegivel = greatest(
        COALESCE(valor_pago, 0),
        round(COALESCE(valor_previsto, 0) * v_proporcao, 2)
      ),
      status = CASE
        WHEN COALESCE(valor_pago, 0) > 0 AND COALESCE(valor_pago, 0) + 0.009 >= COALESCE(valor_previsto, 0) THEN 'paga'
        WHEN COALESCE(valor_pago, 0) > 0 THEN 'parcialmente_paga'
        WHEN round(COALESCE(valor_previsto, 0) * v_proporcao, 2) + 0.009 >= COALESCE(valor_previsto, 0) AND COALESCE(valor_previsto, 0) > 0 THEN 'elegivel'
        WHEN round(COALESCE(valor_previsto, 0) * v_proporcao, 2) > 0 THEN 'parcialmente_elegivel'
        ELSE 'prevista'
      END,
      updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND previsao_franquia_id = p_previsao_id;
END;
$$;

-- 3. Sincronizacao canonica protegida contra duplicacao em financeiro_recebimento_itens
CREATE OR REPLACE FUNCTION public.sincronizar_item_repasse_canonico_203(
  p_empresa_id uuid,
  p_item_id uuid,
  p_usuario_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_previsao public.comissao_previsoes_franquia%ROWTYPE;
  v_atual numeric(14,2);
  v_fri_atual numeric(14,2);
  v_desejado numeric(14,2);
  v_delta numeric(14,2);
  v_recebido numeric(14,2);
  v_classificado numeric(14,2);
  v_rateio_total numeric(14,2);
  v_percentual numeric(8,4);
  v_imposto numeric(14,2);
  v_liquido numeric(14,2);
  v_antigo_liquido numeric(14,2);
  v_key text;
  v_p record;
  v_razao numeric;
  v_novo_p numeric(14,2);
  v_bruto_p numeric(14,2);
BEGIN
  SELECT * INTO v_item
  FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND OR v_item.previsao_franquia_id IS NULL THEN
    RAISE EXCEPTION 'Item de repasse sem previsao vinculada';
  END IF;

  SELECT * INTO v_importacao
  FROM public.erp_repasse_importacoes
  WHERE id = v_item.importacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN
    RAISE EXCEPTION 'Importacao sem recebimento financeiro';
  END IF;

  SELECT * INTO v_previsao
  FROM public.comissao_previsoes_franquia
  WHERE id = v_item.previsao_franquia_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Previsao vinculada nao encontrada'; END IF;

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_atual
  FROM public.erp_repasse_item_baixas
  WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_fri_atual
  FROM public.financeiro_recebimento_itens
  WHERE recebimento_id = v_importacao.recebimento_id
    AND previsao_franquia_id = v_item.previsao_franquia_id;

  -- Se ja houver lancamento para este recebimento e previsao, considera o maior valor para evitar duplicar
  v_atual := greatest(v_atual, v_fri_atual);

  v_desejado := round(v_item.valor_comissao, 2);
  v_delta := round(v_desejado - v_atual, 2);

  IF v_delta > 0 THEN
    SELECT valor_total INTO v_recebido
    FROM public.financeiro_recebimentos
    WHERE id = v_importacao.recebimento_id AND empresa_id = p_empresa_id
    FOR UPDATE;

    SELECT round(COALESCE(sum(valor), 0), 2) INTO v_classificado
    FROM public.financeiro_recebimento_classificacoes
    WHERE recebimento_id = v_importacao.recebimento_id AND empresa_id = p_empresa_id;

    SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_rateio_total
    FROM public.financeiro_recebimento_itens
    WHERE recebimento_id = v_importacao.recebimento_id;

    IF v_delta > round(COALESCE(v_recebido, 0) - v_classificado - v_rateio_total, 2) + 0.009 THEN
      RAISE EXCEPTION 'Saldo do recebimento insuficiente para completar a linha do relatorio';
    END IF;
  END IF;

  IF abs(v_delta) >= 0.01 THEN
    v_key := 'sync-203:' || p_item_id::text || ':' || v_item.previsao_franquia_id::text || ':' || md5(v_atual::text || ':' || v_desejado::text);

    INSERT INTO public.financeiro_recebimento_itens (
      recebimento_id, previsao_franquia_id, valor_liquidado
    ) VALUES (
      v_importacao.recebimento_id, v_item.previsao_franquia_id, v_delta
    );

    INSERT INTO public.erp_repasse_item_baixas (
      empresa_id, item_importacao_id, recebimento_id, previsao_franquia_id,
      valor_liquidado, evento, idempotency_key, criado_por
    ) VALUES (
      p_empresa_id, p_item_id, v_importacao.recebimento_id, v_item.previsao_franquia_id,
      v_delta, 'SINCRONIZACAO', v_key, p_usuario_id
    ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
  END IF;

  v_percentual := COALESCE(v_previsao.percentual_imposto, 0);
  v_imposto := round(v_desejado * v_percentual / 100, 2);
  v_liquido := round(v_desejado - v_imposto, 2);
  v_antigo_liquido := greatest(COALESCE(v_previsao.valor_liquido, v_previsao.valor_previsto, 0), 0.01);

  UPDATE public.comissao_previsoes_franquia
  SET valor_bruto = v_desejado,
      valor_previsto = v_desejado,
      base_calculo_valor = v_desejado,
      valor_imposto = v_imposto,
      valor_liquido = v_liquido,
      snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'repasse_canonico_203', jsonb_build_object(
          'valor_bruto', v_desejado, 'valor_imposto', v_imposto,
          'valor_liquido', v_liquido, 'origem_valor', 'ITEM_RELATORIO_REPASSE',
          'item_importacao_id', p_item_id, 'sincronizado_em', now()
        )
      ),
      updated_at = now()
  WHERE id = v_item.previsao_franquia_id;

  FOR v_p IN
    SELECT * FROM public.comissao_previsoes_participantes
    WHERE empresa_id = p_empresa_id AND previsao_franquia_id = v_item.previsao_franquia_id
    ORDER BY id FOR UPDATE
  LOOP
    v_razao := CASE
      WHEN COALESCE(v_p.snapshot_regra->'fiscal_lote'->>'valor_bruto', '') ~ '^[0-9]+([.][0-9]+)?$'
        AND COALESCE(v_previsao.valor_bruto, 0) > 0
        THEN (v_p.snapshot_regra->'fiscal_lote'->>'valor_bruto')::numeric / v_previsao.valor_bruto
      ELSE COALESCE(v_p.valor_previsto, 0) / v_antigo_liquido
    END;
    v_bruto_p := round(v_desejado * v_razao, 2);
    v_novo_p := round(v_liquido * v_razao, 2);
    IF COALESCE(v_p.valor_pago, 0) > v_novo_p + 0.009 THEN
      RAISE EXCEPTION 'Ajuste reduziria uma comissao ja paga';
    END IF;
    UPDATE public.comissao_previsoes_participantes
    SET valor_previsto = v_novo_p,
        base_calculo_valor = v_desejado,
        snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
          'repasse_canonico_203', jsonb_build_object(
            'origem_valor', 'PREVISAO_FRANQUIA_CANONICA',
            'previsao_franquia_id', v_item.previsao_franquia_id,
            'item_importacao_id', p_item_id,
            'sincronizado_em', now()
          ),
          'fiscal_lote', COALESCE(snapshot_regra->'fiscal_lote', '{}'::jsonb) || jsonb_build_object(
            'valor_bruto', v_bruto_p,
            'imposto_valor', round(v_bruto_p - v_novo_p, 2),
            'valor_liquido', v_novo_p,
            'imposto_aliquota', v_percentual
          )
        ),
        updated_at = now()
    WHERE id = v_p.id;
  END LOOP;

  PERFORM public.recalcular_liquidacao_previsao_repasse_203(p_empresa_id, v_item.previsao_franquia_id);

  SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_atual
  FROM public.erp_repasse_item_baixas
  WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;
  RETURN v_atual;
END;
$$;

-- 4. rpc_corrigir_vinculo_item_repasse atualizada para limpar alertas de divergencia ao vincular manualmente
CREATE OR REPLACE FUNCTION public.rpc_corrigir_vinculo_item_repasse(
  p_empresa_id uuid,
  p_item_id uuid,
  p_nova_previsao_franquia_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_anterior uuid;
  v_alocacao numeric(14,2);
  v_vinculado numeric(14,2);
  v_key text := COALESCE(NULLIF(trim(p_idempotency_key), ''), 'corrigir-vinculo:' || p_item_id::text || ':' || p_nova_previsao_franquia_id::text);
BEGIN
  IF v_usuario IS NOT NULL AND NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de repasse nao encontrado'; END IF;

  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id = v_item.importacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN RAISE EXCEPTION 'Recebimento do relatorio nao encontrado'; END IF;

  PERFORM 1 FROM public.comissao_previsoes_franquia
  WHERE id = p_nova_previsao_franquia_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nova previsao nao encontrada'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.erp_repasse_importacao_itens
    WHERE empresa_id = p_empresa_id AND previsao_franquia_id = p_nova_previsao_franquia_id AND id <> p_item_id
  ) THEN RAISE EXCEPTION 'Esta previsao ja esta vinculada a outra linha de relatorio'; END IF;

  v_anterior := v_item.previsao_franquia_id;

  IF v_anterior IS DISTINCT FROM p_nova_previsao_franquia_id THEN
    IF EXISTS (
      SELECT 1 FROM public.comissao_previsoes_participantes
      WHERE empresa_id = p_empresa_id
        AND previsao_franquia_id IN (v_anterior, p_nova_previsao_franquia_id)
        AND COALESCE(valor_pago, 0) > 0
    ) THEN RAISE EXCEPTION 'Nao e permitido trocar previsao com comissao ja paga'; END IF;

    SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_alocacao
    FROM public.erp_repasse_item_baixas
    WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;

    IF abs(v_alocacao) >= 0.01 AND v_anterior IS NOT NULL THEN
      INSERT INTO public.financeiro_recebimento_itens (
        recebimento_id, previsao_franquia_id, valor_liquidado
      ) VALUES (
        v_importacao.recebimento_id, v_anterior, -v_alocacao
      );

      INSERT INTO public.erp_repasse_item_baixas (
        empresa_id, item_importacao_id, recebimento_id, previsao_franquia_id,
        valor_liquidado, evento, idempotency_key, criado_por
      ) VALUES (
        p_empresa_id, p_item_id, v_importacao.recebimento_id, v_anterior,
        -v_alocacao, 'REVERSAO', v_key || ':reversao', v_usuario
      ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.erp_repasse_importacao_itens
    SET previsao_franquia_id = p_nova_previsao_franquia_id,
        previsao_sugerida_id = p_nova_previsao_franquia_id,
        status_conciliacao = 'VINCULADO_MANUAL',
        alertas = '[]'::jsonb,
        venda_id = (SELECT venda_id FROM public.comissao_previsoes_franquia WHERE id = p_nova_previsao_franquia_id),
        vinculado_por_usuario_id = public.current_usuario_id(),
        vinculado_em = now(),
        updated_at = now()
    WHERE id = p_item_id;

    IF v_anterior IS NOT NULL THEN
      INSERT INTO public.erp_repasse_vinculo_correcoes (
        empresa_id, item_importacao_id, recebimento_id, previsao_anterior_id,
        previsao_nova_id, valor_baixa_transferido, idempotency_key, corrigido_por_usuario_id
      ) VALUES (
        p_empresa_id, p_item_id, v_importacao.recebimento_id, v_anterior,
        p_nova_previsao_franquia_id, greatest(COALESCE(v_alocacao, 0), 0),
        v_key, public.current_usuario_id()
      ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
    END IF;

    IF v_anterior IS NOT NULL THEN
      PERFORM public.recalcular_liquidacao_previsao_repasse_203(p_empresa_id, v_anterior);
    END IF;
  END IF;

  v_vinculado := public.sincronizar_item_repasse_canonico_203(p_empresa_id, p_item_id, v_usuario);

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'previsao_anterior_id', v_anterior,
    'previsao_nova_id', p_nova_previsao_franquia_id,
    'valor_vinculado', v_vinculado,
    'valor_relatorio', v_item.valor_comissao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_corrigir_vinculo_item_repasse(uuid, uuid, uuid, text) TO authenticated, service_role;

-- 5. Trigger para sincronizar atualizacoes da tabela clientes para vendas em tempo real
CREATE OR REPLACE FUNCTION public.sync_cliente_para_vendas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.vendas
  SET cliente_nome = trim(NEW.nome),
      cliente_cpf_cnpj = COALESCE(NULLIF(regexp_replace(COALESCE(NEW.cpf_cnpj, ''), '\D', '', 'g'), ''), cliente_cpf_cnpj),
      cliente_telefone = COALESCE(NEW.telefone, cliente_telefone),
      cliente_email = COALESCE(NEW.email, cliente_email),
      updated_at = now()
  WHERE cliente_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cliente_para_vendas ON public.clientes;
CREATE TRIGGER trg_sync_cliente_para_vendas
  AFTER UPDATE OF nome, cpf_cnpj, telefone, email ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.sync_cliente_para_vendas();

-- 6. Backfill retroativo: sincronizar nomes das vendas a partir dos clientes cadastrados
UPDATE public.vendas v
SET cliente_nome = trim(c.nome),
    cliente_cpf_cnpj = COALESCE(NULLIF(regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g'), ''), v.cliente_cpf_cnpj),
    cliente_telefone = COALESCE(c.telefone, v.cliente_telefone),
    cliente_email = COALESCE(c.email, v.cliente_email),
    updated_at = now()
FROM public.clientes c
WHERE v.cliente_id = c.id
  AND (
    v.cliente_nome IS DISTINCT FROM trim(c.nome)
    OR v.cliente_cpf_cnpj IS DISTINCT FROM NULLIF(regexp_replace(COALESCE(c.cpf_cnpj, ''), '\D', '', 'g'), '')
  );

-- 7. Limpar alertas obsoletos de divergencia para itens cujo nome coincide com o cliente
UPDATE public.erp_repasse_importacao_itens
SET alertas = '[]'::jsonb,
    updated_at = now()
WHERE (
  cliente_nome ILIKE '%JANSER CARMOS AMARAL%'
  OR id IN ('34d5b98c-b189-4365-92ac-be78f8015766', '98dfcaea-25b5-422d-87d0-5b4da7803bc4')
)
AND alertas = jsonb_build_array('Nome do cliente diverge do cadastro do sistema');

-- 8. View canonica de conciliacao com join robusto em clientes
CREATE OR REPLACE VIEW public.erp_repasse_item_conciliacao_canonica
WITH (security_invoker = true)
AS
SELECT
  item.empresa_id,
  item.id AS item_importacao_id,
  item.importacao_id,
  imp.recebimento_id,
  item.previsao_franquia_id,
  item.linha AS numero_linha,
  CASE
    WHEN lower(COALESCE(co.tipo_pessoa, '')) IN ('cnpj', 'pj', 'pessoa juridica', 'pessoa jurídica')
      AND NULLIF(trim(co.razao_social), '') IS NOT NULL THEN trim(co.razao_social)
    ELSE COALESCE(NULLIF(trim(cli.nome), ''), NULLIF(trim(v.cliente_nome), ''), item.cliente_nome)
  END AS titular_nome,
  item.cliente_nome AS titular_no_relatorio,
  item.numero_grupo AS grupo_numero,
  item.numero_cota AS cota_numero,
  item.parcela_numero,
  round(item.valor_comissao, 2) AS valor_relatorio,
  round(COALESCE(sum(baixa.valor_liquidado), 0), 2) AS valor_vinculado,
  round(COALESCE(pf.valor_previsto, 0), 2) AS valor_previsao_canonico,
  round(COALESCE(pf.valor_liquidado, 0), 2) AS valor_liquidado_previsao,
  item.status_conciliacao AS status
FROM public.erp_repasse_importacao_itens item
JOIN public.erp_repasse_importacoes imp ON imp.id = item.importacao_id
LEFT JOIN public.comissao_previsoes_franquia pf ON pf.id = item.previsao_franquia_id
LEFT JOIN public.vendas v ON v.id = pf.venda_id
LEFT JOIN public.clientes cli ON cli.id = v.cliente_id
LEFT JOIN public.contratacoes_online co ON co.id = v.contratacao_id
LEFT JOIN public.erp_repasse_item_baixas baixa ON baixa.item_importacao_id = item.id AND baixa.empresa_id = item.empresa_id
GROUP BY item.empresa_id, item.id, imp.recebimento_id, co.tipo_pessoa, co.razao_social,
  cli.nome, v.cliente_nome, pf.valor_previsto, pf.valor_liquidado;

GRANT SELECT ON public.erp_repasse_item_conciliacao_canonica TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
