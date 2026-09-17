-- O gerador de previsões deve usar o programa já congelado no snapshot da
-- venda. Selecionar a regra mais recente do perfil é ambíguo quando o mesmo
-- perfil atende Imóvel e Veículo.
BEGIN;

DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure('public.rpc_gerar_previsoes_comissao_v2_antes_171(uuid,uuid,text)');
  v_def text;
  v_old text;
  v_new text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fase 230 requer o núcleo de previsões anterior à fase 171';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_old := $old$
  -- 0. Busca programa_id e percentual configurado na regra do perfil do consultor
  IF v_perfil_principal_id IS NOT NULL THEN
    SELECT r.programa_id, r.percentual_comissao
    INTO v_programa_principal_id, v_percentual_principal
    FROM public.comissao_regras_participantes r
    WHERE r.perfil_id = v_perfil_principal_id
      AND r.empresa_id = p_empresa_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.status = 'HOMOLOGADA'
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY r.versao DESC LIMIT 1;
  END IF;
$old$;

  v_new := $new$
  -- 0. Consome o programa canônico congelado pela formalização e resolve o
  -- percentual somente na regra desse programa.
  IF (v_venda.snapshot_venda->>'programa_comissao_id') ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_programa_principal_id := (v_venda.snapshot_venda->>'programa_comissao_id')::uuid;
  ELSIF (v_venda.snapshot_venda#>>'{dados_simulacao,programa_comissao_id}') ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    v_programa_principal_id :=
      (v_venda.snapshot_venda#>>'{dados_simulacao,programa_comissao_id}')::uuid;
  END IF;

  IF v_perfil_principal_id IS NOT NULL AND v_programa_principal_id IS NOT NULL THEN
    SELECT r.percentual_comissao
    INTO v_percentual_principal
    FROM public.comissao_regras_participantes r
    WHERE r.perfil_id = v_perfil_principal_id
      AND r.programa_id = v_programa_principal_id
      AND r.empresa_id = p_empresa_id
      AND r.ativa
      AND r.configuracao_homologada
      AND r.status = 'HOMOLOGADA'
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    ORDER BY r.versao DESC
    LIMIT 1;
  END IF;
$new$;

  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Bloco ambíguo de resolução do programa não encontrado no gerador de previsões';
  END IF;

  v_def := replace(v_def, v_old, v_new);
  EXECUTE v_def;
END
$migration$;

COMMENT ON FUNCTION public.rpc_gerar_previsoes_comissao_v2_antes_171(uuid,uuid,text)
IS 'Núcleo de previsões que consome o programa canônico congelado na venda e resolve a regra exata do perfil nesse programa.';

COMMIT;
NOTIFY pgrst, 'reload schema';
