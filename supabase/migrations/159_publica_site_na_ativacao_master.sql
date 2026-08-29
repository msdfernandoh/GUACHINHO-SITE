-- A ativação comercial da Master Franquia também publica o site institucional.
-- A transição permanece atômica e exige domínio verificado, branding e modelo.

BEGIN;

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
  v_branding public.empresa_branding%rowtype;
  v_modelo_empresa public.empresa_site_modelos%rowtype;
  v_tem_admin boolean;
  v_tem_usuario boolean;
  v_tem_dominio_publicavel boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM public.empresa_dominios
    WHERE empresa_id = p_empresa_id
      AND principal = true
      AND ativo = true
      AND verificado = true
  ) INTO v_tem_dominio_publicavel;

  IF NOT v_tem_dominio_publicavel THEN
    RAISE EXCEPTION 'Não é possível ativar: configure e verifique o domínio principal do site.';
  END IF;

  SELECT * INTO v_branding
  FROM public.empresa_branding
  WHERE empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_branding.id IS NULL THEN
    RAISE EXCEPTION 'Não é possível ativar: a identidade do site não foi configurada.';
  END IF;

  SELECT * INTO v_modelo_empresa
  FROM public.empresa_site_modelos
  WHERE empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_modelo_empresa.empresa_id IS NULL THEN
    RAISE EXCEPTION 'Não é possível ativar: selecione um modelo de site.';
  END IF;

  UPDATE public.empresas
  SET status = 'ativo', ativo = true, updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'ATIVA', updated_at = NOW()
  WHERE id = v_assinatura.id
    AND status IN ('TREINAMENTO', 'PENDENTE', 'RASCUNHO');

  UPDATE public.empresa_branding
  SET status_publicacao = 'PUBLICADO', updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

  UPDATE public.empresa_site_modelos
  SET status = 'PUBLICADO', updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

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
      'assinatura_status_novo', 'ATIVA',
      'site_status_anterior', v_branding.status_publicacao,
      'site_status_novo', 'PUBLICADO',
      'modelo_status_anterior', v_modelo_empresa.status,
      'modelo_status_novo', 'PUBLICADO'
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_ativar_empresa(uuid) FROM public, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_ativar_empresa(uuid) TO authenticated;

-- Reconcilia empresas que foram ativadas antes de esta regra existir, somente
-- quando todo o conjunto publicável já está presente e o domínio foi verificado.
UPDATE public.empresa_branding eb
SET status_publicacao = 'PUBLICADO', updated_at = NOW()
WHERE eb.status_publicacao = 'RASCUNHO'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = eb.empresa_id AND e.status = 'ativo' AND e.ativo = true
  )
  AND EXISTS (
    SELECT 1 FROM public.empresa_dominios ed
    WHERE ed.empresa_id = eb.empresa_id
      AND ed.principal = true AND ed.ativo = true AND ed.verificado = true
  )
  AND EXISTS (
    SELECT 1 FROM public.empresa_site_modelos esm
    WHERE esm.empresa_id = eb.empresa_id
  );

UPDATE public.empresa_site_modelos esm
SET status = 'PUBLICADO', updated_at = NOW()
WHERE esm.status = 'RASCUNHO'
  AND EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = esm.empresa_id AND e.status = 'ativo' AND e.ativo = true
  )
  AND EXISTS (
    SELECT 1 FROM public.empresa_dominios ed
    WHERE ed.empresa_id = esm.empresa_id
      AND ed.principal = true AND ed.ativo = true AND ed.verificado = true
  )
  AND EXISTS (
    SELECT 1 FROM public.empresa_branding eb
    WHERE eb.empresa_id = esm.empresa_id AND eb.status_publicacao = 'PUBLICADO'
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
