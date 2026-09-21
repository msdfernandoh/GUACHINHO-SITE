-- Identifica cotas oficiais informadas no PDF depois que a venda entra no ERP.
-- Não infere cota quando há mais de uma candidata para a mesma linha.
BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_identificar_cotas_repasse_unicas(
  p_empresa_id uuid, p_importacao_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_cota_id uuid;
  v_quantidade integer;
  v_atualizadas integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para atualizar este repasse';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacoes
    WHERE id = p_importacao_id AND empresa_id = p_empresa_id) THEN
    RAISE EXCEPTION 'Relatório não encontrado na empresa';
  END IF;

  FOR v_item IN SELECT * FROM public.erp_repasse_importacao_itens
    WHERE empresa_id = p_empresa_id AND importacao_id = p_importacao_id
      AND status_conciliacao IN ('NAO_ENCONTRADO', 'ATENCAO')
    ORDER BY linha
  LOOP
    SELECT count(DISTINCT c.id), (array_agg(DISTINCT c.id))[1] INTO v_quantidade, v_cota_id
    FROM public.comissao_previsoes_franquia f
    JOIN public.cotas_definitivas c ON c.id = f.cota_definitiva_id AND c.empresa_id = f.empresa_id
    JOIN public.vendas v ON v.id = f.venda_id AND v.empresa_id = f.empresa_id
    JOIN public.erp_repasse_importacoes imp ON imp.id = v_item.importacao_id
    WHERE f.empresa_id = p_empresa_id AND f.administradora_id = imp.administradora_id
      AND f.competencia = imp.competencia
      AND f.status IN ('prevista', 'parcialmente_liquidada')
      AND c.numero_cota IS NULL
      AND ltrim(regexp_replace(c.numero_grupo, '[^0-9]', '', 'g'), '0') =
          ltrim(regexp_replace(v_item.numero_grupo, '[^0-9]', '', 'g'), '0')
      AND regexp_replace(upper(v.cliente_nome), '[^A-Z0-9]', '', 'g') =
          regexp_replace(upper(v_item.cliente_nome), '[^A-Z0-9]', '', 'g')
      AND f.ordem_etapa = v_item.parcela_numero
      AND abs((f.valor_previsto - coalesce(f.valor_liquidado, 0)) - v_item.valor_comissao) <= 0.02
      AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x
        WHERE x.empresa_id = p_empresa_id AND x.previsao_franquia_id = f.id AND x.id <> v_item.id);

    IF v_quantidade = 1 AND NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas outra
      WHERE outra.empresa_id = p_empresa_id AND outra.administradora_id =
        (SELECT administradora_id FROM public.erp_repasse_importacoes WHERE id = p_importacao_id)
        AND ltrim(regexp_replace(outra.numero_grupo, '[^0-9]', '', 'g'), '0') =
            ltrim(regexp_replace(v_item.numero_grupo, '[^0-9]', '', 'g'), '0')
        AND ltrim(regexp_replace(coalesce(outra.numero_cota, ''), '[^0-9]', '', 'g'), '0') =
            ltrim(regexp_replace(v_item.numero_cota, '[^0-9]', '', 'g'), '0')
    ) THEN
      UPDATE public.cotas_definitivas SET numero_cota = v_item.numero_cota, updated_at = now()
      WHERE id = v_cota_id AND empresa_id = p_empresa_id AND numero_cota IS NULL;
      IF FOUND THEN v_atualizadas := v_atualizadas + 1; END IF;
    END IF;
  END LOOP;
  RETURN v_atualizadas;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_vincular_item_repasse_com_cota(
  p_empresa_id uuid, p_item_id uuid, p_previsao_franquia_id uuid, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_cota public.cotas_definitivas%ROWTYPE;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para vincular este repasse';
  END IF;
  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha do relatório não encontrada'; END IF;
  SELECT c.* INTO v_cota FROM public.comissao_previsoes_franquia f
  JOIN public.cotas_definitivas c ON c.id = f.cota_definitiva_id AND c.empresa_id = f.empresa_id
  JOIN public.erp_repasse_importacoes imp ON imp.id = v_item.importacao_id
  WHERE f.id = p_previsao_franquia_id AND f.empresa_id = p_empresa_id
    AND f.administradora_id = imp.administradora_id
    AND c.empresa_id = p_empresa_id
  FOR UPDATE OF c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Comissão ou cota não pertence a este relatório'; END IF;
  IF ltrim(regexp_replace(v_cota.numero_grupo, '[^0-9]', '', 'g'), '0') <>
     ltrim(regexp_replace(v_item.numero_grupo, '[^0-9]', '', 'g'), '0') THEN
    RAISE EXCEPTION 'Grupo da comissão difere do grupo do PDF';
  END IF;
  IF v_cota.numero_cota IS NOT NULL AND
     ltrim(regexp_replace(v_cota.numero_cota, '[^0-9]', '', 'g'), '0') <>
     ltrim(regexp_replace(v_item.numero_cota, '[^0-9]', '', 'g'), '0') THEN
    RAISE EXCEPTION 'Cota da comissão difere da cota do PDF';
  END IF;
  IF v_cota.numero_cota IS NULL AND EXISTS (
    SELECT 1 FROM public.cotas_definitivas outra
    WHERE outra.id <> v_cota.id AND outra.empresa_id = p_empresa_id
      AND outra.administradora_id = v_cota.administradora_id
      AND ltrim(regexp_replace(outra.numero_grupo, '[^0-9]', '', 'g'), '0') =
          ltrim(regexp_replace(v_item.numero_grupo, '[^0-9]', '', 'g'), '0')
      AND ltrim(regexp_replace(coalesce(outra.numero_cota, ''), '[^0-9]', '', 'g'), '0') =
          ltrim(regexp_replace(v_item.numero_cota, '[^0-9]', '', 'g'), '0')
  ) THEN RAISE EXCEPTION 'Esta cota do PDF já está atribuída a outra cota do ERP'; END IF;

  -- A chamada e a identificação da cota ocorrem na mesma transação.
  v_resultado := public.rpc_corrigir_vinculo_item_repasse(
    p_empresa_id, p_item_id, p_previsao_franquia_id, p_idempotency_key);
  IF v_cota.numero_cota IS NULL THEN
    UPDATE public.cotas_definitivas SET numero_cota = v_item.numero_cota, updated_at = now()
    WHERE id = v_cota.id AND empresa_id = p_empresa_id AND numero_cota IS NULL;
  END IF;
  RETURN v_resultado;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_identificar_cotas_repasse_unicas(uuid, uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_vincular_item_repasse_com_cota(uuid, uuid, uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_identificar_cotas_repasse_unicas(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_item_repasse_com_cota(uuid, uuid, uuid, text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
