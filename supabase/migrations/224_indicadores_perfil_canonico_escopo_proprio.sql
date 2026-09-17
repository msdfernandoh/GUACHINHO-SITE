-- Cadastro publico de indicadores: usar o perfil com regra homologada e
-- limitar o participante aos seus proprios registros de comissao.
BEGIN;

DO $$
DECLARE
  v_empresa_id uuid;
  v_perfil_antigo uuid;
  v_perfil_canonico uuid;
BEGIN
  SELECT id INTO STRICT v_empresa_id
  FROM public.empresas WHERE slug = 'gauchinho';

  SELECT id INTO STRICT v_perfil_antigo
  FROM public.comissao_perfis
  WHERE empresa_id = v_empresa_id AND nome = 'Indicador Padrão' AND papel_base = 'INDICADOR';

  SELECT id INTO STRICT v_perfil_canonico
  FROM public.comissao_perfis
  WHERE empresa_id = v_empresa_id AND nome = 'Indicador' AND papel_base = 'INDICADOR' AND ativo;

  IF NOT EXISTS (
    SELECT 1 FROM public.comissao_regras_participantes
    WHERE empresa_id = v_empresa_id AND perfil_id = v_perfil_canonico
      AND ativa AND configuracao_homologada AND status = 'HOMOLOGADA'
  ) THEN
    RAISE EXCEPTION 'Perfil Indicador sem regra homologada; nenhuma alteracao aplicada';
  END IF;

  UPDATE public.participantes_comerciais p
  SET escopo_visualizacao = 'VINCULADOS',
      modulos_permitidos = CASE
        WHEN COALESCE(p.modulos_permitidos, '[]'::jsonb) @> '["minhas-comissoes"]'::jsonb
          THEN p.modulos_permitidos
        ELSE COALESCE(p.modulos_permitidos, '[]'::jsonb) || '["minhas-comissoes"]'::jsonb
      END
  WHERE p.empresa_id = v_empresa_id
    AND EXISTS (
      SELECT 1 FROM public.programa_indicadores i
      WHERE i.empresa_id = v_empresa_id AND i.participante_id = p.id
    );

  -- O perfil antigo não possui regra de comissão. Preservar o mesmo vínculo e
  -- vigência, trocando só a referência para o perfil canônico.
  UPDATE public.participante_comissao_perfis pc
  SET perfil_id = v_perfil_canonico,
      updated_at = now()
  WHERE pc.empresa_id = v_empresa_id
    AND pc.perfil_id = v_perfil_antigo
    AND pc.papel_tipo = 'INDICADOR'
    AND EXISTS (
      SELECT 1 FROM public.programa_indicadores i
      WHERE i.empresa_id = v_empresa_id AND i.participante_id = pc.participante_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.participante_comissao_perfis atual
      WHERE atual.empresa_id = v_empresa_id
        AND atual.participante_id = pc.participante_id
        AND atual.papel_tipo = pc.papel_tipo
        AND atual.perfil_id = v_perfil_canonico
    );

  UPDATE public.participante_comissao_perfis
  SET ativo = false, updated_at = now()
  WHERE empresa_id = v_empresa_id AND perfil_id = v_perfil_antigo AND ativo;

  UPDATE public.comissao_perfis
  SET ativo = false, updated_at = now()
  WHERE id = v_perfil_antigo;

  -- Eroni atua comercialmente como microfranquia neste participante. O papel
  -- GESTOR legado mascarava o perfil como "Master" e impedia o default correto.
  IF NOT EXISTS (
    SELECT 1 FROM public.participante_comissao_perfis
    WHERE id = '37a8e297-b123-4549-98b7-ca1077d8fcc7'::uuid
      AND empresa_id = v_empresa_id
      AND participante_id = 'd32ca86d-e5e5-4355-8449-c31ee3586d13'::uuid
      AND perfil_id = '7d9a07e3-de86-41f2-919c-c1ce1c201ea5'::uuid
      AND papel_tipo IN ('GESTOR', 'MICROFRANQUIA')
  ) THEN
    RAISE EXCEPTION 'Vinculo comercial de Eroni divergente; nenhuma alteracao aplicada';
  END IF;

  UPDATE public.participante_comissao_perfis
  SET papel_tipo = 'MICROFRANQUIA', updated_at = now()
  WHERE id = '37a8e297-b123-4549-98b7-ca1077d8fcc7'::uuid
    AND empresa_id = v_empresa_id;

  UPDATE public.participante_tipos
  SET tipo_codigo = 'MICROFRANQUIA'
  WHERE empresa_id = v_empresa_id
    AND participante_id = 'd32ca86d-e5e5-4355-8449-c31ee3586d13'::uuid
    AND tipo_codigo = 'GESTOR';

  -- Laura atua como SDR. O vínculo CONSULTOR -> Indicador é incompatível e
  -- fazia a tela oferecê-la como principal, ocultando a regra SDR correta.
  UPDATE public.participante_comissao_perfis
  SET ativo = false,
      vigencia_fim = COALESCE(vigencia_fim, CURRENT_DATE),
      updated_at = now()
  WHERE id = '3ecd83e7-54d5-4cee-896f-defcc3a1fe0d'::uuid
    AND empresa_id = v_empresa_id
    AND participante_id = 'a074fbc8-713b-458e-8448-5d745f89b1b3'::uuid
    AND papel_tipo = 'CONSULTOR'
    AND perfil_id = v_perfil_canonico;

  IF NOT EXISTS (
    SELECT 1 FROM public.participante_comissao_perfis
    WHERE id = 'bf64d985-74ee-4d9d-a63a-93eef7d5c679'::uuid
      AND empresa_id = v_empresa_id
      AND participante_id = 'a074fbc8-713b-458e-8448-5d745f89b1b3'::uuid
      AND papel_tipo = 'SDR'
      AND perfil_id = '4cb49914-3a5e-41eb-808c-7c8055449871'::uuid
      AND ativo
  ) THEN
    RAISE EXCEPTION 'Vinculo SDR de Laura divergente; nenhuma alteracao aplicada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.comissao_programas
    WHERE id = 'd13c25fb-afb6-47ec-a1fe-3eaa8c5646b0'::uuid
      AND empresa_id = v_empresa_id AND ativo
  ) THEN
    RAISE EXCEPTION 'Programa Racon Veiculo ausente ou inativo; nenhuma alteracao aplicada';
  END IF;

  -- O perfil identifica a função comercial; o programa identifica o tipo de
  -- bem. Reutiliza cada perfil homologado do programa Imóvel no programa
  -- Veículo, preservando percentual, base, curva e cronograma. Isso evita
  -- duplicar SDRs, indicadores e consultores por tipo de bem.
  INSERT INTO public.comissao_regras_participantes (
    empresa_id, programa_id, participante_comercial_id, tipo_participante,
    organizacao_parceira_id, percentual_comissao, base_calculo, ativa, versao,
    vigencia_inicio, vigencia_fim, modalidade, opcao_cota_id, plano_condicao,
    valor_fixo_total, etapas_cronograma, configuracao_homologada,
    origem_configuracao, tipo_administradora_id, modalidade_comissao_id,
    modo_regra, base_v2, fonte_comissao, perfil_id, curva_estorno_id,
    aplicar_curva_estorno, seguir_cronograma_franquia, status, nome_regra,
    observacoes, participante_tipo_id, aplicar_desconto_impostos
  )
  SELECT
    origem.empresa_id, 'd13c25fb-afb6-47ec-a1fe-3eaa8c5646b0'::uuid,
    origem.participante_comercial_id, origem.tipo_participante,
    origem.organizacao_parceira_id, origem.percentual_comissao,
    origem.base_calculo, true, origem.versao, CURRENT_DATE, origem.vigencia_fim,
    origem.modalidade, origem.opcao_cota_id, origem.plano_condicao,
    origem.valor_fixo_total, origem.etapas_cronograma, true,
    'MIGRATION_224_REGRA_VEICULO', origem.tipo_administradora_id,
    origem.modalidade_comissao_id, origem.modo_regra, origem.base_v2,
    origem.fonte_comissao, origem.perfil_id, origem.curva_estorno_id,
    origem.aplicar_curva_estorno, origem.seguir_cronograma_franquia,
    'HOMOLOGADA', COALESCE(origem.nome_regra, 'Regra do perfil') || ' — Racon Veículo',
    'Regra equivalente à homologada do mesmo perfil no programa Racon Imóvel.',
    origem.participante_tipo_id, origem.aplicar_desconto_impostos
  FROM public.comissao_regras_participantes origem
  WHERE origem.empresa_id = v_empresa_id
    AND origem.programa_id = '0957ed7d-961a-432a-bb9d-de3a2b223984'::uuid
    AND origem.perfil_id IS NOT NULL
    AND origem.ativa
    AND origem.configuracao_homologada
    AND origem.status = 'HOMOLOGADA'
    AND NOT EXISTS (
      SELECT 1 FROM public.comissao_regras_participantes existente
      WHERE existente.empresa_id = v_empresa_id
        AND existente.programa_id = 'd13c25fb-afb6-47ec-a1fe-3eaa8c5646b0'::uuid
        AND existente.perfil_id = origem.perfil_id
        AND existente.ativa
        AND existente.configuracao_homologada
        AND existente.status = 'HOMOLOGADA'
    );
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
