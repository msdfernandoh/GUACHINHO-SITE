-- 185 — O perfil Sócio também formaliza grupos Racon Automóvel com a regra
-- veicular já homologada. Nenhum percentual ou cronograma é inventado: as
-- regras são copiadas do programa veicular ativo da mesma administradora.

BEGIN;

DO $$
DECLARE
  v_empresa_id uuid;
  v_administradora_id uuid;
  v_tipo_automoveis_id uuid;
  v_programa_alvo_id uuid;
  v_programa_fonte_id uuid;
  v_regra_fonte record;
  v_regra_alvo_id uuid;
BEGIN
  SELECT id INTO v_empresa_id
  FROM public.empresas
  WHERE slug = 'gauchinho';

  SELECT id INTO v_administradora_id
  FROM public.administradoras
  WHERE slug = 'racon';

  IF v_empresa_id IS NULL OR v_administradora_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_tipo_automoveis_id
  FROM public.administradora_tipos
  WHERE administradora_id = v_administradora_id
    AND codigo = 'AUTOMOVEIS';

  -- Programa efetivamente usado pela regra vigente do perfil Sócio.
  SELECT rp.programa_id INTO v_programa_alvo_id
  FROM public.comissao_regras_participantes rp
  JOIN public.comissao_perfis pf ON pf.id = rp.perfil_id
  JOIN public.comissao_programas p ON p.id = rp.programa_id
  WHERE rp.empresa_id = v_empresa_id
    AND lower(pf.nome) = 'sócio'
    AND rp.ativa
    AND rp.configuracao_homologada
    AND rp.status = 'HOMOLOGADA'
    AND rp.vigencia_inicio <= CURRENT_DATE
    AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE)
    AND p.administradora_id = v_administradora_id
    AND p.ativo
    AND p.status = 'ATIVO'
  ORDER BY rp.versao DESC, rp.created_at DESC
  LIMIT 1;

  -- Catálogo veicular ativo e homologado já definido pela operação.
  SELECT p.id INTO v_programa_fonte_id
  FROM public.comissao_programas p
  WHERE p.empresa_id = v_empresa_id
    AND p.administradora_id = v_administradora_id
    AND p.ativo
    AND p.status = 'ATIVO'
    AND p.id IS DISTINCT FROM v_programa_alvo_id
    AND EXISTS (
      SELECT 1
      FROM public.comissao_regras_franquia r
      WHERE r.programa_id = p.id
        AND r.empresa_id = v_empresa_id
        AND r.tipo_administradora_id = v_tipo_automoveis_id
        AND r.modalidade_comissao_id IS NOT NULL
        AND r.ativa
        AND r.configuracao_homologada
        AND r.vigencia_inicio <= CURRENT_DATE
        AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
    )
  ORDER BY (lower(p.nome) LIKE '%veiculo%' OR lower(p.nome) LIKE '%veículo%') DESC,
           p.versao DESC,
           p.created_at DESC
  LIMIT 1;

  IF v_tipo_automoveis_id IS NULL OR v_programa_alvo_id IS NULL OR v_programa_fonte_id IS NULL THEN
    RAISE EXCEPTION 'Não foi possível resolver os programas canônicos Racon Automóvel para o perfil Sócio';
  END IF;

  FOR v_regra_fonte IN
    SELECT r.*
    FROM public.comissao_regras_franquia r
    WHERE r.empresa_id = v_empresa_id
      AND r.programa_id = v_programa_fonte_id
      AND r.tipo_administradora_id = v_tipo_automoveis_id
      AND r.modalidade_comissao_id IS NOT NULL
      AND r.ativa
      AND r.configuracao_homologada
      AND r.vigencia_inicio <= CURRENT_DATE
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
    ORDER BY r.modalidade_comissao_id
  LOOP
    SELECT r.id INTO v_regra_alvo_id
    FROM public.comissao_regras_franquia r
    WHERE r.empresa_id = v_empresa_id
      AND r.programa_id = v_programa_alvo_id
      AND r.tipo_administradora_id = v_tipo_automoveis_id
      AND r.modalidade_comissao_id = v_regra_fonte.modalidade_comissao_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.vigencia_inicio <= CURRENT_DATE
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
    ORDER BY r.versao DESC
    LIMIT 1;

    IF v_regra_alvo_id IS NULL THEN
      INSERT INTO public.comissao_regras_franquia (
        empresa_id, programa_id, versao, percentual_total_comissao, base_calculo,
        vigencia_inicio, vigencia_fim, ativa, etapas_cronograma, modalidade,
        opcao_cota_id, plano_condicao, valor_fixo_total, configuracao_homologada,
        origem_configuracao, tipo_administradora_id, modalidade_comissao_id, curva_estorno_id
      ) VALUES (
        v_empresa_id, v_programa_alvo_id, 1,
        v_regra_fonte.percentual_total_comissao, v_regra_fonte.base_calculo,
        v_regra_fonte.vigencia_inicio, v_regra_fonte.vigencia_fim, true,
        v_regra_fonte.etapas_cronograma, v_regra_fonte.modalidade,
        v_regra_fonte.opcao_cota_id, v_regra_fonte.plano_condicao,
        v_regra_fonte.valor_fixo_total, true,
        'HOTFIX_185_PERFIL_SOCIO_RACON_AUTOMOVEIS', v_tipo_automoveis_id,
        v_regra_fonte.modalidade_comissao_id, v_regra_fonte.curva_estorno_id
      )
      RETURNING id INTO v_regra_alvo_id;

      INSERT INTO public.comissao_regra_etapas (
        regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda
      )
      SELECT
        v_regra_alvo_id, e.ordem, e.tipo_gatilho, e.mes_relativo, e.nome, e.percentual_venda
      FROM public.comissao_regra_etapas e
      WHERE e.regra_franquia_id = v_regra_fonte.id
      ORDER BY e.ordem;
    END IF;
  END LOOP;

  IF (
    SELECT count(DISTINCT r.modalidade_comissao_id)
    FROM public.comissao_regras_franquia r
    WHERE r.empresa_id = v_empresa_id
      AND r.programa_id = v_programa_alvo_id
      AND r.tipo_administradora_id = v_tipo_automoveis_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.vigencia_inicio <= CURRENT_DATE
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
  ) < 3 THEN
    RAISE EXCEPTION 'Programa do perfil Sócio permaneceu sem as três modalidades Racon Automóvel';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
