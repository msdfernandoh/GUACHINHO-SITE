-- Hardening A: identidade Auth -> usuarios -> empresa_usuarios e autorização tenant.
-- Forward-only. Não altera dados comerciais, financeiros ou regras de comissão.

CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT u.id
  FROM public.usuarios AS u
  WHERE u.auth_user_id = auth.uid()
    AND u.ativo = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_platform_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    JOIN public.papeis AS p ON p.id = eu.papel_id
    WHERE eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.codigo = 'super_admin'
      AND p.escopo = 'PLATFORM'
      AND p.empresa_id IS NULL
      AND p.ativo = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
  )
$$;

CREATE OR REPLACE FUNCTION public.has_company_role(p_empresa_id uuid, p_role_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    JOIN public.papeis AS p ON p.id = eu.papel_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.codigo = p_role_code
      AND p.escopo = 'COMPANY'
      AND p.ativo = true
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.has_company_permission(p_empresa_id uuid, p_permission_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    JOIN public.papeis AS p ON p.id = eu.papel_id
    JOIN public.papel_permissoes AS pp ON pp.papel_id = p.id
    JOIN public.permissoes AS perm ON perm.id = pp.permissao_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.escopo = 'COMPANY'
      AND p.ativo = true
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
      AND perm.codigo = p_permission_code
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_tenant_internal(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    JOIN public.papeis AS p ON p.id = eu.papel_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.codigo IN ('admin_empresa', 'gestor', 'consultor', 'visualizador')
      AND p.escopo = 'COMPANY'
      AND p.ativo = true
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_tenant_internal(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios AS eu
    JOIN public.papeis AS p ON p.id = eu.papel_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.codigo = 'admin_empresa'
      AND p.escopo = 'COMPANY'
      AND p.ativo = true
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
  )
$$;

REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_superadmin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_company_role(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_company_permission(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_tenant_internal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_tenant_internal(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_company_role(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_company_permission(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_tenant_internal(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_tenant_internal(uuid) TO authenticated, service_role;
