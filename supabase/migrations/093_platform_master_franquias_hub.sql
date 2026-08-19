-- ==============================================================================
-- Migration 093: Plataforma SaaS - HUB Operacional Completo de Master Franquias
--                (Ativação com Checklist, Suspensão com Motivo, Troca de Plano,
--                 Troca de Modelo, Concessão de Administradoras e Gestão de Parceiros)
-- Data: 19/08/2026
-- ==============================================================================

BEGIN;

-- 1. RPC para Atualizar Dados Cadastrais da Master Franquia
CREATE OR REPLACE FUNCTION public.rpc_platform_atualizar_dados_empresa(
  p_empresa_id uuid,
  p_nome_fantasia text,
  p_razao_social text,
  p_cnpj text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_old FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  UPDATE public.empresas
  SET
    nome_fantasia = coalesce(nullif(trim(p_nome_fantasia), ''), nome_fantasia),
    razao_social = coalesce(nullif(trim(p_razao_social), ''), razao_social),
    cnpj = nullif(trim(p_cnpj), ''),
    telefone = nullif(trim(p_telefone), ''),
    whatsapp = nullif(trim(p_whatsapp), ''),
    email = nullif(trim(p_email), ''),
    cidade = nullif(trim(p_cidade), ''),
    estado = nullif(trim(p_estado), ''),
    updated_at = NOW()
  WHERE id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ATUALIZAR_DADOS_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'nome_fantasia', p_nome_fantasia,
      'razao_social', p_razao_social,
      'cnpj', p_cnpj,
      'cidade', p_cidade,
      'estado', p_estado
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 2. RPC para Ativar Empresa com Validação de Prontidão
CREATE OR REPLACE FUNCTION public.rpc_platform_ativar_empresa(
  p_empresa_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa record;
  v_tem_assinatura boolean;
  v_tem_admin boolean;
  v_tem_usuario boolean;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_empresa FROM public.empresas WHERE id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa não encontrada.';
  END IF;

  -- Validação de prontidão mínima
  SELECT EXISTS (
    SELECT 1 FROM public.saas_assinaturas
    WHERE empresa_id = p_empresa_id AND status IN ('ATIVA', 'TREINAMENTO', 'PENDENTE')
  ) INTO v_tem_assinatura;

  IF NOT v_tem_assinatura THEN
    RAISE EXCEPTION 'Não é possível ativar: a Master Franquia deve possuir uma assinatura SaaS vinculada.';
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

  -- Efetivar ativação
  UPDATE public.empresas
  SET
    status = 'ativa',
    ativo = true,
    updated_at = NOW()
  WHERE id = p_empresa_id;

  -- Atualizar assinatura para ATIVA caso estivesse em treinamento
  UPDATE public.saas_assinaturas
  SET status = 'ATIVA', updated_at = NOW()
  WHERE empresa_id = p_empresa_id AND status = 'TREINAMENTO';

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ATIVAR_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object('status_anterior', v_empresa.status, 'status_novo', 'ativa'),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 3. RPC para Suspender Empresa com Motivo e Observação (Preserva Dados)
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
  SET
    status = 'suspensa',
    ativo = false,
    updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'SUSPENSA', updated_at = NOW()
  WHERE empresa_id = p_empresa_id AND status = 'ATIVA';

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'SUSPENDER_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'status_anterior', v_empresa.status,
      'status_novo', 'suspensa',
      'motivo', p_motivo,
      'observacao', p_observacao
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 4. RPC para Reativar Empresa Suspensa ou Inativa
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
  SET
    status = 'ativa',
    ativo = true,
    updated_at = NOW()
  WHERE id = p_empresa_id;

  UPDATE public.saas_assinaturas
  SET status = 'ATIVA', updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'REATIVAR_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object('status_anterior', v_empresa.status, 'status_novo', 'ativa'),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 5. RPC para Trocar Plano SaaS da Empresa com Atualização de Quotas
CREATE OR REPLACE FUNCTION public.rpc_platform_alterar_plano_empresa(
  p_empresa_id uuid,
  p_novo_plano_id uuid,
  p_usuarios_contratados int DEFAULT NULL,
  p_sites_parceiros_contratados int DEFAULT NULL,
  p_sites_dominio_proprio_contratados int DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo_plano record;
  v_assinatura record;
  v_usuarios int;
  v_sites int;
  v_dominios int;
  v_total_estimado numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_novo_plano FROM public.saas_planos WHERE id = p_novo_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Novo Plano SaaS não encontrado.';
  END IF;

  SELECT * INTO v_assinatura FROM public.saas_assinaturas WHERE empresa_id = p_empresa_id ORDER BY created_at DESC LIMIT 1;

  v_usuarios := coalesce(p_usuarios_contratados, v_assinatura.usuarios_contratados, v_novo_plano.limite_usuarios);
  v_sites := coalesce(p_sites_parceiros_contratados, v_assinatura.sites_parceiros_contratados, 0);
  v_dominios := coalesce(p_sites_dominio_proprio_contratados, v_assinatura.sites_dominio_proprio_contratados, 0);

  IF v_novo_plano.limite_usuarios > 0 AND v_usuarios > v_novo_plano.limite_usuarios THEN
    v_usuarios := v_novo_plano.limite_usuarios;
  END IF;

  IF v_novo_plano.permite_sites_parceiros AND v_novo_plano.max_sites_parceiros > 0 AND v_sites > v_novo_plano.max_sites_parceiros THEN
    v_sites := v_novo_plano.max_sites_parceiros;
  END IF;

  IF v_novo_plano.permite_sites_parceiros AND v_novo_plano.max_sites_dominio_proprio > 0 AND v_dominios > v_novo_plano.max_sites_dominio_proprio THEN
    v_dominios := v_novo_plano.max_sites_dominio_proprio;
  END IF;

  v_total_estimado := v_novo_plano.valor_mensal + (v_sites * v_novo_plano.valor_site_parceiro) + (v_dominios * v_novo_plano.valor_site_dominio_proprio);

  IF v_assinatura.id IS NOT NULL THEN
    UPDATE public.saas_assinaturas
    SET
      plano_id = p_novo_plano_id,
      usuarios_contratados = v_usuarios,
      sites_parceiros_contratados = v_sites,
      sites_dominio_proprio_contratados = v_dominios,
      valor_mensal = v_novo_plano.valor_mensal,
      valor_total_estimado = v_total_estimado,
      updated_at = NOW()
    WHERE id = v_assinatura.id;
  ELSE
    INSERT INTO public.saas_assinaturas (
      empresa_id,
      plano_id,
      status,
      usuarios_contratados,
      sites_parceiros_contratados,
      sites_dominio_proprio_contratados,
      valor_mensal,
      valor_total_estimado
    ) VALUES (
      p_empresa_id,
      p_novo_plano_id,
      'ATIVA',
      v_usuarios,
      v_sites,
      v_dominios,
      v_novo_plano.valor_mensal,
      v_total_estimado
    );
  END IF;

  -- Sincronizar quotas
  UPDATE public.empresa_quotas
  SET
    limite_usuarios = v_usuarios,
    max_parceiros = v_novo_plano.max_parceiros,
    max_sites_parceiros = v_sites,
    max_sites_dominio_proprio = v_dominios,
    permite_sites_parceiros = v_novo_plano.permite_sites_parceiros,
    updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ALTERAR_PLANO_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'plano_anterior_id', v_assinatura.plano_id,
      'plano_novo_id', p_novo_plano_id,
      'plano_novo_nome', v_novo_plano.nome,
      'usuarios', v_usuarios,
      'sites', v_sites,
      'dominios', v_dominios,
      'valor_estimado', v_total_estimado
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 6. RPC para Trocar Modelo de Site da Empresa
CREATE OR REPLACE FUNCTION public.rpc_platform_alterar_modelo_empresa(
  p_empresa_id uuid,
  p_novo_modelo_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_modelo record;
  v_old_modelo_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_modelo FROM public.site_modelos WHERE id = p_novo_modelo_id AND status = 'PUBLICADO';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de Site não encontrado ou não está publicado.';
  END IF;

  SELECT modelo_id INTO v_old_modelo_id FROM public.empresa_branding WHERE empresa_id = p_empresa_id;

  UPDATE public.empresa_branding
  SET
    modelo_id = p_novo_modelo_id,
    template_codigo = v_modelo.codigo,
    updated_at = NOW()
  WHERE empresa_id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ALTERAR_MODELO_SITE_EMPRESA',
    'empresas',
    p_empresa_id,
    jsonb_build_object(
      'modelo_anterior_id', v_old_modelo_id,
      'modelo_novo_id', p_novo_modelo_id,
      'modelo_novo_codigo', v_modelo.codigo,
      'modelo_novo_nome', v_modelo.nome
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 7. RPC para Conceder Administradora à Empresa
CREATE OR REPLACE FUNCTION public.rpc_platform_conceder_administradora_empresa(
  p_empresa_id uuid,
  p_administradora_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_admin FROM public.administradoras WHERE id = p_administradora_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administradora não encontrada.';
  END IF;

  INSERT INTO public.empresa_administradoras (
    empresa_id,
    administradora_id,
    status
  ) VALUES (
    p_empresa_id,
    p_administradora_id,
    'ATIVA'
  )
  ON CONFLICT (empresa_id, administradora_id)
  DO UPDATE SET status = 'ATIVA', updated_at = NOW();

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'CONCEDER_ADMINISTRADORA',
    'empresa_administradoras',
    p_empresa_id,
    jsonb_build_object('administradora_id', p_administradora_id, 'administradora_nome', v_admin.nome),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 8. RPC para Revogar ou Suspender Administradora da Empresa
CREATE OR REPLACE FUNCTION public.rpc_platform_revogar_administradora_empresa(
  p_empresa_id uuid,
  p_administradora_id uuid,
  p_status text DEFAULT 'INATIVA'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  UPDATE public.empresa_administradoras
  SET status = coalesce(p_status, 'INATIVA'), updated_at = NOW()
  WHERE empresa_id = p_empresa_id AND administradora_id = p_administradora_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'REVOGAR_ADMINISTRADORA',
    'empresa_administradoras',
    p_empresa_id,
    jsonb_build_object('administradora_id', p_administradora_id, 'novo_status', p_status),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 9. RPC para Criar Site de Parceiro Validando Quotas da Master
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_site_parceiro(
  p_empresa_id uuid,
  p_organizacao_parceira_id uuid,
  p_slug text,
  p_nome_site text,
  p_whatsapp text DEFAULT NULL,
  p_canal text DEFAULT 'SUBDOMINIO'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotas record;
  v_total_sites int;
  v_total_dominios int;
  v_site_id uuid;
  v_slug text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_quotas FROM public.empresa_quotas WHERE empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quotas da empresa não configuradas.';
  END IF;

  IF NOT v_quotas.permite_sites_parceiros THEN
    RAISE EXCEPTION 'O plano desta Master Franquia não permite a criação de sites de parceiros.';
  END IF;

  SELECT count(*) INTO v_total_sites
  FROM public.parceiro_sites
  WHERE empresa_id = p_empresa_id AND ativo = true;

  IF v_quotas.max_sites_parceiros > 0 AND v_total_sites >= v_quotas.max_sites_parceiros THEN
    RAISE EXCEPTION 'Limite de sites de parceiros contratados atingido (% de %). Solicite aumento de quota.', v_total_sites, v_quotas.max_sites_parceiros;
  END IF;

  IF p_canal = 'DOMINIO' THEN
    SELECT count(*) INTO v_total_dominios
    FROM public.parceiro_sites
    WHERE empresa_id = p_empresa_id AND canal_principal = 'DOMINIO' AND ativo = true;

    IF v_quotas.max_sites_dominio_proprio > 0 AND v_total_dominios >= v_quotas.max_sites_dominio_proprio THEN
      RAISE EXCEPTION 'Limite de domínios próprios de parceiros contratados atingido (% de %).', v_total_dominios, v_quotas.max_sites_dominio_proprio;
    END IF;
  END IF;

  v_slug := lower(regexp_replace(trim(p_slug), '[^a-z0-9-]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  IF EXISTS (SELECT 1 FROM public.parceiro_sites WHERE empresa_id = p_empresa_id AND slug = v_slug) THEN
    RAISE EXCEPTION 'Já existe um site com o endereço % cadastrado para esta franquia.', v_slug;
  END IF;

  INSERT INTO public.parceiro_sites (
    empresa_id,
    organizacao_parceira_id,
    slug,
    nome_site,
    whatsapp,
    canal_principal,
    status_publicacao,
    ativo
  ) VALUES (
    p_empresa_id,
    p_organizacao_parceira_id,
    v_slug,
    trim(p_nome_site),
    nullif(trim(p_whatsapp), ''),
    coalesce(p_canal, 'SUBDOMINIO'),
    'PUBLICADO',
    true
  )
  RETURNING id INTO v_site_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'CRIAR_SITE_PARCEIRO',
    'parceiro_sites',
    v_site_id,
    jsonb_build_object(
      'empresa_id', p_empresa_id,
      'organizacao_id', p_organizacao_parceira_id,
      'slug', v_slug,
      'canal', p_canal
    ),
    auth.uid()
  );

  RETURN v_site_id;
END;
$$;

COMMIT;
