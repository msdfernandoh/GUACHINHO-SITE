-- Fase 176 - corrige formalização imobiliária sem regra vigente.
-- A elegibilidade do responsável da Agenda é corrigida na aplicação; aqui restauramos
-- somente regras canônicas do programa Racon Imóvel ativo, copiadas da versão anterior.

BEGIN;

DO $$
DECLARE
  v_empresa_id uuid;
  v_administradora_id uuid;
  v_tipo_imovel_id uuid;
  v_programa_alvo_id uuid;
  v_programa_fonte_id uuid;
  v_regra_fonte record;
  v_regra_alvo_id uuid;
BEGIN
  SELECT e.id INTO v_empresa_id
  FROM public.empresas e
  WHERE e.slug = 'gauchinho';

  SELECT a.id INTO v_administradora_id
  FROM public.administradoras a
  WHERE a.slug = 'racon';

  IF v_empresa_id IS NULL OR v_administradora_id IS NULL THEN
    RETURN;
  END IF;

  SELECT t.id INTO v_tipo_imovel_id
  FROM public.administradora_tipos t
  WHERE t.administradora_id = v_administradora_id
    AND t.codigo = 'IMOVEL';

  SELECT p.id INTO v_programa_alvo_id
  FROM public.comissao_programas p
  WHERE p.empresa_id = v_empresa_id
    AND p.administradora_id = v_administradora_id
    AND p.ativo = true
    AND p.status = 'ATIVO'
    AND lower(p.nome) LIKE '%imóvel%comissão v2%'
  ORDER BY p.versao DESC, p.created_at DESC
  LIMIT 1;

  SELECT p.id INTO v_programa_fonte_id
  FROM public.comissao_programas p
  WHERE p.empresa_id = v_empresa_id
    AND p.administradora_id = v_administradora_id
    AND p.id IS DISTINCT FROM v_programa_alvo_id
    AND EXISTS (
      SELECT 1
      FROM public.comissao_regras_franquia r
      WHERE r.programa_id = p.id
        AND r.tipo_administradora_id = v_tipo_imovel_id
    )
  ORDER BY (p.status = 'SUBSTITUIDO') DESC, p.versao DESC, p.created_at DESC
  LIMIT 1;

  IF v_tipo_imovel_id IS NULL OR v_programa_alvo_id IS NULL OR v_programa_fonte_id IS NULL THEN
    RETURN;
  END IF;

  FOR v_regra_fonte IN
    SELECT r.*
    FROM public.comissao_regras_franquia r
    WHERE r.programa_id = v_programa_fonte_id
      AND r.tipo_administradora_id = v_tipo_imovel_id
      AND r.modalidade_comissao_id IS NOT NULL
    ORDER BY r.modalidade_comissao_id
  LOOP
    SELECT r.id INTO v_regra_alvo_id
    FROM public.comissao_regras_franquia r
    WHERE r.programa_id = v_programa_alvo_id
      AND r.tipo_administradora_id = v_regra_fonte.tipo_administradora_id
      AND r.modalidade_comissao_id = v_regra_fonte.modalidade_comissao_id
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
        DATE '2026-08-25', NULL, true, v_regra_fonte.etapas_cronograma,
        v_regra_fonte.modalidade, v_regra_fonte.opcao_cota_id,
        v_regra_fonte.plano_condicao, v_regra_fonte.valor_fixo_total, true,
        'HOTFIX_173_RESTAURA_RACON_IMOVEL', v_regra_fonte.tipo_administradora_id,
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

  IF NOT EXISTS (
    SELECT 1
    FROM public.comissao_regras_franquia r
    WHERE r.programa_id = v_programa_alvo_id
      AND r.tipo_administradora_id = v_tipo_imovel_id
      AND r.ativa = true
      AND r.configuracao_homologada = true
      AND r.vigencia_inicio <= CURRENT_DATE
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE)
      AND r.percentual_total_comissao > 0
  ) THEN
    RAISE EXCEPTION 'Programa Racon Imóvel ativo permaneceu sem regra homologada e vigente.';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
