-- Executar dentro da transação da 307, após a recuperação identificada.
-- Alterações de cada cenário são revertidas em subtransações.
CREATE TEMP TABLE alvos_307 AS
SELECT eu.id, eu.usuario_id, eu.empresa_id, eu.papel_id, u.auth_user_id
FROM public.empresa_usuarios eu JOIN public.papeis p ON p.id = eu.papel_id
JOIN public.usuarios u ON u.id = eu.usuario_id
WHERE eu.ativo AND u.ativo AND p.codigo = 'super_admin' AND p.escopo = 'PLATFORM';
GRANT SELECT ON alvos_307 TO service_role, authenticated;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  v_alvo record;
  v_admin uuid;
  v_consultor uuid;
  v_outro record;
  v_custom uuid;
BEGIN
  SELECT * INTO STRICT v_alvo FROM alvos_307;
  SELECT id INTO STRICT v_admin FROM public.papeis
    WHERE codigo = 'admin_empresa' AND empresa_id IS NULL;
  SELECT id INTO STRICT v_consultor FROM public.papeis
    WHERE codigo = 'consultor' AND empresa_id IS NULL;
  SELECT eu.* INTO STRICT v_outro FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = v_alvo.empresa_id AND eu.usuario_id <> v_alvo.usuario_id
      AND eu.papel_id = v_admin AND eu.ativo ORDER BY eu.id LIMIT 1;

  -- Reproduz o payload do formulário publicado: master -> admin_empresa.
  BEGIN
    UPDATE public.empresa_usuarios SET papel_id = v_admin,
      agenda_acesso_todos = NOT agenda_acesso_todos WHERE id = v_alvo.id;
    IF NOT EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE id = v_alvo.id
      AND papel_id = v_alvo.papel_id) THEN RAISE EXCEPTION 'Perdeu papel global'; END IF;
    UPDATE public.empresa_usuarios SET is_consultor = NOT is_consultor WHERE id = v_alvo.id;
    RAISE SQLSTATE 'Z0307' USING MESSAGE = 'cenário aprovado';
  EXCEPTION WHEN SQLSTATE 'Z0307' THEN NULL; END;

  BEGIN
    UPDATE public.empresa_usuarios SET papel_id = v_alvo.papel_id WHERE id = v_outro.id;
    RAISE EXCEPTION 'Promoção por service_role foi permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.empresa_usuarios SET papel_id = v_consultor WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Rebaixamento foi permitido';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.empresa_usuarios SET ativo = false WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Inativação global foi permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.empresa_usuarios SET status = 'INATIVO' WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Mudança de status global foi permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    DELETE FROM public.empresa_usuarios WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Exclusão global foi permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    UPDATE public.empresa_usuarios SET usuario_id = v_outro.usuario_id WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Transferência de autoridade foi permitida';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Papéis COMPANY e sua validação de tenant continuam funcionais.
  BEGIN
    UPDATE public.empresa_usuarios SET papel_id = v_consultor WHERE id = v_outro.id;
    IF NOT EXISTS (SELECT 1 FROM public.empresa_usuarios WHERE id = v_outro.id
      AND papel_id = v_consultor) THEN RAISE EXCEPTION 'Edição COMPANY falhou'; END IF;
    RAISE SQLSTATE 'Z0307' USING MESSAGE = 'cenário aprovado';
  EXCEPTION WHEN SQLSTATE 'Z0307' THEN NULL; END;
  BEGIN
    INSERT INTO public.papeis(empresa_id,codigo,nome,escopo)
    SELECT id,'teste_307_' || gen_random_uuid()::text,'TESTE ROLLBACK 307','COMPANY'
    FROM public.empresas WHERE id <> v_alvo.empresa_id LIMIT 1 RETURNING id INTO v_custom;
    IF v_custom IS NULL THEN RAISE EXCEPTION 'Falta outro tenant para teste'; END IF;
    BEGIN
      UPDATE public.empresa_usuarios SET papel_id = v_custom WHERE id = v_outro.id;
      RAISE EXCEPTION 'Papel de outro tenant foi permitido';
    EXCEPTION WHEN check_violation THEN NULL; END;
    RAISE SQLSTATE 'Z0307' USING MESSAGE = 'cenário aprovado';
  EXCEPTION WHEN SQLSTATE 'Z0307' THEN NULL; END;
END;
$$;
RESET ROLE;

-- Até SQL direto não pode remover o último vínculo Superadmin ativo.
DO $$
DECLARE v_alvo record; v_admin uuid;
BEGIN
  SELECT * INTO STRICT v_alvo FROM alvos_307;
  SELECT id INTO STRICT v_admin FROM public.papeis WHERE codigo = 'admin_empresa' AND empresa_id IS NULL;
  BEGIN
    UPDATE public.empresa_usuarios SET papel_id = v_admin WHERE id = v_alvo.id;
    RAISE EXCEPTION 'Manutenção removeu o último Superadmin';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE 'A plataforma deve manter%' THEN RAISE; END IF;
  END;
END;
$$;

-- JWT autenticado usa o helper canônico; administrador comum continua negado.
SELECT set_config('request.jwt.claim.sub', (SELECT auth_user_id::text FROM alvos_307), true);
SELECT set_config('request.jwt.claims', jsonb_build_object('sub',
  (SELECT auth_user_id FROM alvos_307), 'role', 'authenticated')::text, true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Helper negou Superadmin recuperado'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', u.auth_user_id::text, true),
  set_config('request.jwt.claims', jsonb_build_object('sub',u.auth_user_id,'role','authenticated')::text,true)
FROM public.usuarios u JOIN public.empresa_usuarios eu ON eu.usuario_id=u.id
JOIN public.papeis p ON p.id=eu.papel_id WHERE eu.ativo AND u.ativo
  AND p.codigo='admin_empresa' AND u.auth_user_id IS NOT NULL LIMIT 1;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF public.is_platform_superadmin() THEN RAISE EXCEPTION 'Helper promoveu administrador comum'; END IF;
END; $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true), set_config('request.jwt.claims','{}',true);
-- Quem compõe o dry-run deve terminar em ROLLBACK.
