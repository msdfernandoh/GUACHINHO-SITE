-- A preparação já resolve e congela o programa pela combinação perfil + tipo
-- do grupo. A conversão final deve consumir esse UUID, sem voltar a escolher
-- uma regra arbitrária quando o perfil atende mais de um programa.
BEGIN;

DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)');
  v_def text;
  v_old text;
  v_new text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fase 228 requer rpc_converter_contratacao_venda';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_old := $old$
  SELECT rp.programa_id INTO v_programa_id
  FROM public.participante_comissao_perfis pc
  JOIN public.comissao_regras_participantes rp
    ON rp.empresa_id = pc.empresa_id AND rp.perfil_id = pc.perfil_id
  WHERE pc.empresa_id = p_empresa_id
    AND pc.participante_id = v_contratacao.participante_comercial_id
    AND pc.perfil_id = v_perfil_principal_id
    AND pc.ativo AND rp.ativa AND rp.configuracao_homologada AND rp.status = 'HOMOLOGADA'
    AND pc.vigencia_inicio <= CURRENT_DATE
    AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE)
    AND rp.vigencia_inicio <= CURRENT_DATE
    AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE);
  IF v_programa_id IS NULL THEN RAISE EXCEPTION 'Perfil principal sem regra homologada e vigente'; END IF;
$old$;

  v_new := $new$
  IF (v_dados->>'programa_comissao_id') IS NULL
     OR (v_dados->>'programa_comissao_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Programa de comissão canônico obrigatório';
  END IF;
  v_programa_id := (v_dados->>'programa_comissao_id')::uuid;

  IF NOT EXISTS (
    SELECT 1
    FROM public.participante_comissao_perfis pc
    JOIN public.comissao_regras_participantes rp
      ON rp.empresa_id = pc.empresa_id
     AND rp.perfil_id = pc.perfil_id
     AND rp.programa_id = v_programa_id
     AND rp.ativa
     AND rp.configuracao_homologada
     AND rp.status = 'HOMOLOGADA'
     AND rp.vigencia_inicio <= CURRENT_DATE
     AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE)
    JOIN public.comissao_programas p
      ON p.id = rp.programa_id
     AND p.empresa_id = p_empresa_id
     AND p.administradora_id = v_grupo.administradora_id
     AND p.ativo
     AND p.status = 'ATIVO'
    JOIN public.comissao_programa_tipos pt
      ON pt.empresa_id = p_empresa_id
     AND pt.programa_id = rp.programa_id
     AND pt.tipo_administradora_id = v_grupo.tipo_administradora_id
     AND pt.ativo
    WHERE pc.empresa_id = p_empresa_id
      AND pc.participante_id = v_contratacao.participante_comercial_id
      AND pc.perfil_id = v_perfil_principal_id
      AND pc.ativo
      AND pc.vigencia_inicio <= CURRENT_DATE
      AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'Perfil principal sem regra homologada e vigente para o programa e tipo selecionados';
  END IF;
$new$;

  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Bloco legado de resolução do programa não encontrado na RPC de conversão';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END
$migration$;

COMMENT ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
IS 'Formaliza venda usando o programa canônico congelado na preparação e validado contra perfil, tipo do grupo e modalidade.';

REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
