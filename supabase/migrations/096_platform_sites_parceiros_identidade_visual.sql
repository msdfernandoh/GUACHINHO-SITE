-- ==============================================================================
-- MIGRATION 096: PLATFORM SITES DE PARCEIROS — IDENTIDADE VISUAL & HERANÇA
-- Descrição: Permite que sites de parceiros herdem o modelo de site e identidade
--            visual da Master Franquia ou definam overrides próprios (logo, cores,
--            banner, contatos) sem duplicar ou modificar templates globais.
-- Data: 19/08/2026
-- ==============================================================================

-- 1. RPC para Salvar/Atualizar Identidade Visual do Site de Parceiro
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_identidade_site_parceiro(
  p_site_id uuid,
  p_empresa_id uuid,
  p_identidade_visual_modo text DEFAULT 'HERDAR_MASTER',
  p_logo_url text DEFAULT NULL,
  p_cor_primaria text DEFAULT NULL,
  p_cor_secundaria text DEFAULT NULL,
  p_cor_destaque text DEFAULT NULL,
  p_foto_perfil_url text DEFAULT NULL,
  p_banner_url text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_instagram text DEFAULT NULL,
  p_texto_hero text DEFAULT NULL,
  p_texto_sobre text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_site record;
  v_novo_branding jsonb;
  v_modo text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_site
  FROM public.parceiro_sites
  WHERE id = p_site_id AND empresa_id = p_empresa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site de parceiro não encontrado para esta empresa.';
  END IF;

  v_modo := upper(coalesce(nullif(trim(p_identidade_visual_modo), ''), 'HERDAR_MASTER'));
  IF v_modo NOT IN ('HERDAR_MASTER', 'PERSONALIZADA') THEN
    v_modo := 'HERDAR_MASTER';
  END IF;

  IF v_modo = 'HERDAR_MASTER' THEN
    -- Reseta overrides para herdar diretamente da Master Franquia
    v_novo_branding := jsonb_build_object(
      'identidade_visual_modo', 'HERDAR_MASTER',
      'telefone', nullif(trim(coalesce(p_telefone, '')), ''),
      'whatsapp', nullif(trim(coalesce(p_whatsapp, '')), ''),
      'instagram', nullif(trim(coalesce(p_instagram, '')), '')
    );
  ELSE
    -- Armazena overrides específicos deste parceiro
    v_novo_branding := jsonb_build_object(
      'identidade_visual_modo', 'PERSONALIZADA',
      'logo_url', nullif(trim(coalesce(p_logo_url, '')), ''),
      'cor_primaria', nullif(trim(coalesce(p_cor_primaria, '')), ''),
      'cor_secundaria', nullif(trim(coalesce(p_cor_secundaria, '')), ''),
      'cor_destaque', nullif(trim(coalesce(p_cor_destaque, '')), ''),
      'foto_perfil_url', nullif(trim(coalesce(p_foto_perfil_url, '')), ''),
      'banner_url', nullif(trim(coalesce(p_banner_url, '')), ''),
      'telefone', nullif(trim(coalesce(p_telefone, '')), ''),
      'whatsapp', nullif(trim(coalesce(p_whatsapp, '')), ''),
      'instagram', nullif(trim(coalesce(p_instagram, '')), ''),
      'texto_hero', nullif(trim(coalesce(p_texto_hero, '')), ''),
      'texto_sobre', nullif(trim(coalesce(p_texto_sobre, '')), '')
    );
  END IF;

  UPDATE public.parceiro_sites
  SET
    branding = coalesce(v_site.branding, '{}'::jsonb) || v_novo_branding,
    whatsapp = coalesce(nullif(trim(coalesce(p_whatsapp, '')), ''), v_site.whatsapp),
    updated_at = NOW()
  WHERE id = p_site_id AND empresa_id = p_empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ATUALIZAR_IDENTIDADE_SITE_PARCEIRO',
    'parceiro_sites',
    p_site_id,
    jsonb_build_object(
      'modo_anterior', coalesce(v_site.branding->>'identidade_visual_modo', 'HERDAR_MASTER'),
      'modo_novo', v_modo,
      'branding', v_novo_branding
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 2. Atualizar RPC de criação para suportar o modo de identidade inicial
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_site_parceiro(
  p_empresa_id uuid,
  p_organizacao_parceira_id uuid,
  p_slug text,
  p_nome_site text,
  p_whatsapp text DEFAULT NULL,
  p_canal text DEFAULT 'SUBDOMINIO',
  p_identidade_visual_modo text DEFAULT 'HERDAR_MASTER',
  p_cor_primaria text DEFAULT NULL,
  p_cor_secundaria text DEFAULT NULL,
  p_cor_destaque text DEFAULT NULL,
  p_logo_url text DEFAULT NULL
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
  v_branding jsonb;
  v_template_codigo text;
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
      RAISE EXCEPTION 'Limite de sites com domínio próprio atingido (% de %).', v_total_dominios, v_quotas.max_sites_dominio_proprio;
    END IF;
  END IF;

  v_slug := lower(trim(regexp_replace(p_slug, '[^a-zA-Z0-9_-]', '', 'g')));
  IF v_slug = '' THEN
    RAISE EXCEPTION 'Slug do site inválido.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.parceiro_sites WHERE slug = v_slug AND empresa_id = p_empresa_id AND ativo = true) THEN
    RAISE EXCEPTION 'Já existe um site com este slug nesta empresa.';
  END IF;

  -- Herda o template configurado no branding da empresa ou fallback para institucional_v1
  SELECT coalesce(template_codigo, 'institucional_v1') INTO v_template_codigo
  FROM public.empresa_branding
  WHERE empresa_id = p_empresa_id;

  IF v_template_codigo IS NULL THEN
    v_template_codigo := 'institucional_v1';
  END IF;

  IF p_identidade_visual_modo = 'PERSONALIZADA' THEN
    v_branding := jsonb_build_object(
      'identidade_visual_modo', 'PERSONALIZADA',
      'cor_primaria', nullif(trim(coalesce(p_cor_primaria, '')), ''),
      'cor_secundaria', nullif(trim(coalesce(p_cor_secundaria, '')), ''),
      'cor_destaque', nullif(trim(coalesce(p_cor_destaque, '')), ''),
      'logo_url', nullif(trim(coalesce(p_logo_url, '')), ''),
      'whatsapp', nullif(trim(coalesce(p_whatsapp, '')), '')
    );
  ELSE
    v_branding := jsonb_build_object(
      'identidade_visual_modo', 'HERDAR_MASTER',
      'whatsapp', nullif(trim(coalesce(p_whatsapp, '')), '')
    );
  END IF;

  INSERT INTO public.parceiro_sites (
    empresa_id,
    organizacao_parceira_id,
    slug,
    nome_site,
    whatsapp,
    canal_principal,
    status_publicacao,
    template_codigo,
    branding,
    ativo,
    created_by_usuario_id
  ) VALUES (
    p_empresa_id,
    p_organizacao_parceira_id,
    v_slug,
    trim(p_nome_site),
    nullif(trim(coalesce(p_whatsapp, '')), ''),
    coalesce(p_canal, 'SUBDOMINIO'),
    'PUBLICADO',
    v_template_codigo,
    v_branding,
    true,
    auth.uid()
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
      'organizacao_parceira_id', p_organizacao_parceira_id,
      'slug', v_slug,
      'nome_site', p_nome_site,
      'canal', p_canal,
      'identidade_visual_modo', coalesce(p_identidade_visual_modo, 'HERDAR_MASTER')
    ),
    auth.uid()
  );

  RETURN v_site_id;
END;
$$;
