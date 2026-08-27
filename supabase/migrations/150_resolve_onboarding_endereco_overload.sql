-- 150: Elimina ambiguidade entre o onboarding histórico e o onboarding com endereço.
BEGIN;

DO $$
DECLARE v_base text; v_wrapper text; v_corrigida text;
BEGIN
  SELECT pg_get_functiondef(
    'public.rpc_platform_onboarding_master_franquia(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer)'::regprocedure
  ) INTO v_base;
  v_base := replace(
    v_base,
    'FUNCTION public.rpc_platform_onboarding_master_franquia(',
    'FUNCTION public.rpc_platform_onboarding_master_franquia_base('
  );
  EXECUTE v_base;

  SELECT pg_get_functiondef(
    'public.rpc_platform_onboarding_master_franquia(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer,text,text,text,text,text)'::regprocedure
  ) INTO v_wrapper;
  v_corrigida := replace(
    v_wrapper,
    'v_empresa_id := public.rpc_platform_onboarding_master_franquia(',
    'v_empresa_id := public.rpc_platform_onboarding_master_franquia_base('
  );
  IF v_corrigida = v_wrapper THEN
    RAISE EXCEPTION 'Wrapper de onboarding inesperado; correção não aplicada.';
  END IF;
  EXECUTE v_corrigida;
END $$;

REVOKE ALL ON FUNCTION public.rpc_platform_onboarding_master_franquia_base(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_onboarding_master_franquia_base(text,text,text,text,text,text,text,text,text,uuid,boolean,text,jsonb,boolean,text[],integer,text,text,text,uuid[],uuid,integer,integer)
  TO service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
