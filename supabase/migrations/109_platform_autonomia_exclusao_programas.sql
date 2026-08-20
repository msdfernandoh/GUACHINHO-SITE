-- 109: Autonomia total para edição e exclusão de Programas e Regras de Comissão da Administradora no SaaS
BEGIN;

-- 1. CORREÇÃO DO TRIGGER DE INTEGRIDADE DE COMISSÃO (Permitir programa_id IS NULL e suportar programas SaaS)
CREATE OR REPLACE FUNCTION public.validate_comissao_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_TABLE_NAME = 'comissao_regras_franquia' THEN
    IF NEW.programa_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_programas x
      WHERE x.id = NEW.programa_id AND (x.empresa_id = NEW.empresa_id OR x.administradora_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'programa não pertence ao tenant da regra de franquia';
    END IF;
  ELSIF TG_TABLE_NAME = 'comissao_regras_participantes' THEN
    IF NEW.programa_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_programas x
      WHERE x.id = NEW.programa_id AND (x.empresa_id = NEW.empresa_id OR x.administradora_id IS NOT NULL)
    ) THEN
      RAISE EXCEPTION 'programa não pertence ao tenant da regra de participante';
    END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'participante não pertence ao tenant da regra';
    END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'organização parceira não pertence ao tenant da regra';
    END IF;
  ELSIF TG_TABLE_NAME = 'comissao_previsoes_franquia' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'venda não pertence ao tenant da previsão de franquia';
    END IF;
    IF NEW.cota_definitiva_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas x WHERE x.id = NEW.cota_definitiva_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'cota não pertence ao tenant da previsão de franquia';
    END IF;
    IF NEW.regra_franquia_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_regras_franquia x WHERE x.id = NEW.regra_franquia_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'regra não pertence ao tenant da previsão de franquia';
    END IF;
  ELSIF TG_TABLE_NAME = 'comissao_previsoes_participantes' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'venda não pertence ao tenant da previsão de participante';
    END IF;
    IF NEW.cota_definitiva_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas x WHERE x.id = NEW.cota_definitiva_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'cota não pertence ao tenant da previsão de participante';
    END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'participante não pertence ao tenant da previsão';
    END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'organização parceira não pertence ao tenant da previsão';
    END IF;
    IF NEW.regra_participante_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_regras_participantes x WHERE x.id = NEW.regra_participante_id AND x.empresa_id = NEW.empresa_id
    ) THEN
      RAISE EXCEPTION 'regra não pertence ao tenant da previsão de participante';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. RPC para salvar dados básicos de um programa em qualquer status
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_dados_programa(
  p_programa_id uuid,
  p_nome text,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_prog record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin tem permissão para editar dados do programa.';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado';
  END IF;

  UPDATE public.comissao_programas
  SET nome = trim(p_nome),
      descricao = p_descricao,
      updated_at = now()
  WHERE id = p_programa_id
  RETURNING * INTO v_prog;

  PERFORM public.platform_catalogo_auditar('salvar_dados', 'comissao_programas', p_programa_id, '["nome","descricao"]');

  RETURN to_jsonb(v_prog);
END $$;

-- 3. RPC para salvar/editar regras e etapas em qualquer status
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_regra_programa(
  p_programa_id uuid,
  p_regra_id uuid DEFAULT NULL,
  p_tipo_id uuid DEFAULT NULL,
  p_modalidade_id uuid DEFAULT NULL,
  p_percentual_comissao numeric DEFAULT 4.00,
  p_base_calculo text DEFAULT 'credito',
  p_curva_estorno_id uuid DEFAULT NULL,
  p_vigencia_inicio date DEFAULT CURRENT_DATE,
  p_vigencia_fim date DEFAULT NULL,
  p_etapas jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_prog record;
  v_regra record;
  v_etapa jsonb;
  v_ordem int := 1;
  v_legacy_stages jsonb := '[]'::jsonb;
  v_pct_etapa numeric;
  v_sum_pct numeric := 0;
  v_etapa_nome text;
  v_tipo_gatilho text;
  v_mes_relativo int;
  v_pct_venda numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin tem permissão para editar regras.';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado';
  END IF;

  IF jsonb_array_length(p_etapas) > 0 THEN
    FOR v_etapa IN SELECT * FROM jsonb_array_elements(p_etapas)
    LOOP
      v_pct_venda := coalesce((v_etapa->>'percentual_venda')::numeric, 0);
      IF p_percentual_comissao > 0 THEN
        v_pct_etapa := round((v_pct_venda / p_percentual_comissao) * 100, 4);
      ELSE
        v_pct_etapa := 100;
      END IF;
      v_sum_pct := v_sum_pct + v_pct_etapa;
      v_legacy_stages := v_legacy_stages || jsonb_build_object(
        'ordem', coalesce((v_etapa->>'ordem')::int, v_ordem),
        'nome', coalesce(v_etapa->>'nome', 'Etapa ' || v_ordem),
        'mes_relativo', (v_etapa->>'mes_relativo')::int,
        'percentual_etapa', v_pct_etapa
      );
      v_ordem := v_ordem + 1;
    END LOOP;
  ELSE
    v_legacy_stages := jsonb_build_array(
      jsonb_build_object('ordem', 1, 'nome', 'Parcela Única', 'mes_relativo', 1, 'percentual_etapa', 100)
    );
  END IF;

  IF p_regra_id IS NOT NULL THEN
    UPDATE public.comissao_regras_franquia
    SET tipo_administradora_id = p_tipo_id,
        modalidade_comissao_id = p_modalidade_id,
        percentual_total_comissao = p_percentual_comissao,
        base_calculo = coalesce(p_base_calculo, 'credito'),
        curva_estorno_id = p_curva_estorno_id,
        vigencia_inicio = coalesce(p_vigencia_inicio, CURRENT_DATE),
        vigencia_fim = p_vigencia_fim,
        etapas_cronograma = v_legacy_stages,
        updated_at = now()
    WHERE id = p_regra_id
    RETURNING * INTO v_regra;

    DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id;
  ELSE
    INSERT INTO public.comissao_regras_franquia (
      empresa_id,
      programa_id,
      versao,
      tipo_administradora_id,
      modalidade_comissao_id,
      percentual_total_comissao,
      base_calculo,
      curva_estorno_id,
      vigencia_inicio,
      vigencia_fim,
      etapas_cronograma,
      ativa,
      configuracao_homologada,
      origem_configuracao
    ) VALUES (
      v_prog.empresa_id,
      p_programa_id,
      v_prog.versao,
      p_tipo_id,
      p_modalidade_id,
      p_percentual_comissao,
      coalesce(p_base_calculo, 'credito'),
      p_curva_estorno_id,
      coalesce(p_vigencia_inicio, CURRENT_DATE),
      p_vigencia_fim,
      v_legacy_stages,
      true,
      (v_prog.status = 'ATIVO'),
      'PLATFORM'
    ) RETURNING * INTO v_regra;
  END IF;

  v_ordem := 1;
  IF jsonb_array_length(p_etapas) > 0 THEN
    FOR v_etapa IN SELECT * FROM jsonb_array_elements(p_etapas)
    LOOP
      v_tipo_gatilho := coalesce(v_etapa->>'tipo_gatilho', 'MES_RELATIVO');
      v_mes_relativo := CASE WHEN v_tipo_gatilho = 'CONTEMPLACAO' THEN NULL ELSE coalesce((v_etapa->>'mes_relativo')::int, 1) END;
      v_etapa_nome := coalesce(v_etapa->>'nome', CASE WHEN v_tipo_gatilho = 'CONTEMPLACAO' THEN 'Contemplação' ELSE (v_ordem || 'ª Parcela') END);
      v_pct_venda := coalesce((v_etapa->>'percentual_venda')::numeric, p_percentual_comissao);

      INSERT INTO public.comissao_regra_etapas (
        regra_franquia_id,
        ordem,
        tipo_gatilho,
        mes_relativo,
        nome,
        percentual_venda
      ) VALUES (
        v_regra.id,
        coalesce((v_etapa->>'ordem')::int, v_ordem),
        v_tipo_gatilho,
        v_mes_relativo,
        v_etapa_nome,
        v_pct_venda
      );
      v_ordem := v_ordem + 1;
    END LOOP;
  ELSE
    INSERT INTO public.comissao_regra_etapas (
      regra_franquia_id,
      ordem,
      tipo_gatilho,
      mes_relativo,
      nome,
      percentual_venda
    ) VALUES (
      v_regra.id,
      1,
      'MES_RELATIVO',
      1,
      'Parcela Única',
      p_percentual_comissao
    );
  END IF;

  PERFORM public.platform_catalogo_auditar('salvar_regra', 'comissao_regras_franquia', v_regra.id, '["tipo_administradora_id","modalidade_comissao_id","percentual_total_comissao"]');

  RETURN to_jsonb(v_regra);
END $$;

-- 4. RPC para exclusão de programa com autonomia total do Superadmin
CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_programa(p_programa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_prog record;
  v_tem_previsoes boolean;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin tem permissão para excluir programas.';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado (id: %)', p_programa_id;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.comissao_previsoes_franquia pf
    JOIN public.comissao_regras_franquia rf ON rf.id = pf.regra_franquia_id
    WHERE rf.programa_id = p_programa_id
  ) INTO v_tem_previsoes;

  IF v_tem_previsoes THEN
    UPDATE public.comissao_programas SET status = 'INATIVO', ativo = false, updated_at = now() WHERE id = p_programa_id;
    UPDATE public.comissao_regras_franquia SET ativa = false, updated_at = now() WHERE programa_id = p_programa_id;
    RETURN jsonb_build_object('id', p_programa_id, 'excluido', false, 'inativado', true, 'motivo', 'Programa continha previsões financeiras históricas; foi inativado com sucesso.');
  END IF;

  -- Desvincular regras de participantes vinculadas
  UPDATE public.comissao_regras_participantes SET programa_id = NULL WHERE programa_id = p_programa_id;

  -- Desvincular modelos de comissão
  UPDATE public.administradora_modelo_modalidades
  SET regra_franquia_origem_id = NULL
  WHERE regra_franquia_origem_id IN (SELECT id FROM public.comissao_regras_franquia WHERE programa_id = p_programa_id);

  -- Desvincular programas descendentes
  UPDATE public.comissao_programas SET programa_origem_id = NULL WHERE programa_origem_id = p_programa_id;

  -- Excluir etapas e regras da franquia
  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id IN (SELECT id FROM public.comissao_regras_franquia WHERE programa_id = p_programa_id);
  DELETE FROM public.comissao_regras_franquia WHERE programa_id = p_programa_id;

  -- Excluir o programa
  DELETE FROM public.comissao_programas WHERE id = p_programa_id;

  PERFORM public.platform_catalogo_auditar('excluir', 'comissao_programas', p_programa_id, '[]');

  RETURN jsonb_build_object('id', p_programa_id, 'excluido', true);
END $$;

-- 5. RPC para excluir regra de programa em qualquer status
CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_regra_programa(p_regra_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_regra record;
  v_tem_previsoes boolean;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin tem permissão para excluir regras.';
  END IF;

  SELECT * INTO v_regra FROM public.comissao_regras_franquia WHERE id = p_regra_id;
  IF v_regra.id IS NULL THEN
    RAISE EXCEPTION 'Regra não encontrada';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.comissao_previsoes_franquia WHERE regra_franquia_id = p_regra_id
  ) INTO v_tem_previsoes;

  IF v_tem_previsoes THEN
    UPDATE public.comissao_regras_franquia SET ativa = false, updated_at = now() WHERE id = p_regra_id;
    RETURN jsonb_build_object('id', p_regra_id, 'excluida', false, 'inativada', true);
  END IF;

  UPDATE public.administradora_modelo_modalidades SET regra_franquia_origem_id = NULL WHERE regra_franquia_origem_id = p_regra_id;

  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id;
  DELETE FROM public.comissao_regras_franquia WHERE id = p_regra_id;

  RETURN jsonb_build_object('id', p_regra_id, 'excluida', true);
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
