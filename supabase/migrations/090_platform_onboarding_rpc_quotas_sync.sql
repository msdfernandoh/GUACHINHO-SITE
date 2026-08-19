-- Migration 090: Platform Onboarding RPC Quotas Sync
-- Data: 18/08/2026

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_platform_onboarding_master_franquia(
  p_nome_fantasia text,
  p_razao_social text,
  p_slug text,
  p_cnpj text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_telefone text DEFAULT NULL,
  p_whatsapp text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_modelo_site_id uuid DEFAULT NULL,
  p_usar_logo_propria boolean DEFAULT false,
  p_logo_url text DEFAULT NULL,
  p_menus_habilitados jsonb DEFAULT '[]'::jsonb,
  p_erp_habilitado boolean DEFAULT true,
  p_modulos_erp text[] DEFAULT '{}'::text[],
  p_limite_usuarios integer DEFAULT 10,
  p_responsavel_nome text DEFAULT NULL,
  p_responsavel_email text DEFAULT NULL,
  p_responsavel_telefone text DEFAULT NULL,
  p_administradoras_ids uuid[] DEFAULT '{}'::uuid[],
  p_plano_id uuid DEFAULT NULL,
  p_sites_parceiros_contratados integer DEFAULT 0,
  p_sites_dominio_proprio_contratados integer DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id uuid;
  v_slug text;
  v_admin_id uuid;
  v_plano public.saas_planos%ROWTYPE;
  v_total_estimado numeric := 0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  p_nome_fantasia := trim(coalesce(p_nome_fantasia, ''));
  p_razao_social := trim(coalesce(p_razao_social, ''));
  IF p_nome_fantasia = '' OR p_razao_social = '' THEN
    RAISE EXCEPTION 'Nome fantasia e Razão social são obrigatórios.';
  END IF;

  IF p_slug IS NULL OR trim(p_slug) = '' THEN
    v_slug := lower(regexp_replace(translate(p_nome_fantasia, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'), '[^a-z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
  ELSE
    v_slug := lower(trim(p_slug));
  END IF;

  IF NOT (v_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$') THEN
    RAISE EXCEPTION 'Slug inválido (deve conter apenas letras minúsculas, números e hífens).';
  END IF;

  IF EXISTS (SELECT 1 FROM public.empresas WHERE slug = v_slug) THEN
    RAISE EXCEPTION 'Slug "%" já está em uso por outra empresa.', v_slug;
  END IF;

  -- 1. Criar empresa no status seguro 'em_treinamento'
  INSERT INTO public.empresas (
    nome_fantasia,
    razao_social,
    slug,
    cnpj,
    status,
    ativo,
    configuracoes
  ) VALUES (
    p_nome_fantasia,
    p_razao_social,
    v_slug,
    nullif(trim(p_cnpj), ''),
    'em_treinamento',
    false,
    jsonb_build_object(
      'email', nullif(trim(p_email), ''),
      'telefone', nullif(trim(p_telefone), ''),
      'whatsapp', nullif(trim(p_whatsapp), ''),
      'cidade', nullif(trim(p_cidade), ''),
      'estado', nullif(trim(p_estado), ''),
      'erp_habilitado', p_erp_habilitado,
      'modulos_erp_selecionados', p_modulos_erp,
      'limite_usuarios', p_limite_usuarios,
      'responsavel_inicial', jsonb_build_object(
        'nome', nullif(trim(p_responsavel_nome), ''),
        'email', nullif(trim(p_responsavel_email), ''),
        'telefone', nullif(trim(p_responsavel_telefone), '')
      )
    )
  ) RETURNING id INTO v_empresa_id;

  -- 2. Criar registro de branding da empresa
  INSERT INTO public.empresa_branding (
    empresa_id,
    nome_site,
    subtitulo,
    logo_url,
    telefone,
    whatsapp,
    email_contato,
    status_publicacao
  ) VALUES (
    v_empresa_id,
    p_nome_fantasia,
    'Consórcios e Investimentos',
    nullif(trim(p_logo_url), ''),
    coalesce(trim(p_telefone), ''),
    coalesce(trim(p_whatsapp), ''),
    coalesce(trim(p_email), ''),
    'RASCUNHO'
  );

  -- 3. Vincular Modelo de Site se selecionado
  IF p_modelo_site_id IS NOT NULL THEN
    INSERT INTO public.empresa_site_modelos (
      empresa_id,
      modelo_id,
      status,
      menus_habilitados,
      usar_logo_propria
    ) VALUES (
      v_empresa_id,
      p_modelo_site_id,
      'RASCUNHO',
      p_menus_habilitados,
      p_usar_logo_propria
    );
  END IF;

  -- 4. Conceder Administradoras Selecionadas
  IF p_administradoras_ids IS NOT NULL AND array_length(p_administradoras_ids, 1) > 0 THEN
    FOREACH v_admin_id IN ARRAY p_administradoras_ids LOOP
      INSERT INTO public.empresa_administradoras (
        empresa_id,
        administradora_id,
        status
      ) VALUES (
        v_empresa_id,
        v_admin_id,
        'ATIVA'
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- 5. Vincular Plano SaaS com quotas
  IF p_plano_id IS NOT NULL THEN
    SELECT * INTO v_plano FROM public.saas_planos WHERE id = p_plano_id;
    IF FOUND THEN
      v_total_estimado := coalesce(v_plano.valor_mensal, 0)
        + (coalesce(p_sites_parceiros_contratados, 0) * coalesce(v_plano.valor_site_parceiro, 0))
        + (coalesce(p_sites_dominio_proprio_contratados, 0) * coalesce(v_plano.valor_site_dominio_proprio, 0));

      INSERT INTO public.saas_assinaturas (
        empresa_id,
        plano_id,
        status,
        usuarios_contratados,
        sites_parceiros_contratados,
        sites_dominio_proprio_contratados,
        valor_mensal,
        taxa_implantacao,
        valor_total_estimado,
        data_inicio
      ) VALUES (
        v_empresa_id,
        p_plano_id,
        'RASCUNHO',
        coalesce(p_limite_usuarios, v_plano.limite_usuarios, 10),
        coalesce(p_sites_parceiros_contratados, 0),
        coalesce(p_sites_dominio_proprio_contratados, 0),
        v_plano.valor_mensal,
        v_plano.taxa_implantacao,
        v_total_estimado,
        CURRENT_DATE
      );
    END IF;
  END IF;

  -- 6. Log de Auditoria
  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados
  ) VALUES (
    'insert',
    'empresas',
    v_empresa_id,
    jsonb_build_array('onboarding_completo', 'em_treinamento')
  );

  RETURN v_empresa_id;
END;
$$;

COMMIT;
