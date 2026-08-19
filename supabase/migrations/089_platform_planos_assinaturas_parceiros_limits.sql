-- Migration 089: Platform Planos SaaS, Assinaturas, Limites, Sites de Parceiros e Overrides
-- Data: 18/08/2026

BEGIN;

-- 1. Extensões na tabela saas_planos
ALTER TABLE public.saas_planos
  ADD COLUMN IF NOT EXISTS erp_incluido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS site_principal_incluido boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_sites_parceiros boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_parceiros integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sites_parceiros integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_sites_dominio_proprio integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_site_parceiro numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_site_dominio_proprio numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_implantacao_site_parceiro numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_implantacao_dominio_proprio numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disponivel_novas_assinaturas boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'PADRAO';

-- 2. Extensões na tabela saas_assinaturas
ALTER TABLE public.saas_assinaturas
  ADD COLUMN IF NOT EXISTS usuarios_contratados integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS sites_parceiros_contratados integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sites_dominio_proprio_contratados integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_total_estimado numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ciclo_cobranca text DEFAULT 'MENSAL';

-- 3. Extensões na tabela erp_modulos_catalogo
ALTER TABLE public.erp_modulos_catalogo
  ADD COLUMN IF NOT EXISTS categoria text DEFAULT 'OPERACIONAL',
  ADD COLUMN IF NOT EXISTS disponibilidade text DEFAULT 'GERAL';

-- Atualizar categorias dos módulos ERP existentes
UPDATE public.erp_modulos_catalogo SET categoria = 'GESTAO' WHERE codigo IN ('painel', 'relatorios', 'metas', 'tarefas');
UPDATE public.erp_modulos_catalogo SET categoria = 'CRM' WHERE codigo IN ('leads', 'propostas');
UPDATE public.erp_modulos_catalogo SET categoria = 'COMERCIAL' WHERE codigo IN ('contratacoes', 'vendas', 'grupos');
UPDATE public.erp_modulos_catalogo SET categoria = 'FINANCEIRO' WHERE codigo IN ('comissoes', 'financeiro');
UPDATE public.erp_modulos_catalogo SET categoria = 'SISTEMA' WHERE codigo IN ('usuarios');

-- Inserir / atualizar Plano Profissional canônico de referência
INSERT INTO public.saas_planos (
  codigo, nome, descricao, status, valor_mensal, taxa_implantacao, limite_usuarios,
  erp_incluido, site_principal_incluido, permite_sites_parceiros,
  max_parceiros, max_sites_parceiros, max_sites_dominio_proprio,
  valor_site_parceiro, valor_site_dominio_proprio,
  taxa_implantacao_site_parceiro, taxa_implantacao_dominio_proprio,
  disponivel_novas_assinaturas, categoria
) VALUES (
  'plano_profissional',
  'Plano Profissional',
  'Plano padrão completo com ERP, Site Institucional e suporte a até 20 sites de parceiros.',
  'ATIVO',
  999.00,
  1500.00,
  10,
  true,
  true,
  true,
  50,
  20,
  5,
  49.90,
  79.90,
  0.00,
  0.00,
  true,
  'PADRAO'
) ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  status = EXCLUDED.status,
  valor_mensal = EXCLUDED.valor_mensal,
  limite_usuarios = EXCLUDED.limite_usuarios,
  erp_incluido = EXCLUDED.erp_incluido,
  site_principal_incluido = EXCLUDED.site_principal_incluido,
  permite_sites_parceiros = EXCLUDED.permite_sites_parceiros,
  max_parceiros = EXCLUDED.max_parceiros,
  max_sites_parceiros = EXCLUDED.max_sites_parceiros,
  max_sites_dominio_proprio = EXCLUDED.max_sites_dominio_proprio,
  valor_site_parceiro = EXCLUDED.valor_site_parceiro,
  valor_site_dominio_proprio = EXCLUDED.valor_site_dominio_proprio;

-- Associar todos os módulos ativos ao Plano Profissional
INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado)
SELECT p.id, m.id, true
FROM public.saas_planos p
CROSS JOIN public.erp_modulos_catalogo m
WHERE p.codigo = 'plano_profissional' AND m.status = 'ATIVO'
ON CONFLICT (plano_id, modulo_id) DO NOTHING;

-- 4. RPCs de Governança de Planos SaaS

CREATE OR REPLACE FUNCTION public.rpc_platform_criar_plano(
  p_nome text,
  p_codigo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_valor_mensal numeric DEFAULT 0,
  p_taxa_implantacao numeric DEFAULT 0,
  p_limite_usuarios integer DEFAULT 10,
  p_erp_incluido boolean DEFAULT true,
  p_site_principal_incluido boolean DEFAULT true,
  p_permite_sites_parceiros boolean DEFAULT false,
  p_max_parceiros integer DEFAULT 0,
  p_max_sites_parceiros integer DEFAULT 0,
  p_max_sites_dominio_proprio integer DEFAULT 0,
  p_valor_site_parceiro numeric DEFAULT 0,
  p_valor_site_dominio_proprio numeric DEFAULT 0,
  p_taxa_implantacao_site_parceiro numeric DEFAULT 0,
  p_taxa_implantacao_dominio_proprio numeric DEFAULT 0,
  p_modulos_codigos text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_codigo text;
  v_mod_cod text;
  v_mod_id uuid;
  v_dep_cod text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF trim(p_nome) IS NULL OR trim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do plano é obrigatório.';
  END IF;

  IF p_codigo IS NOT NULL AND trim(p_codigo) <> '' THEN
    v_codigo := lower(regexp_replace(trim(p_codigo), '[^a-zA-Z0-9_]', '_', 'g'));
  ELSE
    v_codigo := 'plano_' || lower(regexp_replace(trim(p_nome), '[^a-zA-Z0-9_]', '_', 'g')) || '_' || floor(extract(epoch from now()))::text;
  END IF;

  INSERT INTO public.saas_planos (
    codigo, nome, descricao, status,
    valor_mensal, taxa_implantacao, limite_usuarios,
    erp_incluido, site_principal_incluido, permite_sites_parceiros,
    max_parceiros, max_sites_parceiros, max_sites_dominio_proprio,
    valor_site_parceiro, valor_site_dominio_proprio,
    taxa_implantacao_site_parceiro, taxa_implantacao_dominio_proprio,
    disponivel_novas_assinaturas
  ) VALUES (
    v_codigo, trim(p_nome), trim(p_descricao), 'RASCUNHO',
    p_valor_mensal, p_taxa_implantacao, p_limite_usuarios,
    p_erp_incluido, p_site_principal_incluido, p_permite_sites_parceiros,
    p_max_parceiros, p_max_sites_parceiros, p_max_sites_dominio_proprio,
    p_valor_site_parceiro, p_valor_site_dominio_proprio,
    p_taxa_implantacao_site_parceiro, p_taxa_implantacao_dominio_proprio,
    true
  ) RETURNING id INTO v_id;

  -- Vincular módulos selecionados e suas dependências
  IF p_erp_incluido AND p_modulos_codigos IS NOT NULL THEN
    FOREACH v_mod_cod IN ARRAY p_modulos_codigos LOOP
      SELECT id INTO v_mod_id FROM public.erp_modulos_catalogo WHERE codigo = v_mod_cod AND status = 'ATIVO';
      IF v_mod_id IS NOT NULL THEN
        INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado)
        VALUES (v_id, v_mod_id, true)
        ON CONFLICT (plano_id, modulo_id) DO UPDATE SET habilitado = true;

        -- Resolver dependências automáticas
        FOR v_dep_cod IN
          SELECT unnest(dependencias) FROM public.erp_modulos_catalogo WHERE id = v_mod_id
        LOOP
          INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado)
          SELECT v_id, m2.id, true
          FROM public.erp_modulos_catalogo m2
          WHERE m2.codigo = v_dep_cod AND m2.status = 'ATIVO'
          ON CONFLICT (plano_id, modulo_id) DO UPDATE SET habilitado = true;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_plano(
  p_id uuid,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_valor_mensal numeric DEFAULT 0,
  p_taxa_implantacao numeric DEFAULT 0,
  p_limite_usuarios integer DEFAULT 10,
  p_erp_incluido boolean DEFAULT true,
  p_site_principal_incluido boolean DEFAULT true,
  p_permite_sites_parceiros boolean DEFAULT false,
  p_max_parceiros integer DEFAULT 0,
  p_max_sites_parceiros integer DEFAULT 0,
  p_max_sites_dominio_proprio integer DEFAULT 0,
  p_valor_site_parceiro numeric DEFAULT 0,
  p_valor_site_dominio_proprio numeric DEFAULT 0,
  p_taxa_implantacao_site_parceiro numeric DEFAULT 0,
  p_taxa_implantacao_dominio_proprio numeric DEFAULT 0,
  p_disponivel_novas_assinaturas boolean DEFAULT true,
  p_categoria text DEFAULT 'PADRAO',
  p_modulos_codigos text[] DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_mod_cod text;
  v_mod_id uuid;
  v_dep_cod text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  UPDATE public.saas_planos SET
    nome = trim(p_nome),
    descricao = trim(p_descricao),
    valor_mensal = p_valor_mensal,
    taxa_implantacao = p_taxa_implantacao,
    limite_usuarios = p_limite_usuarios,
    erp_incluido = p_erp_incluido,
    site_principal_incluido = p_site_principal_incluido,
    permite_sites_parceiros = p_permite_sites_parceiros,
    max_parceiros = p_max_parceiros,
    max_sites_parceiros = p_max_sites_parceiros,
    max_sites_dominio_proprio = p_max_sites_dominio_proprio,
    valor_site_parceiro = p_valor_site_parceiro,
    valor_site_dominio_proprio = p_valor_site_dominio_proprio,
    taxa_implantacao_site_parceiro = p_taxa_implantacao_site_parceiro,
    taxa_implantacao_dominio_proprio = p_taxa_implantacao_dominio_proprio,
    disponivel_novas_assinaturas = p_disponivel_novas_assinaturas,
    categoria = p_categoria,
    updated_at = now()
  WHERE id = p_id;

  -- Resetar módulos e reinserir com dependências resolvidas
  DELETE FROM public.saas_plano_modulos WHERE plano_id = p_id;

  IF p_erp_incluido AND p_modulos_codigos IS NOT NULL THEN
    FOREACH v_mod_cod IN ARRAY p_modulos_codigos LOOP
      SELECT id INTO v_mod_id FROM public.erp_modulos_catalogo WHERE codigo = v_mod_cod AND status = 'ATIVO';
      IF v_mod_id IS NOT NULL THEN
        INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado)
        VALUES (p_id, v_mod_id, true)
        ON CONFLICT (plano_id, modulo_id) DO UPDATE SET habilitado = true;

        -- Resolver dependências automáticas
        FOR v_dep_cod IN
          SELECT unnest(dependencias) FROM public.erp_modulos_catalogo WHERE id = v_mod_id
        LOOP
          INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado)
          SELECT p_id, m2.id, true
          FROM public.erp_modulos_catalogo m2
          WHERE m2.codigo = v_dep_cod AND m2.status = 'ATIVO'
          ON CONFLICT (plano_id, modulo_id) DO UPDATE SET habilitado = true;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_status_plano(
  p_id uuid,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status_norm text := upper(trim(p_status));
  v_count_assinaturas integer;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF v_status_norm NOT IN ('RASCUNHO', 'ATIVO', 'INATIVO') THEN
    RAISE EXCEPTION 'Status inválido. Deve ser RASCUNHO, ATIVO ou INATIVO.';
  END IF;

  -- Se tentar inativar ou alterar status, verificar se existem assinaturas ativas
  IF v_status_norm = 'INATIVO' THEN
    SELECT count(*) INTO v_count_assinaturas FROM public.saas_assinaturas WHERE plano_id = p_id AND status = 'ATIVA';
    IF v_count_assinaturas > 0 THEN
      RAISE EXCEPTION 'Não é permitido inativar plano com % assinatura(s) ativa(s). Transfira as assinaturas antes.', v_count_assinaturas;
    END IF;
  END IF;

  UPDATE public.saas_planos SET
    status = v_status_norm,
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_duplicar_plano(
  p_plano_id uuid,
  p_novo_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_orig public.saas_planos%ROWTYPE;
  v_new_id uuid;
  v_new_nome text;
  v_new_codigo text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_orig FROM public.saas_planos WHERE id = p_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano de origem não encontrado.';
  END IF;

  v_new_nome := coalesce(nullif(trim(p_novo_nome), ''), v_orig.nome || ' (Cópia)');
  v_new_codigo := v_orig.codigo || '_copia_' || floor(extract(epoch from now()))::text;

  INSERT INTO public.saas_planos (
    codigo, nome, descricao, status,
    valor_mensal, taxa_implantacao, limite_usuarios,
    erp_incluido, site_principal_incluido, permite_sites_parceiros,
    max_parceiros, max_sites_parceiros, max_sites_dominio_proprio,
    valor_site_parceiro, valor_site_dominio_proprio,
    taxa_implantacao_site_parceiro, taxa_implantacao_dominio_proprio,
    disponivel_novas_assinaturas, categoria
  ) VALUES (
    v_new_codigo, v_new_nome, v_orig.descricao, 'RASCUNHO',
    v_orig.valor_mensal, v_orig.taxa_implantacao, v_orig.limite_usuarios,
    v_orig.erp_incluido, v_orig.site_principal_incluido, v_orig.permite_sites_parceiros,
    v_orig.max_parceiros, v_orig.max_sites_parceiros, v_orig.max_sites_dominio_proprio,
    v_orig.valor_site_parceiro, v_orig.valor_site_dominio_proprio,
    v_orig.taxa_implantacao_site_parceiro, v_orig.taxa_implantacao_dominio_proprio,
    true, v_orig.categoria
  ) RETURNING id INTO v_new_id;

  -- Clonar módulos associados
  INSERT INTO public.saas_plano_modulos (plano_id, modulo_id, habilitado, limites)
  SELECT v_new_id, modulo_id, habilitado, limites
  FROM public.saas_plano_modulos
  WHERE plano_id = p_plano_id;

  RETURN v_new_id;
END;
$$;

-- 5. RPC de Gestão do Catálogo ERP

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_modulo_catalogo(
  p_id uuid,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_categoria text DEFAULT 'OPERACIONAL',
  p_status text DEFAULT 'ATIVO',
  p_ordem_padrao integer DEFAULT 0,
  p_dependencias text[] DEFAULT '{}'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  UPDATE public.erp_modulos_catalogo SET
    nome = trim(p_nome),
    descricao = trim(p_descricao),
    categoria = trim(p_categoria),
    status = upper(trim(p_status)),
    ordem_padrao = p_ordem_padrao,
    dependencias = coalesce(p_dependencias, '{}'),
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

-- 6. RPC de Gestão de Assinaturas SaaS

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_assinatura(
  p_id uuid,
  p_plano_id uuid,
  p_status text DEFAULT 'ATIVA',
  p_usuarios_contratados integer DEFAULT 10,
  p_sites_parceiros_contratados integer DEFAULT 0,
  p_sites_dominio_proprio_contratados integer DEFAULT 0,
  p_valor_mensal numeric DEFAULT NULL,
  p_taxa_implantacao numeric DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plano public.saas_planos%ROWTYPE;
  v_valor_base numeric;
  v_valor_sites numeric;
  v_valor_dominios numeric;
  v_total numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_plano FROM public.saas_planos WHERE id = p_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado.';
  END IF;

  -- Validações de limites do plano
  IF p_sites_parceiros_contratados > coalesce(v_plano.max_sites_parceiros, 0) THEN
    RAISE EXCEPTION 'Sites de parceiros contratados (%) excede o limite do plano (%).', p_sites_parceiros_contratados, v_plano.max_sites_parceiros;
  END IF;

  IF p_sites_dominio_proprio_contratados > coalesce(v_plano.max_sites_dominio_proprio, 0) THEN
    RAISE EXCEPTION 'Sites com domínio próprio contratados (%) excede o limite do plano (%).', p_sites_dominio_proprio_contratados, v_plano.max_sites_dominio_proprio;
  END IF;

  v_valor_base := coalesce(p_valor_mensal, v_plano.valor_mensal, 0);
  v_valor_sites := p_sites_parceiros_contratados * coalesce(v_plano.valor_site_parceiro, 0);
  v_valor_dominios := p_sites_dominio_proprio_contratados * coalesce(v_plano.valor_site_dominio_proprio, 0);
  v_total := v_valor_base + v_valor_sites + v_valor_dominios;

  UPDATE public.saas_assinaturas SET
    plano_id = p_plano_id,
    status = upper(trim(p_status)),
    usuarios_contratados = p_usuarios_contratados,
    sites_parceiros_contratados = p_sites_parceiros_contratados,
    sites_dominio_proprio_contratados = p_sites_dominio_proprio_contratados,
    valor_mensal = v_valor_base,
    taxa_implantacao = coalesce(p_taxa_implantacao, taxa_implantacao, v_plano.taxa_implantacao, 0),
    valor_total_estimado = v_total,
    observacao = trim(p_observacao),
    updated_at = now()
  WHERE id = p_id;

  RETURN true;
END;
$$;

-- 7. RPC de Resolução de Limites Efetivos (Catálogo -> Plano -> Assinatura -> Override)

CREATE OR REPLACE FUNCTION public.rpc_platform_obter_limites_efetivos_empresa(p_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assinatura record;
  v_plano record;
  v_usuarios_limite integer := 10;
  v_sites_limite integer := 0;
  v_dominios_limite integer := 0;
  v_erp_ativo boolean := true;
  v_modulos jsonb := '[]'::jsonb;
  v_overrides jsonb := '[]'::jsonb;
BEGIN
  -- 1. Buscar assinatura ativa
  SELECT a.*, p.erp_incluido, p.site_principal_incluido, p.permite_sites_parceiros,
         p.max_parceiros, p.max_sites_parceiros, p.max_sites_dominio_proprio, p.limite_usuarios AS plano_limite_usuarios
  INTO v_assinatura
  FROM public.saas_assinaturas a
  JOIN public.saas_planos p ON p.id = a.plano_id
  WHERE a.empresa_id = p_empresa_id AND a.status = 'ATIVA'
  LIMIT 1;

  IF FOUND THEN
    v_usuarios_limite := coalesce(v_assinatura.usuarios_contratados, v_assinatura.plano_limite_usuarios, 10);
    v_sites_limite := coalesce(v_assinatura.sites_parceiros_contratados, v_assinatura.max_sites_parceiros, 0);
    v_dominios_limite := coalesce(v_assinatura.sites_dominio_proprio_contratados, v_assinatura.max_sites_dominio_proprio, 0);
    v_erp_ativo := v_assinatura.erp_incluido;

    -- Módulos liberados pelo plano
    SELECT jsonb_agg(m.codigo)
    INTO v_modulos
    FROM public.saas_plano_modulos pm
    JOIN public.erp_modulos_catalogo m ON m.id = pm.modulo_id
    WHERE pm.plano_id = v_assinatura.plano_id AND pm.habilitado = true AND m.status = 'ATIVO';
  END IF;

  -- 2. Aplicar overrides vigentes da empresa
  SELECT coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb)
  INTO v_overrides
  FROM public.saas_empresa_overrides o
  WHERE o.empresa_id = p_empresa_id
    AND o.vigencia_inicio <= current_date
    AND (o.vigencia_fim IS NULL OR o.vigencia_fim >= current_date);

  RETURN jsonb_build_object(
    'empresa_id', p_empresa_id,
    'erp_ativo', v_erp_ativo,
    'usuarios_limite', v_usuarios_limite,
    'sites_parceiros_limite', v_sites_limite,
    'dominios_proprios_limite', v_dominios_limite,
    'modulos_liberados', coalesce(v_modulos, '[]'::jsonb),
    'overrides_ativos', v_overrides
  );
END;
$$;

-- 8. Atualização do Onboarding RPC com suporte a quotas contratadas do Plano SaaS

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
