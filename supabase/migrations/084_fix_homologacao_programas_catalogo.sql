-- Migration 084: Correção forward-only da homologação de Programas da Franqueadora.
-- Corrige a validação da homologação Platform: cada cronograma fecha no total
-- configurado da própria regra (percentual ou valor fixo), nunca em 100% fixo.
-- Preserva regras Racon, histórico, previsões, vendas e snapshots.

CREATE OR REPLACE FUNCTION public.rpc_platform_status_programa(p_programa_id uuid,p_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_programa record;
  v_status text := upper(trim(p_status));
  v_invalida record;
  v_esperado numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  IF v_status NOT IN ('ATIVO', 'INATIVO') THEN
    RAISE EXCEPTION 'Status do Programa inválido';
  END IF;

  SELECT * INTO v_programa
  FROM public.comissao_programas
  WHERE id = p_programa_id AND administradora_id IS NOT NULL
  FOR UPDATE;

  IF v_programa.id IS NULL THEN
    RAISE EXCEPTION 'Programa da Administradora não encontrado';
  END IF;

  IF v_status = 'ATIVO' THEN
    IF NOT EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE programa_id = p_programa_id) THEN
      RAISE EXCEPTION 'Programa sem regras não pode ser homologado';
    END IF;

    -- Validação detalhada por regra com mensagens específicas
    FOR v_invalida IN
      SELECT
        r.id,
        r.base_calculo,
        r.percentual_total_comissao,
        r.valor_fixo_total,
        t.nome AS tipo_nome,
        m.nome AS mod_nome,
        coalesce((SELECT sum(e.percentual_venda) FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id = r.id), 0) AS soma_etapas,
        (SELECT count(*) FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id = r.id) AS qtd_etapas
      FROM public.comissao_regras_franquia r
      LEFT JOIN public.administradora_tipos t ON t.id = r.tipo_administradora_id
      LEFT JOIN public.administradora_modalidades_comissao m ON m.id = r.modalidade_comissao_id
      WHERE r.programa_id = p_programa_id
    LOOP
      IF v_invalida.tipo_nome IS NULL THEN
        RAISE EXCEPTION 'Regra % possui Tipo não definido', coalesce(v_invalida.mod_nome, v_invalida.id::text);
      END IF;

      IF v_invalida.mod_nome IS NULL THEN
        RAISE EXCEPTION 'Regra % possui Modalidade não definida', coalesce(v_invalida.tipo_nome, v_invalida.id::text);
      END IF;

      IF v_invalida.qtd_etapas = 0 THEN
        RAISE EXCEPTION 'Regra (% - %) sem etapas de cronograma cadastradas', v_invalida.tipo_nome, v_invalida.mod_nome;
      END IF;

      v_esperado := CASE WHEN v_invalida.base_calculo = 'valor_fixo' THEN v_invalida.valor_fixo_total ELSE v_invalida.percentual_total_comissao END;

      IF v_esperado IS NULL THEN
        RAISE EXCEPTION 'Regra (% - %) sem percentual ou valor total de comissão definido', v_invalida.tipo_nome, v_invalida.mod_nome;
      END IF;

      IF abs(v_invalida.soma_etapas - v_esperado) > 0.0001 THEN
        RAISE EXCEPTION 'Regra (% - %): cronograma soma %%, mas comissão total é %%',
          v_invalida.tipo_nome, v_invalida.mod_nome, v_invalida.soma_etapas, v_esperado;
      END IF;
    END LOOP;

    -- Validar que não existe sobreposição com outra regra homologada e ativa na mesma vigência
    IF EXISTS(
      SELECT 1
      FROM public.comissao_regras_franquia alvo
      JOIN public.comissao_regras_franquia outra ON outra.id <> alvo.id AND outra.empresa_id = alvo.empresa_id AND outra.ativa AND outra.configuracao_homologada
      JOIN public.comissao_programas po ON po.id = outra.programa_id AND po.administradora_id = v_programa.administradora_id AND po.ativo
      WHERE alvo.programa_id = p_programa_id
        AND outra.tipo_administradora_id IS NOT DISTINCT FROM alvo.tipo_administradora_id
        AND outra.modalidade_comissao_id = alvo.modalidade_comissao_id
        AND alvo.vigencia_inicio <= coalesce(outra.vigencia_fim, 'infinity'::date)
        AND outra.vigencia_inicio <= coalesce(alvo.vigencia_fim, 'infinity'::date)
    ) THEN
      RAISE EXCEPTION 'Homologação bloqueada por regra canônica sobreposta';
    END IF;

    UPDATE public.comissao_regras_franquia
    SET configuracao_homologada = true,
        ativa = true,
        origem_configuracao = 'PLATFORM_HOMOLOGADO_084',
        updated_at = now()
    WHERE programa_id = p_programa_id;

    UPDATE public.comissao_programas
    SET status = 'ATIVO',
        ativo = true,
        updated_at = now()
    WHERE id = p_programa_id
    RETURNING * INTO v_programa;
  ELSE
    UPDATE public.comissao_programas
    SET status = 'INATIVO',
        ativo = false,
        updated_at = now()
    WHERE id = p_programa_id
    RETURNING * INTO v_programa;
  END IF;

  PERFORM public.platform_catalogo_auditar('status', 'comissao_programas', p_programa_id, '["status","ativo"]');
  RETURN to_jsonb(v_programa);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_nova_versao_programa(p_programa_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_old record;
  v_new record;
  v_rule record;
  v_new_rule uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_old
  FROM public.comissao_programas
  WHERE id = p_programa_id AND administradora_id IS NOT NULL
  FOR UPDATE;

  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Programa da Administradora não encontrado';
  END IF;

  IF v_old.status = 'RASCUNHO' THEN
    RAISE EXCEPTION 'Versão em rascunho pode ser editada diretamente sem criar nova versão';
  END IF;

  IF v_old.status = 'SUBSTITUIDO' THEN
    RAISE EXCEPTION 'Versão já substituída não pode gerar nova versão';
  END IF;

  INSERT INTO public.comissao_programas(
    empresa_id, nome, descricao, administradora_id, ativo, versao, status, programa_origem_id
  ) VALUES (
    v_old.empresa_id, v_old.nome, v_old.descricao, v_old.administradora_id, false, v_old.versao + 1, 'RASCUNHO', v_old.id
  ) RETURNING * INTO v_new;

  FOR v_rule IN SELECT * FROM public.comissao_regras_franquia WHERE programa_id = v_old.id LOOP
    INSERT INTO public.comissao_regras_franquia(
      empresa_id, programa_id, versao, percentual_total_comissao, base_calculo,
      vigencia_inicio, vigencia_fim, ativa, etapas_cronograma, modalidade,
      opcao_cota_id, plano_condicao, valor_fixo_total, configuracao_homologada,
      origem_configuracao, tipo_administradora_id, modalidade_comissao_id, curva_estorno_id
    ) VALUES (
      v_rule.empresa_id, v_new.id, v_rule.versao + 1, v_rule.percentual_total_comissao, v_rule.base_calculo,
      v_rule.vigencia_inicio, v_rule.vigencia_fim, false, v_rule.etapas_cronograma, v_rule.modalidade,
      v_rule.opcao_cota_id, v_rule.plano_condicao, v_rule.valor_fixo_total, false,
      'PLATFORM_NOVA_VERSAO_084', v_rule.tipo_administradora_id, v_rule.modalidade_comissao_id, v_rule.curva_estorno_id
    ) RETURNING id INTO v_new_rule;

    INSERT INTO public.comissao_regra_etapas(regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda)
      SELECT v_new_rule, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda
      FROM public.comissao_regra_etapas
      WHERE regra_franquia_id = v_rule.id;
  END LOOP;

  UPDATE public.comissao_programas
  SET status = 'SUBSTITUIDO', ativo = false, updated_at = now()
  WHERE id = v_old.id;

  PERFORM public.platform_catalogo_auditar('nova_versao', 'comissao_programas', v_new.id, '["programa_origem_id","versao"]');
  RETURN to_jsonb(v_new);
END $$;

REVOKE ALL ON FUNCTION public.rpc_platform_status_programa(uuid,text), public.rpc_platform_nova_versao_programa(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_status_programa(uuid,text), public.rpc_platform_nova_versao_programa(uuid) TO authenticated, service_role;
