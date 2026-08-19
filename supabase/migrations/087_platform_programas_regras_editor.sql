-- Migration 087: RPCs e suporte para criação e edição completa de Programas da Franqueadora, Regras e Cronogramas
-- Forward-only; preserva todas as regras homologadas, histórico e integridade do motor de comissões.

-- 1. RPC para criar novo programa da franqueadora em rascunho
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_programa(
  p_administradora_id uuid,
  p_empresa_id uuid DEFAULT NULL,
  p_nome text DEFAULT 'Programa de Comissões',
  p_descricao text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_empresa_id uuid := p_empresa_id;
  v_programa record;
  v_nome text := trim(coalesce(p_nome, 'Programa de Comissões'));
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM public.empresas WHERE ativo = true ORDER BY created_at LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma empresa/franqueadora ativa encontrada';
  END IF;

  INSERT INTO public.comissao_programas (
    administradora_id,
    empresa_id,
    nome,
    descricao,
    versao,
    status,
    ativo
  ) VALUES (
    p_administradora_id,
    v_empresa_id,
    v_nome,
    p_descricao,
    1,
    'RASCUNHO',
    true
  ) RETURNING * INTO v_programa;

  RETURN to_jsonb(v_programa);
END $$;

-- 2. RPC para salvar dados básicos de um programa em rascunho
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
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado';
  END IF;

  IF v_prog.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'Apenas programas em RASCUNHO podem ser alterados';
  END IF;

  UPDATE public.comissao_programas
  SET nome = trim(p_nome),
      descricao = p_descricao,
      updated_at = now()
  WHERE id = p_programa_id
  RETURNING * INTO v_prog;

  RETURN to_jsonb(v_prog);
END $$;

-- 3. RPC para salvar ou atualizar regra e etapas de cronograma
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
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado';
  END IF;

  IF v_prog.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'Apenas programas em RASCUNHO podem receber/alterar regras';
  END IF;

  -- Monta legacy etapas_cronograma para atender o trigger trg_comissao_regra_franquia_validate
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
    -- Default 1 parcela única
    v_legacy_stages := jsonb_build_array(
      jsonb_build_object('ordem', 1, 'nome', 'Parcela Única', 'mes_relativo', 1, 'percentual_etapa', 100)
    );
  END IF;

  IF p_regra_id IS NOT NULL THEN
    -- Update
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
    WHERE id = p_regra_id AND programa_id = p_programa_id
    RETURNING * INTO v_regra;

    DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id;
  ELSE
    -- Insert
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
      false,
      'PLATFORM'
    ) RETURNING * INTO v_regra;
  END IF;

  -- Gravar as etapas na tabela comissao_regra_etapas
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
    -- Etapa única padrão
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

  RETURN to_jsonb(v_regra);
END $$;

-- 4. RPC para gerar automaticamente todas as regras padrão da Administradora para um programa em rascunho
CREATE OR REPLACE FUNCTION public.rpc_platform_gerar_regras_padrao_programa(
  p_programa_id uuid,
  p_percentual_padrao numeric DEFAULT 4.00
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_prog record;
  v_tipo record;
  v_mod record;
  v_count int := 0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = p_programa_id;
  IF v_prog.id IS NULL THEN
    RAISE EXCEPTION 'Programa não encontrado';
  END IF;

  IF v_prog.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'Apenas programas em RASCUNHO podem ser populados';
  END IF;

  FOR v_tipo IN
    SELECT id, nome FROM public.administradora_tipos
    WHERE administradora_id = v_prog.administradora_id AND ativo = true
    ORDER BY nome
  LOOP
    FOR v_mod IN
      SELECT id, nome, codigo FROM public.administradora_modalidades_comissao
      WHERE administradora_id = v_prog.administradora_id AND ativo = true
      ORDER BY nome
    LOOP
      -- Se não existir regra para este par (tipo, modalidade) no programa
      IF NOT EXISTS (
        SELECT 1 FROM public.comissao_regras_franquia
        WHERE programa_id = p_programa_id
          AND tipo_administradora_id = v_tipo.id
          AND modalidade_comissao_id = v_mod.id
      ) THEN
        IF v_mod.codigo = 'REDUZIDA_ABAIXO_59' THEN
          -- Estrutura Racon: 2.75% parcelas + 1.25% contemplação = 4.00%
          PERFORM public.rpc_platform_salvar_regra_programa(
            p_programa_id,
            NULL,
            v_tipo.id,
            v_mod.id,
            coalesce(p_percentual_padrao, 4.00),
            'credito',
            NULL,
            CURRENT_DATE,
            NULL,
            jsonb_build_array(
              jsonb_build_object('ordem', 1, 'tipo_gatilho', 'MES_RELATIVO', 'mes_relativo', 1, 'nome', '1ª Parcela', 'percentual_venda', round(coalesce(p_percentual_padrao, 4.00) * 0.6875, 4)),
              jsonb_build_object('ordem', 2, 'tipo_gatilho', 'CONTEMPLACAO', 'mes_relativo', NULL, 'nome', 'Contemplação', 'percentual_venda', round(coalesce(p_percentual_padrao, 4.00) * 0.3125, 4))
            )
          );
        ELSE
          -- Parcela única no 1º mês
          PERFORM public.rpc_platform_salvar_regra_programa(
            p_programa_id,
            NULL,
            v_tipo.id,
            v_mod.id,
            coalesce(p_percentual_padrao, 4.00),
            'credito',
            NULL,
            CURRENT_DATE,
            NULL,
            jsonb_build_array(
              jsonb_build_object('ordem', 1, 'tipo_gatilho', 'MES_RELATIVO', 'mes_relativo', 1, 'nome', 'Parcela Única', 'percentual_venda', coalesce(p_percentual_padrao, 4.00))
            )
          );
        END IF;
        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object('geradas', v_count);
END $$;

-- 5. RPC para excluir regra de programa em rascunho
CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_regra_programa(
  p_regra_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_regra record;
  v_prog record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_regra FROM public.comissao_regras_franquia WHERE id = p_regra_id;
  IF v_regra.id IS NULL THEN
    RAISE EXCEPTION 'Regra não encontrada';
  END IF;

  SELECT * INTO v_prog FROM public.comissao_programas WHERE id = v_regra.programa_id;
  IF v_prog.status <> 'RASCUNHO' THEN
    RAISE EXCEPTION 'Apenas regras de programas em RASCUNHO podem ser excluídas';
  END IF;

  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id;
  DELETE FROM public.comissao_regras_franquia WHERE id = p_regra_id;

  RETURN jsonb_build_object('sucesso', true);
END $$;
