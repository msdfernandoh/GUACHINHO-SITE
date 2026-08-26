-- 137: aceita o número simples da planilha (ex.: 1403) e resolve o código
-- canônico do catálogo (ex.: 1403 IMÓVEL), sem renomear ou duplicar grupos.
BEGIN;

ALTER FUNCTION public.rpc_importar_clientes_legado_racon(
  uuid,text,text,text,jsonb,uuid,uuid,boolean,date
) RENAME TO rpc_importar_clientes_legado_racon_canonico;

REVOKE ALL ON FUNCTION public.rpc_importar_clientes_legado_racon_canonico(
  uuid,text,text,text,jsonb,uuid,uuid,boolean,date
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_importar_clientes_legado_racon_canonico(
  uuid,text,text,text,jsonb,uuid,uuid,boolean,date
) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_importar_clientes_legado_racon(
  p_empresa_id uuid,
  p_arquivo_nome text,
  p_arquivo_hash text,
  p_idempotency_key text,
  p_itens jsonb,
  p_regra_franquia_id uuid DEFAULT NULL,
  p_participante_comercial_id uuid DEFAULT NULL,
  p_sem_comissao boolean DEFAULT false,
  p_data_referencia date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_itens_canonicos jsonb;
BEGIN
  IF NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  SELECT jsonb_agg(
    CASE WHEN resolvido.codigo_grupo IS NULL THEN item.value
      ELSE jsonb_set(item.value,'{grupo}',to_jsonb(resolvido.codigo_grupo),true)
    END ORDER BY item.ordinality
  ) INTO v_itens_canonicos
  FROM jsonb_array_elements(p_itens) WITH ORDINALITY AS item(value,ordinality)
  LEFT JOIN LATERAL (
    SELECT g.codigo_grupo
    FROM public.grupos_consorcio g
    JOIN public.administradoras a ON a.id=g.administradora_id
    WHERE g.ativo
      AND a.status='ATIVA'
      AND regexp_replace(upper(coalesce(a.nome_fantasia,a.nome,'')),'[^A-Z0-9]','','g') LIKE '%RACON%'
      AND regexp_replace(g.codigo_grupo,'[^0-9]','','g') = regexp_replace(item.value->>'grupo','[^0-9]','','g')
    ORDER BY g.created_at
    LIMIT 1
  ) resolvido ON true;
  RETURN public.rpc_importar_clientes_legado_racon_canonico(
    p_empresa_id,p_arquivo_nome,p_arquivo_hash,p_idempotency_key,v_itens_canonicos,
    p_regra_franquia_id,p_participante_comercial_id,p_sem_comissao,p_data_referencia
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_importar_clientes_legado_racon(uuid,text,text,text,jsonb,uuid,uuid,boolean,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_importar_clientes_legado_racon(uuid,text,text,text,jsonb,uuid,uuid,boolean,date) TO authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
