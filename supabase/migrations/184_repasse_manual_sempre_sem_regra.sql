-- 184: lançamentos manuais de linhas antigas do repasse usam sempre o valor
-- exato do relatório e não dependem de regra de comissão.
BEGIN;

ALTER FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  RENAME TO rpc_lancar_item_repasse_legado_antes_184;

CREATE FUNCTION public.rpc_lancar_item_repasse_legado(
  p_empresa_id uuid,
  p_item_id uuid,
  p_participante_id uuid,
  p_regra_participante_id uuid DEFAULT NULL,
  p_sem_regra boolean DEFAULT true,
  p_cliente_nome text DEFAULT NULL,
  p_grupo_id uuid DEFAULT NULL,
  p_numero_grupo text DEFAULT NULL,
  p_numero_cota text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path=pg_catalog
AS $$
  SELECT public.rpc_lancar_item_repasse_legado_antes_184(
    p_empresa_id,
    p_item_id,
    p_participante_id,
    NULL,
    true,
    p_cliente_nome,
    p_grupo_id,
    p_numero_grupo,
    p_numero_cota
  );
$$;

REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_legado_antes_184(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
