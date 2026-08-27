-- 151: O primeiro vínculo da franquia assume responsabilidade principal automaticamente.
BEGIN;

DO $$
DECLARE v_def text; v_nova text;
BEGIN
  SELECT pg_get_functiondef(
    'public.rpc_platform_convidar_usuario(uuid,text,text,uuid,text[],boolean)'::regprocedure
  ) INTO v_def;

  v_nova := replace(
    v_def,
    E'  IF NOT EXISTS (\n    SELECT 1\n    FROM public.papeis p',
    E'  IF NOT EXISTS (\n    SELECT 1 FROM public.empresa_usuarios eu\n    WHERE eu.empresa_id = p_empresa_id\n      AND eu.ativo = true\n      AND eu.is_responsavel_principal = true\n  ) THEN\n    p_is_responsavel := true;\n  END IF;\n\n  IF NOT EXISTS (\n    SELECT 1\n    FROM public.papeis p'
  );

  IF v_nova = v_def THEN
    RAISE EXCEPTION 'Definição inesperada de rpc_platform_convidar_usuario; responsável automático não aplicado.';
  END IF;
  EXECUTE v_nova;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
