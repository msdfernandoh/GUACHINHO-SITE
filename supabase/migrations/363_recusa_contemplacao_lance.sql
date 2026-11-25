-- Recusa de contemplação por lance (cliente não pagou o lance).
-- A cota volta a concorrer como cota normal; o histórico guarda que houve contemplação sem pagamento.
CREATE TABLE IF NOT EXISTS public.cota_contemplacao_recusas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  grupo_id uuid NOT NULL,
  numero_cota text NOT NULL,
  assembleia_data date NOT NULL,
  modalidade text,
  cota_definitiva_id uuid REFERENCES public.cotas_definitivas(id) ON DELETE SET NULL,
  snapshot_cota jsonb,
  criado_por_usuario_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, grupo_id, numero_cota, assembleia_data)
);
ALTER TABLE public.cota_contemplacao_recusas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cota_contemplacao_recusas FROM PUBLIC, anon;
GRANT SELECT ON public.cota_contemplacao_recusas TO authenticated;
GRANT ALL ON public.cota_contemplacao_recusas TO service_role;
DROP POLICY IF EXISTS cota_contemplacao_recusas_select ON public.cota_contemplacao_recusas;
CREATE POLICY cota_contemplacao_recusas_select ON public.cota_contemplacao_recusas FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

CREATE OR REPLACE FUNCTION public.rpc_registrar_recusa_contemplacao(
  p_empresa_id uuid, p_grupo_id uuid, p_numero_cota text, p_data date, p_modalidade text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE v_cota record; v_evento uuid; v_id uuid; v_num text;
BEGIN
  IF NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  v_num := regexp_replace(regexp_replace(trim(p_numero_cota), '^(\d+)-0+$', '\1'), '^0+(?=\d)', '');
  IF v_num = '' OR p_data IS NULL THEN RAISE EXCEPTION 'Dados da recusa inválidos'; END IF;
  SELECT * INTO v_cota FROM public.cotas_definitivas d
   WHERE d.empresa_id = p_empresa_id AND d.grupo_id = p_grupo_id AND d.status <> 'cancelada'
     AND regexp_replace(regexp_replace(trim(d.numero_cota), '^(\d+)-0+$', '\1'), '^0+(?=\d)', '') = v_num
   ORDER BY d.contemplada DESC LIMIT 1 FOR UPDATE;
  IF v_cota.id IS NOT NULL AND v_cota.contemplada THEN
    SELECT id INTO v_evento FROM public.cota_contemplacoes WHERE cota_definitiva_id = v_cota.id;
    IF v_evento IS NOT NULL AND EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE evento_origem_id = v_evento) THEN
      RAISE EXCEPTION 'Esta contemplação já gerou comissão. Ajuste a comissão antes de registrar a recusa.';
    END IF;
    DELETE FROM public.cota_contemplacoes WHERE id = v_evento;
    UPDATE public.cotas_definitivas SET contemplada = false, status = 'ativa', data_contemplacao = NULL,
      valor_credito_contemplacao = NULL, tipo_contemplacao = NULL, observacao_contemplacao = 'Contemplação por lance recusada em ' || to_char(p_data, 'DD/MM/YYYY'),
      contemplacao_atualizada_por_usuario_id = public.current_usuario_id(), contemplacao_atualizada_em = now(), updated_at = now()
    WHERE id = v_cota.id;
  END IF;
  INSERT INTO public.cota_contemplacao_recusas(empresa_id, grupo_id, numero_cota, assembleia_data, modalidade, cota_definitiva_id, snapshot_cota, criado_por_usuario_id)
  VALUES (p_empresa_id, p_grupo_id, v_num, p_data, NULLIF(trim(COALESCE(p_modalidade, '')), ''), v_cota.id,
    CASE WHEN v_cota.id IS NOT NULL AND v_cota.contemplada THEN jsonb_build_object('status', v_cota.status, 'data_contemplacao', v_cota.data_contemplacao,
      'valor_credito_contemplacao', v_cota.valor_credito_contemplacao, 'tipo_contemplacao', v_cota.tipo_contemplacao, 'observacao_contemplacao', v_cota.observacao_contemplacao) END,
    public.current_usuario_id())
  ON CONFLICT (empresa_id, grupo_id, numero_cota, assembleia_data) DO UPDATE SET modalidade = EXCLUDED.modalidade
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_desfazer_recusa_contemplacao(p_empresa_id uuid, p_recusa_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'pg_catalog' AS $$
DECLARE v_r record;
BEGIN
  IF NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  SELECT * INTO v_r FROM public.cota_contemplacao_recusas WHERE id = p_recusa_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_r.id IS NULL THEN RAISE EXCEPTION 'Recusa não encontrada'; END IF;
  IF v_r.snapshot_cota IS NOT NULL AND v_r.cota_definitiva_id IS NOT NULL THEN
    UPDATE public.cotas_definitivas SET contemplada = true,
      status = COALESCE(v_r.snapshot_cota->>'status', 'contemplada'),
      data_contemplacao = (v_r.snapshot_cota->>'data_contemplacao')::date,
      valor_credito_contemplacao = (v_r.snapshot_cota->>'valor_credito_contemplacao')::numeric,
      tipo_contemplacao = v_r.snapshot_cota->>'tipo_contemplacao',
      observacao_contemplacao = v_r.snapshot_cota->>'observacao_contemplacao',
      contemplacao_atualizada_por_usuario_id = public.current_usuario_id(), contemplacao_atualizada_em = now(), updated_at = now()
    WHERE id = v_r.cota_definitiva_id AND empresa_id = p_empresa_id AND NOT contemplada;
  END IF;
  DELETE FROM public.cota_contemplacao_recusas WHERE id = v_r.id;
END $$;

REVOKE ALL ON FUNCTION public.rpc_registrar_recusa_contemplacao(uuid, uuid, text, date, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_desfazer_recusa_contemplacao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recusa_contemplacao(uuid, uuid, text, date, text), public.rpc_desfazer_recusa_contemplacao(uuid, uuid) TO authenticated, service_role;
