-- 102 — Vinculações Controladas dos Grupos Legados com o Catálogo Canônico SaaS
-- Forward-only: Permite vinculação auditada e assistida de identificadores legados
-- com grupos_consorcio e grupos_cotas canônicos sem duplicação ou backfill automático.

BEGIN;

CREATE TABLE IF NOT EXISTS public.grupos_vinculacoes_legadas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL,
  identificador_legado text NOT NULL,
  grupo_consorcio_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  produtos_mapeamento jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(produtos_mapeamento) = 'array'),
  contratacoes_afetadas integer NOT NULL DEFAULT 0 CHECK (contratacoes_afetadas >= 0),
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  observacoes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grupos_vinculacoes_legadas_idx
  ON public.grupos_vinculacoes_legadas_historico (grupo_consorcio_id, created_at DESC);

ALTER TABLE public.grupos_vinculacoes_legadas_historico ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.grupos_vinculacoes_legadas_historico FROM PUBLIC, anon;
GRANT ALL ON TABLE public.grupos_vinculacoes_legadas_historico TO service_role;
GRANT SELECT, INSERT ON TABLE public.grupos_vinculacoes_legadas_historico TO authenticated;

DROP POLICY IF EXISTS vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico
  FOR INSERT TO authenticated WITH CHECK (
    public.is_platform_superadmin()
    OR auth.role() = 'service_role'
    OR auth.uid() IS NOT NULL
  );

-- RPC para aplicar a vinculação assistida de grupo legado
CREATE OR REPLACE FUNCTION public.rpc_vincular_grupo_legado(
  p_origem text,
  p_identificador_legado text,
  p_grupo_consorcio_id uuid,
  p_produtos_mapeamento jsonb DEFAULT '[]'::jsonb,
  p_atualizar_contratacoes boolean DEFAULT true,
  p_observacoes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_afetadas integer := 0;
  v_hist_id uuid;
  v_item jsonb;
  v_credito numeric(15,2);
  v_cota_id uuid;
BEGIN
  IF p_grupo_consorcio_id IS NULL THEN
    RAISE EXCEPTION 'Grupo SaaS canônico obrigatório';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_consorcio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo SaaS canônico não encontrado';
  END IF;

  -- Se solicitado atualizar contratações assistidas
  IF p_atualizar_contratacoes THEN
    -- Atualiza contratações que possuíam o identificador ou nome legado
    UPDATE public.contratacoes_online
    SET
      grupo_id = v_grupo.id,
      administradora = COALESCE(administradora, (SELECT nome FROM public.administradoras WHERE id = v_grupo.administradora_id)),
      updated_at = now()
    WHERE (grupo_id IS NULL OR grupo_id <> v_grupo.id)
      AND (
        grupo_nome = p_identificador_legado
        OR grupo_nome = v_grupo.codigo_grupo
        OR dados_simulacao->>'grupo_nome' = p_identificador_legado
        OR dados_simulacao->>'codigoGrupo' = v_grupo.codigo_grupo
      );

    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    -- Atualiza cota_id para os produtos mapeados
    IF jsonb_array_length(p_produtos_mapeamento) > 0 THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_produtos_mapeamento) LOOP
        v_credito := (v_item->>'valor_credito')::numeric;
        v_cota_id := (v_item->>'grupo_cota_id')::uuid;

        IF v_credito IS NOT NULL AND v_cota_id IS NOT NULL THEN
          UPDATE public.contratacoes_online
          SET cota_id = v_cota_id::text, updated_at = now()
          WHERE grupo_id = v_grupo.id
            AND (cota_id IS NULL OR cota_id <> v_cota_id::text)
            AND abs(COALESCE(credito_selecionado, (dados_simulacao->>'valor_credito')::numeric, 0) - v_credito) < 0.01;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Registra no histórico de auditoria
  INSERT INTO public.grupos_vinculacoes_legadas_historico (
    origem, identificador_legado, grupo_consorcio_id, produtos_mapeamento,
    contratacoes_afetadas, usuario_id, observacoes, metadata
  ) VALUES (
    p_origem, p_identificador_legado, v_grupo.id, p_produtos_mapeamento,
    v_afetadas, public.current_usuario_id(), p_observacoes,
    jsonb_build_object(
      'grupo_codigo', v_grupo.codigo_grupo,
      'administradora_id', v_grupo.administradora_id,
      'data_vinculacao', now()
    )
  ) RETURNING id INTO v_hist_id;

  RETURN jsonb_build_object(
    'ok', true,
    'grupo_id', v_grupo.id,
    'codigo_grupo', v_grupo.codigo_grupo,
    'contratacoes_afetadas', v_afetadas,
    'historico_id', v_hist_id
  );
END;
$$;

COMMIT;
