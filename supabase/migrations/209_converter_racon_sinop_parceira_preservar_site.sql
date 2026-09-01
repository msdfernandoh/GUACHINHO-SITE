-- Fase 209: corrige a identidade de autoria do site parceiro e converte a
-- Master Racon Sinop, vazia, em parceira da Gauchinho sem interromper o dominio.

BEGIN;

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
  v_usuario_id uuid := public.current_usuario_id();
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuario interno ativo nao localizado para o login atual.';
  END IF;

  SELECT * INTO v_quotas FROM public.empresa_quotas WHERE empresa_id = p_empresa_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quotas da empresa nao configuradas.'; END IF;
  IF NOT v_quotas.permite_sites_parceiros THEN
    RAISE EXCEPTION 'O plano desta Master Franquia nao permite a criacao de sites de parceiros.';
  END IF;

  SELECT count(*) INTO v_total_sites
  FROM public.parceiro_sites WHERE empresa_id = p_empresa_id AND ativo = true;
  IF v_quotas.max_sites_parceiros > 0 AND v_total_sites >= v_quotas.max_sites_parceiros THEN
    RAISE EXCEPTION 'Limite de sites de parceiros contratados atingido (% de %).', v_total_sites, v_quotas.max_sites_parceiros;
  END IF;

  IF p_canal = 'DOMINIO' THEN
    SELECT count(*) INTO v_total_dominios
    FROM public.parceiro_sites
    WHERE empresa_id = p_empresa_id AND canal_principal = 'DOMINIO' AND ativo = true;
    IF v_quotas.max_sites_dominio_proprio > 0 AND v_total_dominios >= v_quotas.max_sites_dominio_proprio THEN
      RAISE EXCEPTION 'Limite de sites com dominio proprio atingido (% de %).', v_total_dominios, v_quotas.max_sites_dominio_proprio;
    END IF;
  END IF;

  v_slug := lower(trim(regexp_replace(p_slug, '[^a-zA-Z0-9_-]', '', 'g')));
  IF v_slug = '' THEN RAISE EXCEPTION 'Slug do site invalido.'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.parceiro_sites
    WHERE slug = v_slug AND empresa_id = p_empresa_id AND ativo = true
  ) THEN RAISE EXCEPTION 'Ja existe um site com este slug nesta empresa.'; END IF;

  SELECT coalesce(template_codigo, 'institucional_v1') INTO v_template_codigo
  FROM public.empresa_branding WHERE empresa_id = p_empresa_id;
  IF v_template_codigo IS NULL THEN v_template_codigo := 'institucional_v1'; END IF;

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
    empresa_id, organizacao_parceira_id, slug, nome_site, whatsapp,
    canal_principal, status_publicacao, template_codigo, branding, ativo,
    created_by_usuario_id
  ) VALUES (
    p_empresa_id, p_organizacao_parceira_id, v_slug, trim(p_nome_site),
    nullif(trim(coalesce(p_whatsapp, '')), ''), coalesce(p_canal, 'SUBDOMINIO'),
    'PUBLICADO', v_template_codigo, v_branding, true, v_usuario_id
  ) RETURNING id INTO v_site_id;

  INSERT INTO public.plataforma_auditoria (
    acao, entidade_tipo, entidade_id, campos_alterados, executado_por
  ) VALUES (
    'CRIAR_SITE_PARCEIRO', 'parceiro_sites', v_site_id,
    jsonb_build_object(
      'empresa_id', p_empresa_id,
      'organizacao_parceira_id', p_organizacao_parceira_id,
      'slug', v_slug,
      'nome_site', p_nome_site,
      'canal', p_canal,
      'identidade_visual_modo', coalesce(p_identidade_visual_modo, 'HERDAR_MASTER')
    ), auth.uid()
  );

  RETURN v_site_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_criar_site_parceiro(uuid,uuid,text,text,text,text,text,text,text,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_criar_site_parceiro(uuid,uuid,text,text,text,text,text,text,text,text,text)
  TO authenticated;

-- Conversao assistida solicitada: somente executa se todos os identificadores
-- continuarem correspondendo aos registros auditados e a origem ainda estiver ativa.
DO $$
DECLARE
  v_origem constant uuid := '87df83a8-1d22-4bd1-9712-5cb08915c4a0';
  v_destino constant uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_modelo constant uuid := 'c8ab9965-9fad-4725-be10-a0d3a758b823';
  v_auth_superadmin constant uuid := '5dfd1ca3-ee2c-43a1-b294-8d11c698a434';
  v_fatos bigint;
  v_resultado jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = v_origem AND slug = 'racon-sinop' AND ativo = true
  ) THEN
    RETURN;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresas WHERE id = v_destino AND ativo = true
  ) THEN RAISE EXCEPTION 'Master Gauchinho anfitria nao esta ativa.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.site_modelos
    WHERE id = v_modelo AND codigo = 'racon_inspired' AND status = 'PUBLICADO'
  ) THEN RAISE EXCEPTION 'Modelo Racon Inspired publicado nao localizado.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_dominios
    WHERE empresa_id = v_origem AND lower(valor) = 'raconsinop.com.br'
      AND principal AND ativo AND verificado AND status_ssl = 'READY'
  ) THEN RAISE EXCEPTION 'Dominio raconsinop.com.br nao esta publicado e pronto.'; END IF;

  SELECT
    (SELECT count(*) FROM public.leads WHERE empresa_id = v_origem) +
    (SELECT count(*) FROM public.propostas WHERE empresa_id = v_origem) +
    (SELECT count(*) FROM public.contratacoes_online WHERE empresa_id = v_origem) +
    (SELECT count(*) FROM public.vendas WHERE empresa_id = v_origem) +
    (SELECT count(*) FROM public.caixa_movimentos WHERE empresa_id = v_origem)
  INTO v_fatos;
  IF v_fatos <> 0 THEN
    RAISE EXCEPTION 'Racon Sinop passou a possuir % fatos operacionais; conversao interrompida.', v_fatos;
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_auth_superadmin::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_auth_superadmin::text, 'role', 'authenticated')::text, true);

  v_resultado := public.rpc_platform_converter_master_em_parceira(
    v_origem, v_destino, v_modelo, 'CONVERTER PARA PARCEIRO'
  );
  IF COALESCE(v_resultado->>'site_id', '') = '' THEN
    RAISE EXCEPTION 'Conversao nao retornou o site parceiro criado.';
  END IF;
END;
$$;

COMMIT;
NOTIFY pgrst, 'reload schema';
