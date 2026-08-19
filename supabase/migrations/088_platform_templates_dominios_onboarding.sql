-- 088 — Platform Templates (Modelos de Site), Domínios e Onboarding de Master Franquia
-- Preserva tenants e modelos existentes sem alteração destrutiva.

BEGIN;

-- ============================================================================
-- 1. Ampliar site_modelos com tokens visuais, menus, seções e segurança
-- ============================================================================

ALTER TABLE public.site_modelos
  ADD COLUMN IF NOT EXISTS identidade_visual jsonb NOT NULL DEFAULT '{
    "cor_primaria": "#0284c7",
    "cor_secundaria": "#0f172a",
    "cor_destaque": "#f59e0b",
    "cor_fundo": "#f8fafc",
    "cor_texto": "#1e293b",
    "fonte_familia": "Inter, sans-serif",
    "border_radius": "16px",
    "estilo_botoes": "rounded-full",
    "estilo_cards": "rounded-2xl"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS catalogo_menus jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS secoes_home jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS configuracao_footer jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS codigo_customizado jsonb NOT NULL DEFAULT '{
    "html_customizado": "",
    "css_customizado": "",
    "sanitizado": true,
    "bloqueios": []
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS permite_logo_propria boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS logo_padrao_url text,
  ADD COLUMN IF NOT EXISTS modelo_origem_id uuid REFERENCES public.site_modelos(id) ON DELETE SET NULL;

-- Ampliar empresa_site_modelos com preferências do tenant
ALTER TABLE public.empresa_site_modelos
  ADD COLUMN IF NOT EXISTS menus_habilitados jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS usar_logo_propria boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS secoes_customizadas jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============================================================================
-- 2. Inserir / Atualizar presets canônicos de Modelos de Site
-- ============================================================================

-- A) Gauchinho Default (preservar como PUBLICADO com catálogo padrão de menus)
UPDATE public.site_modelos
SET
  catalogo_menus = '[
    {"id": "home", "label": "Início", "rota": "/", "ativo_padrao": true, "obrigatorio": true},
    {"id": "simulador", "label": "Simulador", "rota": "/simulador", "ativo_padrao": true},
    {"id": "consorcio", "label": "Consórcios", "rota": "/consorcio", "ativo_padrao": true},
    {"id": "veiculos", "label": "Veículos", "rota": "/consorcio/veiculos", "ativo_padrao": true},
    {"id": "imoveis", "label": "Imóveis", "rota": "/consorcio/imoveis", "ativo_padrao": true},
    {"id": "grupos", "label": "Grupos Oficiais", "rota": "/grupos", "ativo_padrao": true},
    {"id": "como_funciona", "label": "Como Funciona", "rota": "/#como-funciona", "ativo_padrao": true},
    {"id": "sobre", "label": "Sobre Nós", "rota": "/#sobre", "ativo_padrao": true},
    {"id": "contato", "label": "Contato", "rota": "/#contato", "ativo_padrao": true},
    {"id": "unidades", "label": "Unidades", "rota": "/#unidades", "ativo_padrao": true},
    {"id": "area_parceiro", "label": "Área do Parceiro", "rota": "/area-parceiro", "ativo_padrao": true},
    {"id": "login", "label": "Login", "rota": "/login", "ativo_padrao": true}
  ]'::jsonb,
  secoes_home = '[
    {"id": "topbar", "tipo": "topbar", "titulo": "Barra Superior", "ordem": 1, "habilitada": true},
    {"id": "header", "tipo": "header", "titulo": "Cabeçalho Principal", "ordem": 2, "habilitada": true},
    {"id": "hero", "tipo": "hero", "titulo": "Hero Principal", "ordem": 3, "habilitada": true},
    {"id": "simulador", "tipo": "simulador", "titulo": "Simulador de Crédito", "ordem": 4, "habilitada": true},
    {"id": "produtos", "tipo": "produtos", "titulo": "Cards Comerciais", "ordem": 5, "habilitada": true},
    {"id": "beneficios", "tipo": "beneficios", "titulo": "Benefícios", "ordem": 6, "habilitada": true},
    {"id": "como_funciona", "tipo": "como_funciona", "titulo": "Como Funciona", "ordem": 7, "habilitada": true},
    {"id": "estatisticas", "tipo": "estatisticas", "titulo": "Estatísticas da Franqueadora", "ordem": 8, "habilitada": true},
    {"id": "depoimentos", "tipo": "depoimentos", "titulo": "Depoimentos de Clientes", "ordem": 9, "habilitada": true},
    {"id": "cta", "tipo": "cta", "titulo": "Chamada para Ação (CTA)", "ordem": 10, "habilitada": true},
    {"id": "newsletter", "tipo": "newsletter", "titulo": "Inscrição / Newsletter", "ordem": 11, "habilitada": true},
    {"id": "footer", "tipo": "footer", "titulo": "Rodapé Estruturado", "ordem": 12, "habilitada": true}
  ]'::jsonb
WHERE codigo = 'gauchinho_default';

-- B) Preset Racon Inspired (criado em RASCUNHO com tema moderno inspirado na linguagem visual)
INSERT INTO public.site_modelos (
  codigo,
  nome,
  descricao,
  status,
  versao,
  identidade_visual,
  catalogo_menus,
  secoes_home,
  configuracao_footer,
  permite_logo_propria
)
VALUES (
  'racon_inspired',
  'Racon Inspired',
  'Modelo moderno com inspiração visual em tons de azul escuro, azul royal e amarelo de destaque, cards arredondados e simulador em destaque.',
  'RASCUNHO',
  1,
  '{
    "cor_primaria": "#0284c7",
    "cor_secundaria": "#0f172a",
    "cor_destaque": "#f59e0b",
    "cor_fundo": "#f8fafc",
    "cor_texto": "#1e293b",
    "fonte_familia": "Inter, system-ui, sans-serif",
    "border_radius": "16px",
    "estilo_botoes": "rounded-full",
    "estilo_cards": "rounded-2xl shadow-lg border border-slate-100"
  }'::jsonb,
  '[
    {"id": "home", "label": "Início", "rota": "/", "ativo_padrao": true, "obrigatorio": true},
    {"id": "simulador", "label": "Simulador", "rota": "/simulador", "ativo_padrao": true},
    {"id": "consorcio", "label": "Consórcios", "rota": "/consorcio", "ativo_padrao": true},
    {"id": "veiculos", "label": "Veículos", "rota": "/consorcio/veiculos", "ativo_padrao": true},
    {"id": "imoveis", "label": "Imóveis", "rota": "/consorcio/imoveis", "ativo_padrao": true},
    {"id": "grupos", "label": "Grupos e Modalidades", "rota": "/grupos", "ativo_padrao": true},
    {"id": "como_funciona", "label": "Como Funciona", "rota": "/#como-funciona", "ativo_padrao": true},
    {"id": "sobre", "label": "Sobre Nós", "rota": "/#sobre", "ativo_padrao": true},
    {"id": "contato", "label": "Fale Conosco", "rota": "/#contato", "ativo_padrao": true},
    {"id": "unidades", "label": "Nossas Unidades", "rota": "/#unidades", "ativo_padrao": true},
    {"id": "area_parceiro", "label": "Área do Parceiro", "rota": "/area-parceiro", "ativo_padrao": true},
    {"id": "login", "label": "Login", "rota": "/login", "ativo_padrao": true}
  ]'::jsonb,
  '[
    {"id": "topbar", "tipo": "topbar", "titulo": "Barra Superior de Atendimento", "ordem": 1, "habilitada": true},
    {"id": "header", "tipo": "header", "titulo": "Header Branco com Navegação Limpa", "ordem": 2, "habilitada": true},
    {"id": "hero", "tipo": "hero", "titulo": "Hero em Destaque com Chamada Principal", "ordem": 3, "habilitada": true},
    {"id": "simulador", "tipo": "simulador", "titulo": "Simulador em Card Arredondado", "ordem": 4, "habilitada": true},
    {"id": "produtos", "tipo": "produtos", "titulo": "Cards Comerciais de Segmentos", "ordem": 5, "habilitada": true},
    {"id": "beneficios", "tipo": "beneficios", "titulo": "Por que Escolher o Consórcio", "ordem": 6, "habilitada": true},
    {"id": "como_funciona", "tipo": "como_funciona", "titulo": "Passo a Passo de Contemplação", "ordem": 7, "habilitada": true},
    {"id": "estatisticas", "tipo": "estatisticas", "titulo": "Números e Credibilidade", "ordem": 8, "habilitada": true},
    {"id": "depoimentos", "tipo": "depoimentos", "titulo": "Histórias de Sucesso", "ordem": 9, "habilitada": true},
    {"id": "cta", "tipo": "cta", "titulo": "Faça sua Simulação Agora", "ordem": 10, "habilitada": true},
    {"id": "newsletter", "tipo": "newsletter", "titulo": "Newsletter & Oportunidades", "ordem": 11, "habilitada": true},
    {"id": "footer", "tipo": "footer", "titulo": "Rodapé Estruturado e Regulatório", "ordem": 12, "habilitada": true}
  ]'::jsonb,
  '{
    "copyright": "Todos os direitos reservados. Administradora autorizada pelo Banco Central do Brasil.",
    "links_uteis": [
      {"label": "Simulador de Imóveis", "url": "/consorcio/imoveis"},
      {"label": "Simulador de Automóveis", "url": "/consorcio/veiculos"},
      {"label": "Catálogo de Grupos", "url": "/grupos"},
      {"label": "Canal de Atendimento", "url": "/#contato"}
    ]
  }'::jsonb,
  true
)
ON CONFLICT (codigo) DO NOTHING;

-- ============================================================================
-- 3. RPCs Transacionais de Modelos de Site (Platform Superadmin)
-- ============================================================================

-- 3.1 Criar novo modelo de site
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_modelo_site(
  p_nome text,
  p_codigo text,
  p_descricao text DEFAULT NULL,
  p_modelo_origem_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_codigo text;
  v_origem record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  p_nome := trim(coalesce(p_nome, ''));
  IF p_nome = '' THEN
    RAISE EXCEPTION 'Nome do modelo é obrigatório.';
  END IF;

  IF p_codigo IS NULL OR trim(p_codigo) = '' THEN
    v_codigo := lower(regexp_replace(translate(p_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'), '[^a-z0-9]+', '_', 'g'));
    v_codigo := trim(both '_' from v_codigo);
  ELSE
    v_codigo := lower(trim(p_codigo));
  END IF;

  IF EXISTS (SELECT 1 FROM public.site_modelos WHERE codigo = v_codigo) THEN
    v_codigo := v_codigo || '_' || floor(extract(epoch from clock_timestamp()))::text;
  END IF;

  -- Se basear em modelo de origem existente
  IF p_modelo_origem_id IS NOT NULL THEN
    SELECT * INTO v_origem FROM public.site_modelos WHERE id = p_modelo_origem_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Modelo base não encontrado.';
    END IF;

    INSERT INTO public.site_modelos (
      codigo,
      nome,
      descricao,
      status,
      versao,
      identidade_visual,
      catalogo_menus,
      secoes_home,
      configuracao_footer,
      codigo_customizado,
      permite_logo_propria,
      logo_padrao_url,
      modelo_origem_id
    ) VALUES (
      v_codigo,
      p_nome,
      coalesce(p_descricao, v_origem.descricao),
      'RASCUNHO',
      1,
      v_origem.identidade_visual,
      v_origem.catalogo_menus,
      v_origem.secoes_home,
      v_origem.configuracao_footer,
      v_origem.codigo_customizado,
      v_origem.permite_logo_propria,
      v_origem.logo_padrao_url,
      p_modelo_origem_id
    ) RETURNING id INTO v_id;
  ELSE
    INSERT INTO public.site_modelos (
      codigo,
      nome,
      descricao,
      status,
      versao,
      modelo_origem_id
    ) VALUES (
      v_codigo,
      p_nome,
      p_descricao,
      'RASCUNHO',
      1,
      NULL
    ) RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- 3.2 Duplicar modelo de site
CREATE OR REPLACE FUNCTION public.rpc_platform_duplicar_modelo_site(
  p_modelo_id uuid,
  p_novo_nome text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_origem record;
  v_novo_nome text;
  v_novo_codigo text;
  v_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_origem FROM public.site_modelos WHERE id = p_modelo_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de site original não encontrado.';
  END IF;

  v_novo_nome := coalesce(nullif(trim(p_novo_nome), ''), v_origem.nome || ' (Cópia)');
  v_novo_codigo := lower(regexp_replace(translate(v_novo_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'), '[^a-z0-9]+', '_', 'g'));
  v_novo_codigo := trim(both '_' from v_novo_codigo) || '_' || floor(extract(epoch from clock_timestamp()))::text;

  INSERT INTO public.site_modelos (
    codigo,
    nome,
    descricao,
    status,
    versao,
    identidade_visual,
    catalogo_menus,
    secoes_home,
    configuracao_footer,
    codigo_customizado,
    permite_logo_propria,
    logo_padrao_url,
    modelo_origem_id
  ) VALUES (
    v_novo_codigo,
    v_novo_nome,
    v_origem.descricao,
    'RASCUNHO',
    1,
    v_origem.identidade_visual,
    v_origem.catalogo_menus,
    v_origem.secoes_home,
    v_origem.configuracao_footer,
    v_origem.codigo_customizado,
    v_origem.permite_logo_propria,
    v_origem.logo_padrao_url,
    p_modelo_id
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 3.3 Salvar configurações do modelo de site
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_modelo_site(
  p_id uuid,
  p_nome text,
  p_descricao text DEFAULT NULL,
  p_identidade_visual jsonb DEFAULT NULL,
  p_catalogo_menus jsonb DEFAULT NULL,
  p_secoes_home jsonb DEFAULT NULL,
  p_configuracao_footer jsonb DEFAULT NULL,
  p_codigo_customizado jsonb DEFAULT NULL,
  p_permite_logo_propria boolean DEFAULT true,
  p_logo_padrao_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual record;
  v_em_uso integer;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_atual FROM public.site_modelos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de site não encontrado.';
  END IF;

  p_nome := trim(coalesce(p_nome, ''));
  IF p_nome = '' THEN
    RAISE EXCEPTION 'Nome do modelo é obrigatório.';
  END IF;

  -- Se o modelo já for PUBLICADO e estiver em uso por empresas, preservamos a versão criando nova cópia se necessário
  SELECT count(*) INTO v_em_uso FROM public.empresa_site_modelos WHERE modelo_id = p_id;

  UPDATE public.site_modelos
  SET
    nome = p_nome,
    descricao = p_descricao,
    identidade_visual = coalesce(p_identidade_visual, identidade_visual),
    catalogo_menus = coalesce(p_catalogo_menus, catalogo_menus),
    secoes_home = coalesce(p_secoes_home, secoes_home),
    configuracao_footer = coalesce(p_configuracao_footer, configuracao_footer),
    codigo_customizado = coalesce(p_codigo_customizado, codigo_customizado),
    permite_logo_propria = coalesce(p_permite_logo_propria, permite_logo_propria),
    logo_padrao_url = p_logo_padrao_url,
    updated_at = clock_timestamp()
  WHERE id = p_id;
END;
$$;

-- 3.4 Alterar status do modelo de site
CREATE OR REPLACE FUNCTION public.rpc_platform_status_modelo_site(
  p_id uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_atual record;
  v_em_uso integer;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF p_status NOT IN ('RASCUNHO', 'PUBLICADO', 'INATIVO') THEN
    RAISE EXCEPTION 'Status inválido (%): deve ser RASCUNHO, PUBLICADO ou INATIVO.', p_status;
  END IF;

  SELECT * INTO v_atual FROM public.site_modelos WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modelo de site não encontrado.';
  END IF;

  IF p_status = 'INATIVO' THEN
    SELECT count(*) INTO v_em_uso FROM public.empresa_site_modelos WHERE modelo_id = p_id AND status = 'PUBLICADO';
    IF v_em_uso > 0 THEN
      RAISE EXCEPTION 'Não é possível inativar modelo atualmente utilizado por % empresa(s) ativa(s).', v_em_uso;
    END IF;
  END IF;

  UPDATE public.site_modelos
  SET status = p_status, updated_at = clock_timestamp()
  WHERE id = p_id;
END;
$$;

-- ============================================================================
-- 4. RPCs de Domínios e Bloqueio de Hosts Reservados da Plataforma
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rpc_platform_criar_dominio_tenant(
  p_empresa_id uuid,
  p_valor text,
  p_tipo text DEFAULT 'DOMINIO_CUSTOMIZADO',
  p_principal boolean DEFAULT false,
  p_ativo boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa/Master Franquia não encontrada.';
  END IF;

  v_norm := public.normalize_empresa_dominio_valor(p_valor);
  IF v_norm IS NULL OR v_norm = '' THEN
    RAISE EXCEPTION 'Domínio inválido após normalização.';
  END IF;

  -- Bloquear explicitamente o host oficial da Plataforma
  IF v_norm = 'admin.gauchinhoconsorcios.com.br' OR v_norm LIKE 'admin.%' THEN
    RAISE EXCEPTION 'O domínio % é reservado para a PLATAFORMA SAAS e não pode ser atribuído a uma franquia.', v_norm;
  END IF;

  -- Se for marcado como principal, desmarcar principais anteriores da mesma empresa
  IF p_principal = true THEN
    UPDATE public.empresa_dominios
    SET principal = false, updated_at = clock_timestamp()
    WHERE empresa_id = p_empresa_id AND principal = true;
  END IF;

  INSERT INTO public.empresa_dominios (
    empresa_id,
    tipo,
    valor,
    principal,
    ativo,
    verificado
  ) VALUES (
    p_empresa_id,
    p_tipo,
    v_norm,
    p_principal,
    p_ativo,
    false
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- 5. RPC de Onboarding Atômico de Master Franquia
-- ============================================================================

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
  p_plano_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_slug text;
  v_admin_id uuid;
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

  -- 5. Vincular Plano SaaS se selecionado
  IF p_plano_id IS NOT NULL THEN
    INSERT INTO public.saas_assinaturas (
      empresa_id,
      plano_id,
      status,
      data_inicio
    ) VALUES (
      v_empresa_id,
      p_plano_id,
      'RASCUNHO',
      CURRENT_DATE
    );
  END IF;

  -- 6. Log de Auditoria
  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados
  ) VALUES (
    'CRIAR_MASTER_FRANQUIA_ONBOARDING',
    'empresas',
    v_empresa_id::text,
    jsonb_build_object(
      'nome_fantasia', p_nome_fantasia,
      'slug', v_slug,
      'status', 'em_treinamento',
      'modelo_site_id', p_modelo_site_id,
      'administradoras', p_administradoras_ids
    )
  );

  RETURN v_empresa_id;
END;
$$;

COMMIT;
