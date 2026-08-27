-- 145: Hotfix do cadastro de usuários/responsáveis das franquias.
-- Corrige o perfil legado inválido e impede papéis PLATFORM em vínculos tenant.

BEGIN;

CREATE OR REPLACE FUNCTION public.validar_papel_empresa_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_papel record;
BEGIN
  SELECT id, empresa_id, escopo, ativo
    INTO v_papel
  FROM public.papeis
  WHERE id = NEW.papel_id;

  IF NOT FOUND OR NOT coalesce(v_papel.ativo, false) THEN
    RAISE EXCEPTION 'Papel selecionado não existe ou está inativo.';
  END IF;

  IF v_papel.escopo <> 'COMPANY' THEN
    RAISE EXCEPTION 'Papéis globais da Platform não podem ser atribuídos a usuários de franquia.';
  END IF;

  IF v_papel.empresa_id IS NOT NULL AND v_papel.empresa_id <> NEW.empresa_id THEN
    RAISE EXCEPTION 'O papel selecionado pertence a outra franquia.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_usuarios_validar_papel_tenant ON public.empresa_usuarios;
CREATE TRIGGER empresa_usuarios_validar_papel_tenant
BEFORE INSERT OR UPDATE OF papel_id, empresa_id ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.validar_papel_empresa_usuario();

CREATE OR REPLACE FUNCTION public.rpc_platform_convidar_usuario(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_papel_id uuid,
  p_modulos text[] DEFAULT '{}'::text[],
  p_is_responsavel boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotas record;
  v_total_usuarios int;
  v_overrides_usuarios int := 0;
  v_limite_efetivo int;
  v_plano record;
  v_modulos_empresa text[] := '{}'::text[];
  v_modulos_filtrados text[] := '{}'::text[];
  v_mod text;
  v_usuario_id uuid;
  v_empresa_usuario_id uuid;
  v_email_clean text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  v_email_clean := lower(trim(p_email));
  IF coalesce(v_email_clean, '') = '' OR coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome e e-mail são obrigatórios.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id AND ativo = true) THEN
    RAISE EXCEPTION 'Master Franquia não encontrada ou inativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.papeis p
    WHERE p.id = p_papel_id
      AND p.ativo = true
      AND p.escopo = 'COMPANY'
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
  ) THEN
    RAISE EXCEPTION 'Papel inválido para esta franquia.';
  END IF;

  SELECT * INTO v_quotas
  FROM public.empresa_quotas
  WHERE empresa_id = p_empresa_id;

  SELECT count(*) INTO v_total_usuarios
  FROM public.empresa_usuarios
  WHERE empresa_id = p_empresa_id AND ativo = true;

  SELECT coalesce(sum(
    CASE
      WHEN efeito = 'LIBERAR' AND (motivo ILIKE '%usuario%' OR motivo ILIKE '%user%') THEN 5
      ELSE 0
    END
  ), 0) INTO v_overrides_usuarios
  FROM public.saas_empresa_overrides
  WHERE empresa_id = p_empresa_id;

  v_limite_efetivo := coalesce(v_quotas.limite_usuarios, 10) + v_overrides_usuarios;
  IF v_total_usuarios >= v_limite_efetivo THEN
    RAISE EXCEPTION 'Limite de usuários contratados atingido (% de %). Solicite aumento de quota antes de convidar novos usuários.', v_total_usuarios, v_limite_efetivo;
  END IF;

  SELECT sp.* INTO v_plano
  FROM public.saas_assinaturas sa
  JOIN public.saas_planos sp ON sp.id = sa.plano_id
  WHERE sa.empresa_id = p_empresa_id
    AND sa.status IN ('ATIVA', 'TREINAMENTO', 'PENDENTE')
  ORDER BY sa.created_at DESC
  LIMIT 1;

  IF v_plano.id IS NOT NULL AND v_plano.modulos_habilitados IS NOT NULL THEN
    v_modulos_empresa := v_plano.modulos_habilitados;
  END IF;

  SELECT coalesce(array_agg(recurso_codigo), '{}'::text[])
    INTO v_modulos_empresa
  FROM (
    SELECT unnest(v_modulos_empresa) AS recurso_codigo
    UNION
    SELECT recurso_codigo
    FROM public.saas_empresa_overrides
    WHERE empresa_id = p_empresa_id AND efeito = 'LIBERAR'
  ) sub;

  IF p_modulos IS NOT NULL THEN
    FOREACH v_mod IN ARRAY p_modulos LOOP
      IF v_mod = ANY(v_modulos_empresa) AND NOT (v_mod = ANY(v_modulos_filtrados)) THEN
        v_modulos_filtrados := array_append(v_modulos_filtrados, v_mod);
      END IF;
    END LOOP;
  END IF;

  SELECT id INTO v_usuario_id
  FROM public.usuarios
  WHERE lower(trim(email)) = v_email_clean
  ORDER BY ativo DESC, created_at ASC
  LIMIT 1;

  IF v_usuario_id IS NULL THEN
    INSERT INTO public.usuarios (nome, email, perfil, ativo)
    VALUES (trim(p_nome), v_email_clean, 'visualizador', true)
    RETURNING id INTO v_usuario_id;
  ELSE
    UPDATE public.usuarios
    SET nome = coalesce(nullif(trim(nome), ''), trim(p_nome)),
        ativo = true,
        updated_at = NOW()
    WHERE id = v_usuario_id;
  END IF;

  IF p_is_responsavel THEN
    UPDATE public.empresa_usuarios
    SET is_responsavel_principal = false, updated_at = NOW()
    WHERE empresa_id = p_empresa_id AND is_responsavel_principal = true;
  END IF;

  INSERT INTO public.empresa_usuarios (
    empresa_id, usuario_id, papel_id, ativo, status,
    is_responsavel_principal, erp_modulos_visiveis,
    convite_enviado_em, origem
  ) VALUES (
    p_empresa_id, v_usuario_id, p_papel_id, true, 'CONVIDADO',
    p_is_responsavel, v_modulos_filtrados, NOW(), 'PLATAFORMA_HUB'
  )
  ON CONFLICT (empresa_id, usuario_id) WHERE ativo = true
  DO UPDATE SET
    papel_id = EXCLUDED.papel_id,
    status = 'CONVIDADO',
    is_responsavel_principal = EXCLUDED.is_responsavel_principal,
    erp_modulos_visiveis = EXCLUDED.erp_modulos_visiveis,
    convite_enviado_em = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_empresa_usuario_id;

  INSERT INTO public.plataforma_auditoria (
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'CONVIDAR_USUARIO', 'empresa_usuarios', v_empresa_usuario_id,
    jsonb_build_object(
      'empresa_id', p_empresa_id,
      'usuario_id', v_usuario_id,
      'nome', trim(p_nome),
      'email', v_email_clean,
      'papel_id', p_papel_id,
      'is_responsavel', p_is_responsavel,
      'modulos_efetivos', v_modulos_filtrados,
      'perfil_base', 'visualizador'
    ),
    auth.uid()
  );

  RETURN v_empresa_usuario_id;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_papel_empresa_usuario() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validar_papel_empresa_usuario() TO service_role;

REVOKE ALL ON FUNCTION public.rpc_platform_convidar_usuario(uuid,text,text,uuid,text[],boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_convidar_usuario(uuid,text,text,uuid,text[],boolean)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_ativar_meus_convites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória.';
  END IF;

  UPDATE public.empresa_usuarios eu
  SET status = 'ATIVO', ativo = true, updated_at = NOW()
  FROM public.usuarios u
  WHERE u.id = eu.usuario_id
    AND u.auth_user_id = auth.uid()
    AND u.ativo = true
    AND eu.ativo = true
    AND eu.status = 'CONVIDADO';

  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_ativar_meus_convites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_ativar_meus_convites() TO authenticated, service_role;

COMMIT;
