-- 177: Restaura o perfil e o cronograma histórico de 2% das quatro vendas afetadas.
-- Os snapshots e o extrato anterior comprovam 23 parcelas e R$ 34.240,00 brutos.
BEGIN;

DO $$
DECLARE
  v_empresa_id constant uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_participante_id constant uuid := 'b25a8ab6-e2a7-4e61-97db-9e6c930c1bb8';
  v_perfil_historico_id constant uuid := 'ca734edc-4595-43bc-a3c3-6cfd84f03607';
  v_regra_participante_id constant uuid := '16ad0800-97ca-4cdf-8c1c-94d1fa8f9209';
  v_venda_id uuid;
  v_venda public.vendas%ROWTYPE;
  v_cota_id uuid;
  v_regra_franquia_id uuid;
  v_etapa record;
  v_previsao_franquia_id uuid;
  v_competencia text;
  v_data_base_1 date;
  v_data_base_2 date;
  v_bruto numeric;
  v_imposto_aliquota numeric;
  v_imposto_valor numeric;
  v_liquido numeric;
  v_count integer;
  v_total numeric;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.comissao_previsoes_participantes p
    WHERE p.empresa_id = v_empresa_id
      AND p.venda_id = ANY (ARRAY[
        'add7d698-f38d-4164-93ac-9cf82726d2a1'::uuid,
        'cb3f8419-5c5e-480f-92a8-0c4fac825682'::uuid,
        'f62508e8-df95-43c6-b231-b5f798a0df6b'::uuid,
        '177d981c-4492-4304-b1fa-4e91d128e890'::uuid
      ])
      AND (COALESCE(p.valor_elegivel, 0) > 0 OR COALESCE(p.valor_pago, 0) > 0)
  ) THEN
    RAISE EXCEPTION 'Existem valores elegíveis ou pagos; restauração histórica cancelada';
  END IF;

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
       OR v_venda.participante_secundario_id IS NOT NULL THEN
      RAISE EXCEPTION 'Venda % divergiu do vínculo histórico; restauração cancelada', v_venda_id;
    END IF;

    SELECT c.id INTO v_cota_id
    FROM public.cotas_definitivas c
    WHERE c.empresa_id = v_empresa_id AND c.venda_id = v_venda_id AND c.status = 'ativa'
    LIMIT 1;
    IF v_cota_id IS NULL THEN
      RAISE EXCEPTION 'Venda % não possui cota ativa; restauração cancelada', v_venda_id;
    END IF;

    v_regra_franquia_id := CASE v_venda.modalidade_comissao_id
      WHEN '84a6a781-ba3a-49cd-ac41-857ceaa63478'::uuid THEN '90e403ea-3355-41d9-9c5b-07904ac5eb02'::uuid
      WHEN '0e8c6d88-9e17-4be5-b41c-a6e6826751ae'::uuid THEN '284d5f53-33e4-4b37-a124-dbda2fd2f983'::uuid
      ELSE NULL
    END;
    IF v_regra_franquia_id IS NULL THEN
      RAISE EXCEPTION 'Modalidade histórica inesperada na venda %', v_venda_id;
    END IF;

    SELECT COALESCE(f.percentual_imposto, 0) INTO v_imposto_aliquota
    FROM public.empresa_configuracoes_fiscais f
    WHERE f.empresa_id = v_empresa_id AND f.ativo
      AND f.vigencia_inicio <= v_venda.data_venda::date
      AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY f.vigencia_inicio DESC LIMIT 1;
    v_imposto_aliquota := COALESCE(v_imposto_aliquota, 0);

    v_data_base_1 := COALESCE(v_venda.data_primeira_parcela, v_venda.data_venda::date);
    v_data_base_2 := COALESCE(v_venda.data_segunda_parcela, (v_data_base_1 + interval '1 month')::date);

    DELETE FROM public.comissao_previsoes_participantes
    WHERE empresa_id = v_empresa_id AND venda_id = v_venda_id;
    DELETE FROM public.comissao_previsoes_franquia
    WHERE empresa_id = v_empresa_id AND venda_id = v_venda_id;

    UPDATE public.vendas
    SET perfil_principal_id = v_perfil_historico_id,
        updated_at = clock_timestamp()
    WHERE id = v_venda_id AND empresa_id = v_empresa_id;

    FOR v_etapa IN
      SELECT e.* FROM public.comissao_regra_etapas e
      WHERE e.regra_franquia_id = v_regra_franquia_id
      ORDER BY e.ordem
    LOOP
      v_competencia := CASE WHEN v_etapa.ordem = 1
        THEN to_char(v_data_base_1, 'YYYY-MM')
        ELSE to_char(v_data_base_2 + ((v_etapa.ordem - 2) || ' month')::interval, 'YYYY-MM')
      END;
      v_bruto := round(v_venda.valor_credito * v_etapa.percentual_venda / 100, 2);
      v_imposto_valor := round(v_bruto * v_imposto_aliquota / 100, 2);
      v_liquido := v_bruto - v_imposto_valor;

      INSERT INTO public.comissao_previsoes_franquia (
        empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id,
        ordem_etapa, nome_etapa, competencia, base_calculo_valor, percentual_aplicado,
        valor_previsto, status, snapshot_regra, tipo_gatilho
      ) VALUES (
        v_empresa_id, v_venda_id, v_cota_id, v_venda.administradora_id, v_regra_franquia_id,
        v_etapa.ordem, v_etapa.nome, v_competencia, v_venda.valor_credito, v_etapa.percentual_venda,
        v_bruto, 'prevista', jsonb_build_object(
          'imposto_aliquota', v_imposto_aliquota,
          'imposto_valor', v_imposto_valor,
          'valor_liquido', v_liquido,
          'regra_id', v_regra_franquia_id,
          'origem', 'restauracao_historica_177'
        ), 'MES_RELATIVO'
      ) RETURNING id INTO v_previsao_franquia_id;

      INSERT INTO public.comissao_previsoes_participantes (
        empresa_id, venda_id, cota_definitiva_id, participante_comercial_id,
        regra_participante_id, papel_tipo, previsao_franquia_id, ordem_etapa,
        nome_etapa, competencia, base_calculo_valor, percentual_aplicado,
        valor_previsto, status, snapshot_regra, tipo_gatilho, origem_registro
      ) VALUES (
        v_empresa_id, v_venda_id, v_cota_id, v_participante_id,
        v_regra_participante_id, 'CONSULTOR', v_previsao_franquia_id, v_etapa.ordem,
        v_etapa.nome, v_competencia, v_bruto, 100,
        v_bruto, 'prevista', jsonb_build_object(
          'perfil_principal_id', v_perfil_historico_id,
          'valor_bruto_antes_split', v_bruto,
          'fracao_secundario_deduzida', 0,
          'reparticao_comercial', 'aplicada',
          'origem', 'restauracao_historica_177'
        ), 'MES_RELATIVO', 'OPERACIONAL'
      );
    END LOOP;
  END LOOP;

  SELECT count(*), COALESCE(sum(f.valor_previsto), 0)
  INTO v_count, v_total
  FROM public.comissao_previsoes_franquia f
  WHERE f.empresa_id = v_empresa_id
    AND f.venda_id = ANY (ARRAY[
      'add7d698-f38d-4164-93ac-9cf82726d2a1'::uuid,
      'cb3f8419-5c5e-480f-92a8-0c4fac825682'::uuid,
      'f62508e8-df95-43c6-b231-b5f798a0df6b'::uuid,
      '177d981c-4492-4304-b1fa-4e91d128e890'::uuid
    ]);
  IF v_count <> 23 OR round(v_total, 2) <> 34240.00 THEN
    RAISE EXCEPTION 'Cronograma da franqueadora divergente: % parcelas, total %', v_count, v_total;
  END IF;

  SELECT count(*), COALESCE(sum(p.valor_previsto), 0)
  INTO v_count, v_total
  FROM public.comissao_previsoes_participantes p
  WHERE p.empresa_id = v_empresa_id
    AND p.participante_comercial_id = v_participante_id
    AND p.regra_participante_id = v_regra_participante_id
    AND p.venda_id = ANY (ARRAY[
      'add7d698-f38d-4164-93ac-9cf82726d2a1'::uuid,
      'cb3f8419-5c5e-480f-92a8-0c4fac825682'::uuid,
      'f62508e8-df95-43c6-b231-b5f798a0df6b'::uuid,
      '177d981c-4492-4304-b1fa-4e91d128e890'::uuid
    ]);
  IF v_count <> 23 OR round(v_total, 2) <> 34240.00 THEN
    RAISE EXCEPTION 'Cronograma do participante divergente: % parcelas, total %', v_count, v_total;
  END IF;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
