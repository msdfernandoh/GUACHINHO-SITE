-- 171: Cronograma próprio das regras de perfil e opção explícita de impostos.
-- Forward-only; não recalcula nem altera previsões históricas.
BEGIN;

ALTER TABLE public.comissao_regras_participantes
  ADD COLUMN IF NOT EXISTS aplicar_desconto_impostos boolean NOT NULL DEFAULT true;

ALTER TABLE public.comissao_regras_participantes
  DROP CONSTRAINT IF EXISTS comissao_regra_participante_modo_v2_check;
ALTER TABLE public.comissao_regras_participantes
  ADD CONSTRAINT comissao_regra_participante_modo_v2_check CHECK (
    modo_regra IN ('AUTOMATICA','MANUAL') AND
    (base_v2 IS NULL OR base_v2 IN ('COMISSAO_FRANQUEADORA_LIQUIDA','VALOR_VENDIDO','VALOR_FIXO')) AND
    fonte_comissao IN ('FRANQUEADORA','PARTICIPANTE_PRINCIPAL')
  );

COMMENT ON COLUMN public.comissao_regras_participantes.aplicar_desconto_impostos IS
  'true calcula o repasse sobre a comissão líquida após imposto; false usa a base bruta. A escolha é congelada no snapshot da previsão.';

CREATE OR REPLACE FUNCTION public.validar_cronograma_perfil_171()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE v_item jsonb; v_total numeric:=0; v_meses integer[]:='{}'; v_mes integer; v_valor numeric;
BEGIN
  IF NEW.seguir_cronograma_franquia THEN RETURN NEW; END IF;
  IF NEW.base_v2 IS NULL THEN RAISE EXCEPTION 'Base de cálculo do perfil obrigatória'; END IF;
  IF jsonb_typeof(NEW.etapas_cronograma)<>'array' OR jsonb_array_length(NEW.etapas_cronograma)=0 THEN
    RAISE EXCEPTION 'Cronograma próprio precisa possuir ao menos uma parcela';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(NEW.etapas_cronograma) LOOP
    IF COALESCE(v_item->>'mes_relativo','') !~ '^[1-9][0-9]*$' THEN RAISE EXCEPTION 'Mês relativo inválido'; END IF;
    v_mes:=(v_item->>'mes_relativo')::integer;
    IF v_mes=ANY(v_meses) THEN RAISE EXCEPTION 'Mês relativo repetido'; END IF;
    v_meses:=array_append(v_meses,v_mes);
    IF NEW.base_v2='VALOR_FIXO' AND COALESCE(v_item->>'valor_etapa','') !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Valor da parcela inválido';
    ELSIF NEW.base_v2<>'VALOR_FIXO' AND COALESCE(v_item->>'percentual_etapa','') !~ '^[0-9]+([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Percentual da parcela inválido';
    END IF;
    v_valor:=CASE WHEN NEW.base_v2='VALOR_FIXO' THEN (v_item->>'valor_etapa')::numeric ELSE (v_item->>'percentual_etapa')::numeric END;
    IF v_valor<=0 THEN RAISE EXCEPTION 'Valor da parcela deve ser positivo'; END IF;
    v_total:=v_total+v_valor;
  END LOOP;
  IF NEW.base_v2='VALOR_FIXO' AND round(v_total,2)<>round(NEW.valor_fixo_total,2) THEN
    RAISE EXCEPTION 'Soma das parcelas diferente do valor fixo total';
  ELSIF NEW.base_v2<>'VALOR_FIXO' AND round(v_total,2)<>100 THEN
    RAISE EXCEPTION 'Soma das parcelas deve fechar 100%%';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validar_cronograma_perfil_171() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS zz_validar_cronograma_perfil_171 ON public.comissao_regras_participantes;
CREATE TRIGGER zz_validar_cronograma_perfil_171 BEFORE INSERT OR UPDATE
ON public.comissao_regras_participantes FOR EACH ROW EXECUTE FUNCTION public.validar_cronograma_perfil_171();

-- Gera novamente somente as previsões ainda não pagas criadas na mesma geração.
-- A elegibilidade continua sendo recalculada pelo trigger canônico da migration 076,
-- proporcionalmente à comissão da franquia efetivamente liquidada.
CREATE OR REPLACE FUNCTION public.comissao_gerar_previsoes_perfis_171(
  p_empresa_id uuid,
  p_venda_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_venda public.vendas%ROWTYPE;
  v_regra_franquia public.comissao_regras_franquia%ROWTYPE;
  v_cota_id uuid;
  v_part jsonb;
  v_participante_id uuid;
  v_perfil_id uuid;
  v_papel text;
  v_regra public.comissao_regras_participantes%ROWTYPE;
  v_count integer;
  v_base_bruta numeric(15,2);
  v_base_liquida numeric(15,2);
  v_base_regra numeric(15,2);
  v_total_bruto numeric(15,2);
  v_total_participante numeric(15,2);
  v_imposto numeric(7,4);
  v_etapa jsonb;
  v_num_etapas integer;
  v_index integer;
  v_soma_anterior numeric(15,2);
  v_valor numeric(15,2);
  v_percentual_etapa numeric;
  v_mes integer;
  v_competencia text;
  v_data_base date;
  v_fonte_previsao_id uuid;
BEGIN
  SELECT * INTO v_venda
  FROM public.vendas
  WHERE id = p_venda_id AND empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada no tenant'; END IF;

  SELECT r.* INTO v_regra_franquia
  FROM public.comissao_previsoes_franquia f
  JOIN public.comissao_regras_franquia r ON r.id = f.regra_franquia_id
  WHERE f.empresa_id = p_empresa_id AND f.venda_id = p_venda_id
  ORDER BY f.ordem_etapa
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda sem previsão canônica da franqueadora'; END IF;

  SELECT id INTO v_cota_id FROM public.cotas_definitivas
  WHERE empresa_id = p_empresa_id AND venda_id = p_venda_id LIMIT 1;

  SELECT
    COALESCE(sum(COALESCE(f.valor_bruto, f.valor_previsto)), 0),
    COALESCE(sum(COALESCE(f.valor_liquido, f.valor_previsto)), 0),
    COALESCE(max(f.percentual_imposto), 0)
  INTO v_base_bruta, v_base_liquida, v_imposto
  FROM public.comissao_previsoes_franquia f
  WHERE f.empresa_id = p_empresa_id AND f.venda_id = p_venda_id;

  SELECT f.id INTO v_fonte_previsao_id
  FROM public.comissao_previsoes_franquia f
  WHERE f.empresa_id=p_empresa_id AND f.venda_id=p_venda_id AND f.tipo_gatilho='MES_RELATIVO'
  ORDER BY f.ordem_etapa LIMIT 1;

  IF v_base_bruta <= 0 OR v_fonte_previsao_id IS NULL THEN
    RAISE EXCEPTION 'Base da comissão da franqueadora inválida';
  END IF;
  v_data_base := COALESCE(v_venda.data_primeira_parcela, v_venda.data_venda::date);

  FOR v_part IN
    SELECT value FROM jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('participante_id', v_venda.participante_comercial_id,
                         'perfil_id', v_venda.perfil_principal_id,
                         'papel', 'PRINCIPAL'),
      jsonb_build_object('participante_id', v_venda.participante_secundario_id,
                         'perfil_id', v_venda.perfil_secundario_id,
                         'papel', 'SDR')
    ))
  LOOP
    IF COALESCE(v_part->>'participante_id','') = '' OR COALESCE(v_part->>'perfil_id','') = '' THEN CONTINUE; END IF;
    v_participante_id := (v_part->>'participante_id')::uuid;
    v_perfil_id := (v_part->>'perfil_id')::uuid;
    v_papel := v_part->>'papel';

    SELECT r.* INTO v_regra
    FROM public.comissao_regras_participantes r
    WHERE r.empresa_id = p_empresa_id
      AND r.perfil_id = v_perfil_id
      AND r.programa_id = v_regra_franquia.programa_id
      AND r.ativa AND r.configuracao_homologada AND r.status = 'HOMOLOGADA'
      AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_regra_franquia.tipo_administradora_id)
      AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id = v_regra_franquia.modalidade_comissao_id)
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY (r.tipo_administradora_id IS NOT NULL) DESC,
             (r.modalidade_comissao_id IS NOT NULL) DESC,
             r.versao DESC
    LIMIT 1;
    -- Participantes sem regra própria mantêm a geração compatível do motor anterior.
    IF NOT FOUND THEN CONTINUE; END IF;

    SELECT count(*) INTO v_count
    FROM public.comissao_regras_participantes r
    WHERE r.empresa_id = p_empresa_id AND r.perfil_id = v_perfil_id
      AND r.programa_id = v_regra.programa_id AND r.ativa
      AND r.configuracao_homologada AND r.status = 'HOMOLOGADA'
      AND (r.tipo_administradora_id IS NOT DISTINCT FROM v_regra.tipo_administradora_id)
      AND (r.modalidade_comissao_id IS NOT DISTINCT FROM v_regra.modalidade_comissao_id)
      AND r.versao = v_regra.versao
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date);
    IF v_count <> 1 THEN RAISE EXCEPTION 'Regras de perfil ambíguas na mesma precedência e vigência'; END IF;

    -- Compatibilidade obrigatória: regras antigas/padrão que seguem a franqueadora
    -- e aplicam imposto continuam exatamente com as previsões criadas pelo motor
    -- anterior. Só uma escolha nova e explícita entra no caminho 171.
    IF v_regra.seguir_cronograma_franquia AND v_regra.aplicar_desconto_impostos THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.comissao_previsoes_participantes p
      WHERE p.empresa_id=p_empresa_id AND p.venda_id=p_venda_id
        AND p.participante_comercial_id=v_participante_id
        AND (COALESCE(p.valor_pago,0)>0 OR COALESCE(p.valor_elegivel,0)>0)
    ) THEN
      RAISE EXCEPTION 'Previsões deste participante já possuem elegibilidade ou pagamento e não podem ser recalculadas';
    END IF;
    DELETE FROM public.comissao_previsoes_participantes p
    WHERE p.empresa_id=p_empresa_id AND p.venda_id=p_venda_id
      AND p.participante_comercial_id=v_participante_id;

    v_base_regra := CASE
      WHEN v_regra.base_v2 = 'VALOR_VENDIDO' THEN v_venda.valor_credito
      WHEN v_regra.aplicar_desconto_impostos THEN v_base_liquida
      ELSE v_base_bruta
    END;
    v_total_bruto := CASE
      WHEN v_regra.base_v2 = 'VALOR_FIXO' THEN v_regra.valor_fixo_total
      ELSE round(v_base_regra * v_regra.percentual_comissao / 100, 2)
    END;
    IF v_total_bruto IS NULL OR v_total_bruto <= 0 THEN RAISE EXCEPTION 'Total da regra do perfil inválido'; END IF;
    v_total_participante := CASE
      WHEN v_regra.base_v2 IN ('VALOR_VENDIDO','VALOR_FIXO') AND v_regra.aplicar_desconto_impostos
        THEN round(v_total_bruto * (100 - v_imposto) / 100, 2)
      ELSE v_total_bruto
    END;

    IF v_regra.seguir_cronograma_franquia THEN
      v_num_etapas := (SELECT count(*) FROM public.comissao_previsoes_franquia f
                        WHERE f.empresa_id=p_empresa_id AND f.venda_id=p_venda_id AND f.tipo_gatilho='MES_RELATIVO');
      v_index := 0; v_soma_anterior := 0;
      FOR v_etapa IN
        SELECT jsonb_build_object('ordem',f.ordem_etapa,'nome',f.nome_etapa,'competencia',f.competencia,
          'peso',COALESCE(f.valor_bruto,f.valor_previsto),'fonte_id',f.id)
        FROM public.comissao_previsoes_franquia f
        WHERE f.empresa_id=p_empresa_id AND f.venda_id=p_venda_id AND f.tipo_gatilho='MES_RELATIVO'
        ORDER BY f.ordem_etapa
      LOOP
        v_index := v_index + 1;
        v_valor := CASE WHEN v_index = v_num_etapas THEN v_total_participante-v_soma_anterior
          ELSE round(v_total_participante*(v_etapa->>'peso')::numeric/v_base_bruta,2) END;
        v_soma_anterior := v_soma_anterior + v_valor;
        INSERT INTO public.comissao_previsoes_participantes(
          empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,papel_tipo,
          previsao_franquia_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,
          base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
        VALUES(p_empresa_id,p_venda_id,v_cota_id,v_participante_id,v_papel,(v_etapa->>'fonte_id')::uuid,
          v_regra.id,(v_etapa->>'ordem')::integer,v_etapa->>'nome',v_etapa->>'competencia',v_base_regra,
          COALESCE(v_regra.percentual_comissao,0),v_valor,'prevista',jsonb_build_object(
            'modo','AUTOMATICA','perfil_id',v_perfil_id,'regra_id',v_regra.id,
            'aplicar_desconto_impostos',v_regra.aplicar_desconto_impostos,'percentual_imposto',v_imposto,
            'base_bruta_franquia',v_base_bruta,'base_liquida_franquia',v_base_liquida,
            'total_participante',v_total_participante),'MES_RELATIVO');
      END LOOP;
    ELSE
      v_num_etapas := jsonb_array_length(v_regra.etapas_cronograma);
      v_index := 0; v_soma_anterior := 0;
      FOR v_etapa IN SELECT value FROM jsonb_array_elements(v_regra.etapas_cronograma) ORDER BY (value->>'ordem')::integer
      LOOP
        v_index := v_index + 1;
        v_mes := (v_etapa->>'mes_relativo')::integer;
        v_percentual_etapa := CASE WHEN v_regra.base_v2='VALOR_FIXO'
          THEN (v_etapa->>'valor_etapa')::numeric / v_regra.valor_fixo_total * 100
          ELSE (v_etapa->>'percentual_etapa')::numeric END;
        v_valor := CASE WHEN v_index=v_num_etapas THEN v_total_participante-v_soma_anterior
          ELSE round(v_total_participante*v_percentual_etapa/100,2) END;
        v_soma_anterior := v_soma_anterior+v_valor;
        v_competencia := to_char(date_trunc('month',v_data_base)+make_interval(months=>v_mes-1),'YYYY-MM');
        INSERT INTO public.comissao_previsoes_participantes(
          empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,papel_tipo,
          previsao_franquia_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,
          base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
        VALUES(p_empresa_id,p_venda_id,v_cota_id,v_participante_id,v_papel,v_fonte_previsao_id,
          v_regra.id,v_index,COALESCE(v_etapa->>'nome','Parcela '||v_index),v_competencia,v_base_regra,
          COALESCE(v_regra.percentual_comissao,0),v_valor,'prevista',jsonb_build_object(
            'modo','MANUAL','perfil_id',v_perfil_id,'regra_id',v_regra.id,
            'aplicar_desconto_impostos',v_regra.aplicar_desconto_impostos,'percentual_imposto',v_imposto,
            'base_bruta_franquia',v_base_bruta,'base_liquida_franquia',v_base_liquida,
            'fonte_total_potencial',v_base_bruta,'total_participante',v_total_participante,
            'mes_relativo',v_mes),'MES_RELATIVO');
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.comissao_gerar_previsoes_perfis_171(uuid,uuid)
  FROM PUBLIC, anon, authenticated, service_role;

-- Preserva o motor de franquia atual e passa a reconstruir somente o lado dos perfis.
ALTER FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)
  RENAME TO rpc_gerar_previsoes_comissao_v2_antes_171;

CREATE FUNCTION public.rpc_gerar_previsoes_comissao_v2(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'formalizar_vendas') THEN
    RAISE EXCEPTION 'Sem permissão para gerar comissões nesta empresa';
  END IF;
  v_result := public.rpc_gerar_previsoes_comissao_v2_antes_171(p_empresa_id,p_venda_id,p_idempotency_key);
  PERFORM public.comissao_gerar_previsoes_perfis_171(p_empresa_id,p_venda_id);
  RETURN jsonb_set(v_result,'{participantes}',COALESCE((
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.competencia,p.ordem_etapa)
    FROM public.comissao_previsoes_participantes p
    WHERE p.empresa_id=p_empresa_id AND p.venda_id=p_venda_id
  ),'[]'::jsonb),true);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2_antes_171(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
