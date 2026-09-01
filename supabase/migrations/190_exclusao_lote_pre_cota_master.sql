-- Exclusão operacional em lote, auditável e restrita ao Master antes da venda/cota.

ALTER TABLE public.propostas
  ADD COLUMN IF NOT EXISTS excluido_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusao_motivo text;

ALTER TABLE public.contratacoes_online
  ADD COLUMN IF NOT EXISTS excluido_at timestamptz,
  ADD COLUMN IF NOT EXISTS excluido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exclusao_motivo text;

CREATE INDEX IF NOT EXISTS propostas_empresa_ativas_idx
  ON public.propostas (empresa_id, created_at DESC)
  WHERE excluido_at IS NULL;

CREATE INDEX IF NOT EXISTS contratacoes_online_empresa_ativas_idx
  ON public.contratacoes_online (empresa_id, created_at DESC)
  WHERE excluido_at IS NULL;

CREATE OR REPLACE FUNCTION public.rpc_master_excluir_pre_cota_em_lote(
  p_empresa_id uuid,
  p_tipo text,
  p_ids uuid[],
  p_motivo text DEFAULT 'Exclusão operacional em lote pelo Master'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_usuario_id uuid := public.current_usuario_id();
  v_quantidade integer;
BEGIN
  IF p_empresa_id IS NULL OR p_tipo NOT IN ('PROPOSTA', 'CONTRATACAO') THEN
    RAISE EXCEPTION 'Parâmetros inválidos para exclusão em lote';
  END IF;
  IF p_ids IS NULL OR cardinality(p_ids) = 0 OR cardinality(p_ids) > 200 THEN
    RAISE EXCEPTION 'Selecione entre 1 e 200 registros';
  END IF;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF NOT public.is_platform_superadmin() AND NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios eu
    JOIN public.papeis p ON p.id = eu.papel_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = v_usuario_id
      AND eu.ativo = true
      AND p.codigo = 'admin_empresa'
  ) THEN
    RAISE EXCEPTION 'Apenas o usuário Master pode excluir registros em lote';
  END IF;

  IF p_tipo = 'PROPOSTA' THEN
    PERFORM 1 FROM public.propostas
      WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL
      FOR UPDATE;
    SELECT count(*) INTO v_quantidade FROM public.propostas
      WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL;
    IF v_quantidade <> cardinality(p_ids) THEN
      RAISE EXCEPTION 'Uma ou mais propostas não pertencem à empresa ou já foram excluídas';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.vendas v
      LEFT JOIN public.contratacoes_online c ON c.id = v.contratacao_id
      WHERE v.empresa_id = p_empresa_id
        AND (v.proposta_id = ANY(p_ids) OR c.proposta_id = ANY(p_ids))
    ) THEN
      RAISE EXCEPTION 'A seleção contém proposta com venda/cota gerada e não pode ser excluída';
    END IF;
    UPDATE public.propostas SET
      excluido_at = now(), excluido_por_usuario_id = v_usuario_id,
      exclusao_motivo = left(coalesce(nullif(trim(p_motivo), ''), 'Exclusão operacional em lote pelo Master'), 500),
      updated_at = now()
    WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL;
  ELSE
    PERFORM 1 FROM public.contratacoes_online
      WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL
      FOR UPDATE;
    SELECT count(*) INTO v_quantidade FROM public.contratacoes_online
      WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL;
    IF v_quantidade <> cardinality(p_ids) THEN
      RAISE EXCEPTION 'Uma ou mais contratações não pertencem à empresa ou já foram excluídas';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.vendas v
      WHERE v.empresa_id = p_empresa_id AND v.contratacao_id = ANY(p_ids)
    ) THEN
      RAISE EXCEPTION 'A seleção contém contratação com venda/cota gerada e não pode ser excluída';
    END IF;
    UPDATE public.contratacoes_online SET
      excluido_at = now(), excluido_por_usuario_id = v_usuario_id,
      exclusao_motivo = left(coalesce(nullif(trim(p_motivo), ''), 'Exclusão operacional em lote pelo Master'), 500),
      updated_at = now()
    WHERE empresa_id = p_empresa_id AND id = ANY(p_ids) AND excluido_at IS NULL;
  END IF;

  INSERT INTO public.audit_logs_central (
    empresa_id, usuario_id, modulo, acao, entidade_tipo, detalhes
  ) VALUES (
    p_empresa_id, v_usuario_id, 'comercial', 'EXCLUSAO_LOTE_PRE_COTA', lower(p_tipo),
    jsonb_build_object('ids', p_ids, 'quantidade', v_quantidade, 'motivo', p_motivo)
  );

  RETURN jsonb_build_object('ok', true, 'quantidade', v_quantidade, 'tipo', p_tipo);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_master_excluir_pre_cota_em_lote(uuid, text, uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_master_excluir_pre_cota_em_lote(uuid, text, uuid[], text) TO authenticated;

COMMENT ON FUNCTION public.rpc_master_excluir_pre_cota_em_lote(uuid, text, uuid[], text) IS
  'Oculta propostas ou contratações em lote, somente por Master e somente antes de qualquer venda/cota, preservando dados para auditoria.';
