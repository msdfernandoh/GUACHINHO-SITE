-- Migration 323: Suporte a Visibilidade de Grupos por Franquia (Ausente / Liberado) e Reajuste em Lote
BEGIN;

-- 1. Coluna de visibilidade da franquia em grupos_consorcio
ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS visivel_franquia boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_grupos_consorcio_visivel_franquia
  ON public.grupos_consorcio (visivel_franquia);

-- 2. RPC para definir visibilidade em lote na Franquia
CREATE OR REPLACE FUNCTION public.rpc_platform_set_grupos_visibilidade_franquia(
  p_grupo_ids uuid[],
  p_visivel boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total integer := 0;
  v_empresa RECORD;
  v_gid uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode alterar a visibilidade de grupos para franquias.';
  END IF;

  IF p_grupo_ids IS NULL OR array_length(p_grupo_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um grupo para atualização.';
  END IF;

  -- Atualiza grupos_consorcio
  UPDATE public.grupos_consorcio
  SET visivel_franquia = p_visivel,
      updated_at = now()
  WHERE id = ANY(p_grupo_ids);

  GET DIAGNOSTICS v_total = ROW_COUNT;

  -- Sincroniza tabela local empresa_grupos_config para todas as empresas ativas
  FOR v_empresa IN SELECT id FROM public.empresas WHERE status = 'ATIVA'
  LOOP
    FOREACH v_gid IN ARRAY p_grupo_ids
    LOOP
      INSERT INTO public.empresa_grupos_config (empresa_id, grupo_id, visivel, updated_at)
      VALUES (v_empresa.id, v_gid, p_visivel, now())
      ON CONFLICT (empresa_id, grupo_id)
      DO UPDATE SET visivel = EXCLUDED.visivel, updated_at = now();
    END LOOP;
  END LOOP;

  RETURN jsonb_build_object(
    'total_atualizados', v_total,
    'visivel', p_visivel
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_set_grupos_visibilidade_franquia(uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_set_grupos_visibilidade_franquia(uuid[], boolean) TO authenticated;

-- 3. RPC para marcar reajuste anual como concluído em lote
CREATE OR REPLACE FUNCTION public.rpc_platform_marcar_reajuste_lote(
  p_grupo_ids uuid[],
  p_ano integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_total integer := 0;
  v_ano integer := coalesce(p_ano, extract(year from now())::integer);
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode marcar grupos como reajustados.';
  END IF;

  IF p_grupo_ids IS NULL OR array_length(p_grupo_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um grupo para atualização.';
  END IF;

  UPDATE public.grupos_consorcio
  SET ano_ultimo_reajuste = v_ano,
      data_ultimo_reajuste = now(),
      updated_at = now()
  WHERE id = ANY(p_grupo_ids);

  GET DIAGNOSTICS v_total = ROW_COUNT;

  RETURN jsonb_build_object(
    'total_atualizados', v_total,
    'ano', v_ano
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_marcar_reajuste_lote(uuid[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_marcar_reajuste_lote(uuid[], integer) TO authenticated;

-- 4. Backfill: grupos sem nenhuma cota em grupos_cotas ficam como ausente da franquia por padrão
UPDATE public.grupos_consorcio g
SET visivel_franquia = false,
    updated_at = now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.grupos_cotas c WHERE c.grupo_id = g.id AND c.ativo = true
);

-- 5. Backfill: grupos que possuem cotas em grupos_cotas são garantidos como visíveis e com reajuste atualizado
UPDATE public.grupos_consorcio g
SET visivel_franquia = true,
    ano_ultimo_reajuste = coalesce(ano_ultimo_reajuste, extract(year from now())::integer),
    data_ultimo_reajuste = coalesce(data_ultimo_reajuste, now()),
    updated_at = now()
WHERE EXISTS (
  SELECT 1 FROM public.grupos_cotas c WHERE c.grupo_id = g.id AND c.ativo = true
);

-- 6. Auto-reparo técnico para grupos com cotas sem tipo oficial ou sem modalidades vinculadas
DO $$
DECLARE
  v_racon_id uuid := 'c5f8ecb4-cb5a-5014-b567-50484719b404';
  v_tipo_imovel uuid := '57295700-5e68-498c-8882-2ef4ccc8c08d';
  v_tipo_auto uuid := '877a793f-21b3-4ea8-b3c3-b1e56dc216c9';
  v_g RECORD;
  v_mod RECORD;
BEGIN
  -- Corrige tipo_administradora_id nos grupos com cotas que estejam nulos
  UPDATE public.grupos_consorcio
  SET tipo_administradora_id = CASE
    WHEN lower(codigo_grupo) LIKE '%imóv%' OR lower(codigo_grupo) LIKE '%imov%' THEN v_tipo_imovel
    ELSE v_tipo_auto
  END
  WHERE tipo_administradora_id IS NULL
    AND EXISTS (SELECT 1 FROM public.grupos_cotas c WHERE c.grupo_id = grupos_consorcio.id AND c.ativo = true);

  -- Vincula modalidades padrão (Integral, Reduzida < 59%, Reduzida 60%) para grupos com cotas
  FOR v_g IN
    SELECT g.id
    FROM public.grupos_consorcio g
    WHERE EXISTS (SELECT 1 FROM public.grupos_cotas c WHERE c.grupo_id = g.id AND c.ativo = true)
  LOOP
    FOR v_mod IN
      SELECT id FROM public.administradora_modalidades_comissao
      WHERE administradora_id = v_racon_id AND ativo = true
    LOOP
      INSERT INTO public.grupos_modalidades_disponiveis (
        grupo_id, administradora_modalidade_id, ativo, configuracao, created_at, updated_at
      ) VALUES (
        v_g.id, v_mod.id, true, '{"modo_reduzido":"padrao","origem":"ADMINISTRADORA_PADRAO"}'::jsonb, now(), now()
      )
      ON CONFLICT (grupo_id, administradora_modalidade_id)
      DO UPDATE SET ativo = true, updated_at = now();
    END LOOP;
  END LOOP;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
