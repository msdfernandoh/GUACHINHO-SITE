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
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
