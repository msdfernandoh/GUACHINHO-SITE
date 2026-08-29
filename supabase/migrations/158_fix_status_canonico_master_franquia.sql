-- Corrige o ciclo de status das Master Franquias para os valores canônicos
-- protegidos por empresas_status_ativo_coerente:
-- ativo | suspenso | cancelado | em_treinamento.

CREATE OR REPLACE FUNCTION public.rpc_platform_ativar_empresa(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_empresa public.empresas%rowtype;
  v_assinatura public.saas_assinaturas%rowtype;
  v_tem_admin boolean;
  v_tem_usuario boolean;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_empresa
  FROM public.empresas
  WHERE id = p_empresa_id
  FOR UPDATE;

  IF v_empresa.id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  SELECT * INTO v_assinatura
  FROM public.saas_assinaturas
  WHERE empresa_id = p_empresa_id
    AND status IN ('ATIVA', 'TREINAMENTO', 'PENDENTE', 'RASCUNHO')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_assinatura.id IS NULL THEN
    RAISE EXCEPTION 'Não é possível ativar: a Master Franquia deve possuir um Plano SaaS com assinatura vinculada.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.empresa_administradoras
    WHERE empresa_id = p_empresa_id AND status = 'ATIVA'
  ) INTO v_tem_admin;

  IF NOT v_tem_admin THEN
    RAISE EXCEPTION 'Não é possível ativar: a Master Franquia deve possuir ao menos 1 Administradora concedida e ativa.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.empresa_usuarios
    WHERE empresa_id = p_empresa_id AND ativo = true
  ) INTO v_tem_usuario;

  IF NOT v_tem_usuario THEN
    RAISE EXCEPTION 'Não é possível ativar: a Master Franquia deve possuir ao menos 1 usuário responsável cadastrado e ativo.';
  END IF;

  UPDATE public.empresas
  SET status = 'ativo', ativo = true, updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'ATIVA', updated_at = NOW()
  WHERE id = v_assinatura.id
    AND status IN ('TREINAMENTO', 'PENDENTE', 'RASCUNHO');

  INSERT INTO public.plataforma_auditoria (
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'ATIVAR_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'status_anterior', v_empresa.status,
      'status_novo', 'ativo',
      'assinatura_id', v_assinatura.id,
      'assinatura_status_anterior', v_assinatura.status,
      'assinatura_status_novo', 'ATIVA'
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_ativar_empresa(uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_ativar_empresa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_platform_suspender_empresa(
  p_empresa_id uuid,
  p_motivo text,
  p_observacao text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'O motivo da suspensão é obrigatório.';
  END IF;

  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  UPDATE public.empresas
  SET status = 'suspenso', ativo = false, updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'SUSPENSA', updated_at = NOW()
  WHERE empresa_id = p_empresa_id AND status = 'ATIVA';

  INSERT INTO public.plataforma_auditoria (
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'SUSPENDER_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'status_anterior', v_empresa.status,
      'status_novo', 'suspenso',
      'motivo', p_motivo,
      'observacao', p_observacao
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_reativar_empresa(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  UPDATE public.empresas
  SET status = 'ativo', ativo = true, updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'ATIVA', updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'REATIVAR_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object('status_anterior', v_empresa.status, 'status_novo', 'ativo'),
    auth.uid()
  );

  RETURN true;
END;
$$;
