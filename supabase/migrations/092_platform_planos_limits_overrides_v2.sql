-- ==============================================================================
-- Migration 092: Plataforma SaaS - Governança do Catálogo ERP, Validações de Quotas,
--                Exclusão Segura de Planos e Hierarquia Efetiva de Overrides
-- Data: 18/08/2026
-- ==============================================================================

BEGIN;

-- 1. RPC para criar novo módulo operacional no catálogo global ERP
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_modulo_catalogo(
  p_nome text,
  p_codigo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_categoria text DEFAULT 'OPERACIONAL',
  p_ordem_padrao int DEFAULT 0,
  p_dependencias text[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codigo text;
  v_id uuid;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome do módulo é obrigatório.';
  END IF;

  IF coalesce(trim(p_codigo), '') != '' THEN
    v_codigo := lower(regexp_replace(trim(p_codigo), '[^a-z0-9_]+', '_', 'g'));
  ELSE
    v_codigo := lower(regexp_replace(translate(p_nome, 'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'), '[^a-z0-9]+', '_', 'g'));
  END IF;
  v_codigo := trim(both '_' from v_codigo);

  IF EXISTS (SELECT 1 FROM public.erp_modulos_catalogo WHERE codigo = v_codigo) THEN
    RAISE EXCEPTION 'Já existe um módulo cadastrado com o código %.', v_codigo;
  END IF;

  INSERT INTO public.erp_modulos_catalogo (
    codigo,
    nome,
    descricao,
    categoria,
    status,
    estado_produto,
    ordem_padrao,
    dependencias
  ) VALUES (
    v_codigo,
    trim(p_nome),
    nullif(trim(p_descricao), ''),
    coalesce(nullif(trim(p_categoria), ''), 'OPERACIONAL'),
    'ATIVO',
    'DISPONIVEL',
    coalesce(p_ordem_padrao, 0),
    coalesce(p_dependencias, '{}')
  )
  RETURNING id INTO v_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'CRIAR_MODULO_CATALOGO',
    'erp_modulos_catalogo',
    v_id,
    jsonb_build_object('codigo', v_codigo, 'nome', p_nome, 'categoria', p_categoria),
    auth.uid()
  );

  RETURN v_id;
END;
$$;

-- 2. RPC para exclusão segura de Plano SaaS (bloqueia se houver assinantes)
CREATE OR REPLACE FUNCTION public.rpc_platform_excluir_plano(
  p_plano_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano record;
  v_total_assinantes int;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_plano FROM public.saas_planos WHERE id = p_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano não encontrado.';
  END IF;

  SELECT count(*) INTO v_total_assinantes
  FROM public.saas_assinaturas
  WHERE plano_id = p_plano_id AND status != 'CANCELADA';

  IF v_total_assinantes > 0 THEN
    RAISE EXCEPTION 'Plano em uso por % empresa(s) assinante(s). Não pode ser excluído destrutivamente. Altere seu status para INATIVO.', v_total_assinantes;
  END IF;

  DELETE FROM public.saas_planos WHERE id = p_plano_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'EXCLUIR_PLANO',
    'saas_planos',
    p_plano_id,
    jsonb_build_object('codigo', v_plano.codigo, 'nome', v_plano.nome),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 3. Atualizar RPC de Salvar Assinatura com validação estrita de quotas do Plano
CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_assinatura(
  p_id uuid,
  p_plano_id uuid,
  p_status text,
  p_usuarios_contratados int,
  p_sites_parceiros_contratados int,
  p_sites_dominio_proprio_contratados int,
  p_valor_mensal numeric,
  p_taxa_implantacao numeric DEFAULT 0,
  p_observacao text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano record;
  v_assinatura record;
  v_total_estimado numeric;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_assinatura FROM public.saas_assinaturas WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assinatura não encontrada.';
  END IF;

  SELECT * INTO v_plano FROM public.saas_planos WHERE id = p_plano_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano SaaS selecionado não encontrado.';
  END IF;

  -- Validações de limites do Plano vs Quantidade Contratada
  IF v_plano.limite_usuarios > 0 AND p_usuarios_contratados > v_plano.limite_usuarios THEN
    RAISE EXCEPTION 'Quantidade de usuários contratados (%) excede o limite máximo permitido pelo plano (%). Utilize Overrides para exceções.', p_usuarios_contratados, v_plano.limite_usuarios;
  END IF;

  IF v_plano.permite_sites_parceiros AND v_plano.max_sites_parceiros > 0 AND p_sites_parceiros_contratados > v_plano.max_sites_parceiros THEN
    RAISE EXCEPTION 'Quantidade de sites de parceiros contratados (%) excede o limite máximo do plano (%).', p_sites_parceiros_contratados, v_plano.max_sites_parceiros;
  END IF;

  IF v_plano.permite_sites_parceiros AND v_plano.max_sites_dominio_proprio > 0 AND p_sites_dominio_proprio_contratados > v_plano.max_sites_dominio_proprio THEN
    RAISE EXCEPTION 'Quantidade de domínios próprios contratados (%) excede o limite do plano (%).', p_sites_dominio_proprio_contratados, v_plano.max_sites_dominio_proprio;
  END IF;

  -- Calcular total mensal estimado
  v_total_estimado := coalesce(p_valor_mensal, v_plano.valor_mensal)
    + (coalesce(p_sites_parceiros_contratados, 0) * v_plano.valor_site_parceiro)
    + (coalesce(p_sites_dominio_proprio_contratados, 0) * v_plano.valor_site_dominio_proprio);

  UPDATE public.saas_assinaturas
  SET
    plano_id = p_plano_id,
    status = coalesce(nullif(trim(p_status), ''), status),
    usuarios_contratados = coalesce(p_usuarios_contratados, usuarios_contratados),
    sites_parceiros_contratados = coalesce(p_sites_parceiros_contratados, sites_parceiros_contratados),
    sites_dominio_proprio_contratados = coalesce(p_sites_dominio_proprio_contratados, sites_dominio_proprio_contratados),
    valor_mensal = coalesce(p_valor_mensal, valor_mensal),
    taxa_implantacao = coalesce(p_taxa_implantacao, taxa_implantacao),
    valor_total_estimado = v_total_estimado,
    observacao = nullif(trim(p_observacao), ''),
    updated_at = NOW()
  WHERE id = p_id;

  -- Sincronizar quotas na tabela empresa_quotas
  UPDATE public.empresa_quotas
  SET
    limite_usuarios = coalesce(p_usuarios_contratados, limite_usuarios),
    max_parceiros = v_plano.max_parceiros,
    max_sites_parceiros = coalesce(p_sites_parceiros_contratados, max_sites_parceiros),
    max_sites_dominio_proprio = coalesce(p_sites_dominio_proprio_contratados, max_sites_dominio_proprio),
    permite_sites_parceiros = v_plano.permite_sites_parceiros,
    updated_at = NOW()
  WHERE empresa_id = v_assinatura.empresa_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'SALVAR_ASSINATURA',
    'saas_assinaturas',
    p_id,
    jsonb_build_object(
      'plano_id', p_plano_id,
      'status', p_status,
      'usuarios_contratados', p_usuarios_contratados,
      'sites_parceiros_contratados', p_sites_parceiros_contratados,
      'sites_dominio_proprio_contratados', p_sites_dominio_proprio_contratados,
      'valor_total_estimado', v_total_estimado
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

COMMIT;
