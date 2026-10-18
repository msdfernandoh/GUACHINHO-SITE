-- Compatibilidade do vínculo global criado na 043 com a proteção tenant da 145.
-- Não promove usuários. Recuperação identificada e autorizada é manutenção separada.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.validar_papel_empresa_usuario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_papel public.papeis%ROWTYPE;
  v_antigo public.papeis%ROWTYPE;
  -- PostgREST usa session_user=authenticator. Nem service_role nem um JWT
  -- de Superadmin habilitam a manutenção SQL de autoridade global.
  v_manutencao boolean := session_user = 'postgres'
    AND coalesce(current_setting('role', true), 'none') IN ('none', 'postgres')
    AND auth.uid() IS NULL AND auth.role() IS NULL;
  v_remove_global boolean := false;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    SELECT * INTO v_antigo FROM public.papeis WHERE id = OLD.papel_id;
  END IF;

  IF TG_OP <> 'DELETE' THEN
    SELECT * INTO v_papel FROM public.papeis WHERE id = NEW.papel_id;
    IF NOT FOUND OR NOT coalesce(v_papel.ativo, false) THEN
      RAISE EXCEPTION 'Papel selecionado não existe ou está inativo.' USING ERRCODE = '23514';
    END IF;
    IF v_papel.escopo = 'COMPANY' AND v_papel.empresa_id IS NOT NULL
       AND v_papel.empresa_id <> NEW.empresa_id THEN
      RAISE EXCEPTION 'O papel selecionado pertence a outra franquia.' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF v_antigo.escopo = 'PLATFORM' AND NOT v_manutencao THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Autoridade global não pode ser removida pela gestão da empresa.' USING ERRCODE = '42501';
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id OR NEW.ativo IS DISTINCT FROM OLD.ativo
       OR NEW.status IS DISTINCT FROM OLD.status OR NEW.data_saida IS DISTINCT FROM OLD.data_saida THEN
      RAISE EXCEPTION 'Autoridade global não pode ser alterada pela gestão da empresa.' USING ERRCODE = '42501';
    END IF;
    -- O formulário legado envia master -> admin_empresa até ao editar menus.
    -- Preserva a autoridade existente sem conceder papel a outra identidade.
    IF NEW.papel_id IS DISTINCT FROM OLD.papel_id THEN
      IF v_papel.codigo <> 'admin_empresa' OR v_papel.escopo <> 'COMPANY' THEN
        RAISE EXCEPTION 'Papel global não pode ser rebaixado pela gestão da empresa.' USING ERRCODE = '42501';
      END IF;
      NEW.papel_id := OLD.papel_id;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP <> 'DELETE' AND v_papel.escopo = 'PLATFORM' AND NOT v_manutencao THEN
    RAISE EXCEPTION 'Papéis globais da Platform não podem ser atribuídos a usuários de franquia.' USING ERRCODE = '42501';
  END IF;

  IF v_antigo.codigo = 'super_admin' AND v_antigo.escopo = 'PLATFORM'
     AND v_antigo.empresa_id IS NULL AND v_antigo.ativo AND OLD.ativo THEN
    IF TG_OP = 'DELETE' THEN
      v_remove_global := true;
    ELSE
      v_remove_global := NEW.usuario_id IS DISTINCT FROM OLD.usuario_id OR NOT NEW.ativo
        OR v_papel.codigo <> 'super_admin' OR v_papel.escopo <> 'PLATFORM'
        OR v_papel.empresa_id IS NOT NULL;
    END IF;
    IF v_remove_global THEN
      PERFORM pg_advisory_xact_lock(hashtextextended('empresa_usuarios.ultimo_superadmin', 0));
      IF NOT EXISTS (
        SELECT 1 FROM public.empresa_usuarios eu
        JOIN public.papeis p ON p.id = eu.papel_id
        JOIN public.usuarios u ON u.id = eu.usuario_id
        WHERE eu.id <> OLD.id AND eu.ativo AND u.ativo AND u.auth_user_id IS NOT NULL
          AND p.codigo = 'super_admin' AND p.escopo = 'PLATFORM'
          AND p.empresa_id IS NULL AND p.ativo
      ) THEN
        RAISE EXCEPTION 'A plataforma deve manter ao menos um Superadmin ativo.' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validar_papel_empresa_usuario() FROM PUBLIC, anon, authenticated, service_role;

-- A 043 e a 145 deixaram dois triggers chamando a mesma função.
DROP TRIGGER IF EXISTS empresa_usuarios_validar_papel_tenant ON public.empresa_usuarios;
DROP TRIGGER IF EXISTS trg_validar_papel_empresa_usuario ON public.empresa_usuarios;
CREATE TRIGGER trg_validar_papel_empresa_usuario
BEFORE INSERT OR UPDATE OR DELETE ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.validar_papel_empresa_usuario();

CREATE OR REPLACE FUNCTION public.auditar_autoridade_empresa_usuario()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_antes jsonb;
  v_depois jsonb;
  v_linha jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_antes := jsonb_build_object('papel_id', OLD.papel_id, 'ativo', OLD.ativo,
      'usuario_id', OLD.usuario_id, 'empresa_id', OLD.empresa_id, 'status', OLD.status);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_depois := jsonb_build_object('papel_id', NEW.papel_id, 'ativo', NEW.ativo,
      'usuario_id', NEW.usuario_id, 'empresa_id', NEW.empresa_id, 'status', NEW.status);
  END IF;
  IF v_antes IS NOT DISTINCT FROM v_depois THEN RETURN NEW; END IF;
  v_linha := coalesce(to_jsonb(NEW), to_jsonb(OLD));
  INSERT INTO public.audit_logs_central(empresa_id, usuario_id, modulo, acao,
    entidade_tipo, entidade_id, detalhes, origem)
  VALUES ((v_linha->>'empresa_id')::uuid, public.current_usuario_id(), 'usuarios',
    lower(TG_OP), 'empresa_usuarios', (v_linha->>'id')::uuid,
    jsonb_build_object('antes', v_antes, 'depois', v_depois,
      'motivo', nullif(current_setting('app.motivo_manutencao', true), ''),
      'executor_sql', session_user), 'database_trigger_307');
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.auditar_autoridade_empresa_usuario() FROM PUBLIC, anon, authenticated, service_role;
DROP TRIGGER IF EXISTS empresa_usuarios_auditar_autoridade ON public.empresa_usuarios;
CREATE TRIGGER empresa_usuarios_auditar_autoridade
AFTER INSERT OR UPDATE OR DELETE ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.auditar_autoridade_empresa_usuario();
COMMIT;
