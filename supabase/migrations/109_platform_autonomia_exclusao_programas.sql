-- 109: Autonomia total para exclusão de Programas e Regras de Comissão da Administradora no SaaS
BEGIN;

-- 1. RPC para exclusão de programa com autonomia do Superadmin
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

  -- Verifica se existem previsões financeiras reais vinculadas
  SELECT EXISTS(
    SELECT 1 FROM public.comissao_previsoes_franquia pf
    JOIN public.comissao_regras_franquia rf ON rf.id = pf.regra_franquia_id
    WHERE rf.programa_id = p_programa_id
  ) INTO v_tem_previsoes;

  IF v_tem_previsoes THEN
    -- Se houver movimentações financeiras reais já consolidadas, inativa para proteger a integridade
    UPDATE public.comissao_programas SET status = 'INATIVO', ativo = false, updated_at = now() WHERE id = p_programa_id;
    UPDATE public.comissao_regras_franquia SET ativa = false, updated_at = now() WHERE programa_id = p_programa_id;
    RETURN jsonb_build_object('id', p_programa_id, 'excluido', false, 'inativado', true, 'motivo', 'Programa continha previsões financeiras históricas; foi inativado com sucesso.');
  END IF;

  -- Desvincular regras de participantes vinculadas a este programa antes da exclusão
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

-- 2. RPC para excluir regra de programa em qualquer status
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

  -- Desvincula dependências
  UPDATE public.administradora_modelo_modalidades SET regra_franquia_origem_id = NULL WHERE regra_franquia_origem_id = p_regra_id;

  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id = p_regra_id;
  DELETE FROM public.comissao_regras_franquia WHERE id = p_regra_id;

  RETURN jsonb_build_object('id', p_regra_id, 'excluida', true);
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
