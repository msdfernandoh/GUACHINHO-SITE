-- 152 — Tabela comercial canônica do grupo e múltiplos lances embutidos.
-- Um único documento por UUID de grupo, compartilhado entre Site e ERP.
BEGIN;

CREATE TABLE IF NOT EXISTS public.grupos_tabelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL UNIQUE REFERENCES public.grupos_consorcio(id) ON DELETE CASCADE,
  bucket_id text NOT NULL DEFAULT 'grupos-tabelas',
  arquivo_path text NOT NULL UNIQUE,
  arquivo_nome text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  uploaded_by_empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  origem_portal text NOT NULL CHECK (origem_portal IN ('SITE', 'ERP', 'PLATFORM')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.grupos_tabelas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE CASCADE,
  arquivo_path text NOT NULL,
  arquivo_nome text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  uploaded_at timestamptz NOT NULL,
  uploaded_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  uploaded_by_empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  origem_portal text NOT NULL CHECK (origem_portal IN ('SITE', 'ERP', 'PLATFORM')),
  registrado_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS grupos_tabelas_historico_grupo_data_idx
  ON public.grupos_tabelas_historico(grupo_id, registrado_at DESC);

ALTER TABLE public.grupos_tabelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_tabelas_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grupos_tabelas_platform_read ON public.grupos_tabelas;
CREATE POLICY grupos_tabelas_platform_read ON public.grupos_tabelas
  FOR SELECT TO authenticated USING (public.is_platform_superadmin());

DROP POLICY IF EXISTS grupos_tabelas_historico_platform_read ON public.grupos_tabelas_historico;
CREATE POLICY grupos_tabelas_historico_platform_read ON public.grupos_tabelas_historico
  FOR SELECT TO authenticated USING (public.is_platform_superadmin());

REVOKE ALL ON TABLE public.grupos_tabelas, public.grupos_tabelas_historico
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.grupos_tabelas, public.grupos_tabelas_historico
  TO authenticated;

INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'grupos-tabelas',
  'grupos-tabelas',
  false,
  15728640,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- O bucket é acessado exclusivamente por Server Actions após autorização tenant.
-- Nenhuma policy direta para authenticated evita que caminhos sejam enumerados.
DROP POLICY IF EXISTS grupos_tabelas_auth_read ON storage.objects;
DROP POLICY IF EXISTS grupos_tabelas_auth_insert ON storage.objects;
DROP POLICY IF EXISTS grupos_tabelas_auth_update ON storage.objects;
DROP POLICY IF EXISTS grupos_tabelas_auth_delete ON storage.objects;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_lances_embutidos_grupo(
  p_grupo_id uuid,
  p_lances jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item jsonb;
  v_ordem integer := 0;
  v_total integer := 0;
  v_percentual numeric;
  v_primeiro_percentual numeric := NULL;
  v_nome text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode alterar os lances do grupo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupos_consorcio WHERE id = p_grupo_id) THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;
  IF p_lances IS NULL OR jsonb_typeof(p_lances) <> 'array' THEN
    RAISE EXCEPTION 'A lista de lances deve ser um array';
  END IF;

  DELETE FROM public.grupos_modalidades_lance WHERE grupo_id = p_grupo_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lances)
  LOOP
    v_nome := nullif(trim(v_item->>'nome'), '');
    v_percentual := nullif(replace(v_item->>'percentual_lance_embutido', ',', '.'), '')::numeric;
    IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o nome de todos os tipos de lance'; END IF;
    IF v_percentual IS NULL OR v_percentual < 0 OR v_percentual > 100 THEN
      RAISE EXCEPTION 'Percentual inválido para o lance %', v_nome;
    END IF;

    INSERT INTO public.grupos_modalidades_lance(
      grupo_id, nome, percentual_lance_embutido,
      percentual_recurso_proprio_minimo, descricao, ativo, ordem,
      tipo_parcela, percentual_parcela_reduzida
    ) VALUES (
      p_grupo_id,
      v_nome,
      v_percentual,
      coalesce(nullif(replace(v_item->>'percentual_recurso_proprio_minimo', ',', '.'), '')::numeric, 0),
      nullif(trim(v_item->>'descricao'), ''),
      coalesce((v_item->>'ativo')::boolean, true),
      v_ordem,
      CASE WHEN lower(coalesce(v_item->>'tipo_parcela','')) IN ('integral','reduzida')
        THEN lower(v_item->>'tipo_parcela') ELSE NULL END,
      nullif(replace(v_item->>'percentual_parcela_reduzida', ',', '.'), '')::numeric
    );
    IF v_primeiro_percentual IS NULL AND v_percentual > 0 THEN v_primeiro_percentual := v_percentual; END IF;
    v_ordem := v_ordem + 1;
    v_total := v_total + 1;
  END LOOP;

  -- Compatibilidade com consumidores legados; a coleção acima é a fonte canônica.
  UPDATE public.grupos_consorcio
  SET permite_lance_embutido = v_total > 0,
      percentual_lance_embutido = v_primeiro_percentual,
      updated_at = now()
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object('grupo_id', p_grupo_id, 'lances', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_lances_embutidos_grupo(uuid,jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_lances_embutidos_grupo(uuid,jsonb)
  TO authenticated;

COMMENT ON TABLE public.grupos_tabelas IS
  'Documento comercial canônico atual por UUID do grupo; arquivo privado compartilhado entre Site e ERP.';
COMMENT ON TABLE public.grupos_tabelas_historico IS
  'Auditoria imutável dos uploads/substituições da tabela comercial do grupo.';
COMMENT ON FUNCTION public.rpc_platform_salvar_lances_embutidos_grupo(uuid,jsonb) IS
  'Substitui atomicamente a coleção canônica de tipos de lance embutido de um grupo.';

COMMIT;
NOTIFY pgrst, 'reload schema';
