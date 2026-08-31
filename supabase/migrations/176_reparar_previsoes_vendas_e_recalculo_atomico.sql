-- 176: Recupera previsões removidas pelo recálculo master não atômico.
-- Escopo intencionalmente fechado às quatro vendas confirmadas do participante afetado.
BEGIN;

DO $$
DECLARE
  v_empresa_id constant uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_participante_id constant uuid := 'b25a8ab6-e2a7-4e61-97db-9e6c930c1bb8';
  v_perfil_id constant uuid := '7c6a4cbe-0ac1-46b1-ae08-8bc8d3f6c53d';
  v_venda_id uuid;
  v_venda public.vendas%ROWTYPE;
  v_franquia_count integer;
  v_participante_count integer;
BEGIN
  FOREACH v_venda_id IN ARRAY ARRAY[
    'add7d698-f38d-4164-93ac-9cf82726d2a1'::uuid,
    'cb3f8419-5c5e-480f-92a8-0c4fac825682'::uuid,
    'f62508e8-df95-43c6-b231-b5f798a0df6b'::uuid,
    '177d981c-4492-4304-b1fa-4e91d128e890'::uuid
  ] LOOP
    SELECT * INTO v_venda
    FROM public.vendas
    WHERE id = v_venda_id AND empresa_id = v_empresa_id
    FOR UPDATE;

    IF NOT FOUND
       OR v_venda.status <> 'confirmada'
       OR v_venda.participante_comercial_id IS DISTINCT FROM v_participante_id
       OR v_venda.perfil_principal_id IS DISTINCT FROM v_perfil_id THEN
      RAISE EXCEPTION 'Venda % divergiu do vínculo canônico esperado; recuperação cancelada', v_venda_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas c
      WHERE c.empresa_id = v_empresa_id
        AND c.venda_id = v_venda_id
        AND c.status = 'ativa'
    ) THEN
      RAISE EXCEPTION 'Venda % não possui cota administrativa ativa; recuperação cancelada', v_venda_id;
    END IF;

    SELECT count(*) INTO v_franquia_count
    FROM public.comissao_previsoes_franquia f
    WHERE f.empresa_id = v_empresa_id AND f.venda_id = v_venda_id;

    SELECT count(*) INTO v_participante_count
    FROM public.comissao_previsoes_participantes p
    WHERE p.empresa_id = v_empresa_id AND p.venda_id = v_venda_id;

    -- Torna a migration reaplicável caso a venda já tenha sido recuperada por uma ação posterior.
    IF v_franquia_count > 0 AND v_participante_count > 0 THEN
      CONTINUE;
    END IF;
    IF v_franquia_count <> 0 OR v_participante_count <> 0 THEN
      RAISE EXCEPTION 'Venda % possui cronograma parcial; recuperação automática cancelada', v_venda_id;
    END IF;

    PERFORM public.rpc_gerar_previsoes_comissao_v2_antes_171(
      v_empresa_id,
      v_venda_id,
      'reparo_176:' || v_venda_id::text
    );
    PERFORM public.comissao_gerar_previsoes_perfis_171(v_empresa_id, v_venda_id);

    SELECT count(*) INTO v_franquia_count
    FROM public.comissao_previsoes_franquia f
    WHERE f.empresa_id = v_empresa_id AND f.venda_id = v_venda_id;

    SELECT count(*) INTO v_participante_count
    FROM public.comissao_previsoes_participantes p
    WHERE p.empresa_id = v_empresa_id
      AND p.venda_id = v_venda_id
      AND p.participante_comercial_id = v_participante_id;

    IF v_franquia_count = 0 OR v_participante_count = 0 THEN
      RAISE EXCEPTION 'Motor não recompôs os dois cronogramas da venda %; transação cancelada', v_venda_id;
    END IF;
  END LOOP;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
