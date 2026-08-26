-- 103 — Vinculações Controladas dos Grupos Legados com o Catálogo Canônico SaaS
-- Forward-only: Permite vinculação auditada e assistida de identificadores legados
-- com grupos_consorcio e grupos_cotas canônicos sem duplicação ou backfill automático.

BEGIN;

CREATE TABLE IF NOT EXISTS public.grupos_vinculacoes_legadas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
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

-- CREATE TABLE IF NOT EXISTS não reconcilia uma tabela criada por uma execução
-- parcial/versão anterior. Acrescenta a coluna de escopo sem inventar tenant
-- para registros preexistentes; se houver linhas órfãs, a migration aborta com
-- uma mensagem acionável em vez de misturar empresas.
ALTER TABLE public.grupos_vinculacoes_legadas_historico
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.grupos_vinculacoes_legadas_historico
    WHERE empresa_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'grupos_vinculacoes_legadas_historico possui registros sem empresa_id; classifique-os antes de reaplicar a migration 103';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratacoes_online'
      AND column_name = 'empresa_id'
  ) THEN
    RAISE EXCEPTION
      'Pré-requisito ausente: contratacoes_online.empresa_id. Não execute a 103 sem o histórico anterior completo (migration 053 ou equivalente)';
  END IF;
END;
$$;

ALTER TABLE public.grupos_vinculacoes_legadas_historico
  ALTER COLUMN empresa_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS grupos_vinculacoes_legadas_idx
  ON public.grupos_vinculacoes_legadas_historico (empresa_id, grupo_consorcio_id, created_at DESC);

ALTER TABLE public.grupos_vinculacoes_legadas_historico ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.grupos_vinculacoes_legadas_historico FROM PUBLIC, anon;
GRANT ALL ON TABLE public.grupos_vinculacoes_legadas_historico TO service_role;
GRANT SELECT ON TABLE public.grupos_vinculacoes_legadas_historico TO authenticated;

DROP POLICY IF EXISTS vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico
  FOR SELECT TO authenticated USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico
  FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin());

-- RPC para aplicar a vinculação assistida de grupo legado
CREATE OR REPLACE FUNCTION public.rpc_vincular_grupo_legado(
  p_empresa_id uuid,
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
  IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode vincular dados legados';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa alvo não encontrada';
  END IF;
  IF p_grupo_consorcio_id IS NULL THEN
    RAISE EXCEPTION 'Grupo SaaS canônico obrigatório';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_consorcio_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Grupo SaaS canônico não encontrado';
  END IF;
  IF NOT public.grupo_concedido_para_empresa(p_empresa_id, v_grupo.id) THEN
    RAISE EXCEPTION 'Grupo não concedido para a empresa alvo';
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
      AND empresa_id = p_empresa_id
      AND (
        grupo_nome = p_identificador_legado
        OR grupo_nome = v_grupo.codigo_grupo
        OR dados_simulacao->>'grupo_nome' = p_identificador_legado
        OR dados_simulacao->>'codigoGrupo' = v_grupo.codigo_grupo
      );

    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    -- Atualiza cota_id para os produtos mapeados
    IF jsonb_array_length(p_produtos_mapeamento) > 0 THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_produtos_mapeamento) item
        WHERE item->>'grupo_cota_id' IS NOT NULL
        GROUP BY (item->>'valor_credito')::numeric
        HAVING count(*) > 1
      ) THEN
        RAISE EXCEPTION 'Mapeamento contém mais de um UUID para o mesmo crédito legado';
      END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_produtos_mapeamento) LOOP
        v_credito := (v_item->>'valor_credito')::numeric;
        v_cota_id := (v_item->>'grupo_cota_id')::uuid;

        IF v_credito IS NOT NULL AND v_cota_id IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1 FROM public.grupos_cotas
            WHERE id = v_cota_id AND grupo_id = v_grupo.id
              AND abs(valor_credito - v_credito) < 0.01
          ) THEN
            RAISE EXCEPTION 'Produto/cota % não pertence ao grupo/crédito selecionado', v_cota_id;
          END IF;
          UPDATE public.contratacoes_online
          SET cota_id = v_cota_id::text, updated_at = now()
          WHERE empresa_id = p_empresa_id
            AND grupo_id = v_grupo.id
            AND (cota_id IS NULL OR cota_id <> v_cota_id::text)
            AND abs(COALESCE(credito_selecionado, (dados_simulacao->>'valor_credito')::numeric, 0) - v_credito) < 0.01;
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Registra no histórico de auditoria
  INSERT INTO public.grupos_vinculacoes_legadas_historico (
    empresa_id, origem, identificador_legado, grupo_consorcio_id, produtos_mapeamento,
    contratacoes_afetadas, usuario_id, observacoes, metadata
  ) VALUES (
    p_empresa_id, p_origem, p_identificador_legado, v_grupo.id, p_produtos_mapeamento,
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

REVOKE ALL ON FUNCTION public.rpc_vincular_grupo_legado(uuid,text,text,uuid,jsonb,boolean,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_grupo_legado(uuid,text,text,uuid,jsonb,boolean,text) TO authenticated;

COMMIT;
