-- Manutenção de uso único autorizada pelo titular; executar após migration 307.
-- Sem BEGIN/COMMIT: incluir na transação de validação ou publicação.
DO $$
DECLARE
  v_vinculo public.empresa_usuarios%ROWTYPE;
  v_papel uuid;
  v_antes jsonb;
  v_depois jsonb;
BEGIN
  IF session_user <> 'postgres' OR auth.uid() IS NOT NULL OR auth.role() IS NOT NULL
     OR current_setting('role', true) NOT IN ('none', 'postgres') THEN
    RAISE EXCEPTION 'Recuperação exige manutenção SQL direta sem JWT.';
  END IF;
  SELECT eu.* INTO STRICT v_vinculo FROM public.empresa_usuarios eu
  JOIN public.usuarios u ON u.id = eu.usuario_id
  WHERE eu.id = 'f9ad413a-1447-4c8f-bd6b-00a588ebe756'
    AND eu.empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'
    AND eu.usuario_id = '31617f5c-42c7-4f08-ba5a-38323eacbffd'
    AND u.auth_user_id = '5dfd1ca3-ee2c-43a1-b294-8d11c698a434'
    AND lower(u.email) = 'msdfernando@gmail.com' AND u.ativo AND eu.ativo
  FOR UPDATE OF eu;
  SELECT id INTO STRICT v_papel FROM public.papeis
  WHERE codigo = 'super_admin' AND escopo = 'PLATFORM' AND empresa_id IS NULL AND ativo;
  IF v_vinculo.papel_id = v_papel THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.papeis WHERE id = v_vinculo.papel_id
    AND codigo = 'admin_empresa' AND escopo = 'COMPANY' AND ativo) THEN
    RAISE EXCEPTION 'Papel atual diverge do diagnóstico. Reavaliar antes de recuperar.';
  END IF;
  v_antes := to_jsonb(v_vinculo) - 'papel_id' - 'updated_at';
  PERFORM set_config('app.motivo_manutencao',
    'Recuperação autorizada pelo titular em 18/10/2026; identidade original prevista na migration 043.', true);
  UPDATE public.empresa_usuarios SET papel_id = v_papel WHERE id = v_vinculo.id;
  SELECT to_jsonb(eu) - 'papel_id' - 'updated_at' INTO v_depois
  FROM public.empresa_usuarios eu WHERE id = v_vinculo.id;
  IF v_antes IS DISTINCT FROM v_depois THEN
    RAISE EXCEPTION 'Recuperação alterou campos fora do papel global.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_logs_central
    WHERE entidade_tipo = 'empresa_usuarios' AND entidade_id = v_vinculo.id
      AND origem = 'database_trigger_307' AND detalhes#>>'{depois,papel_id}' = v_papel::text
      AND detalhes->>'motivo' IS NOT NULL) THEN
    RAISE EXCEPTION 'Recuperação sem auditoria; operação cancelada.';
  END IF;
END;
$$;
