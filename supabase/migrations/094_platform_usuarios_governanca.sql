-- ==============================================================================
-- Migration 094: Plataforma SaaS - Governança Global de Usuários e Responsáveis
--                (Gestão de Acesso, Convites, Responsável Principal, Resolução
--                 de Módulos Efetivos e Validação de Quotas)
-- Data: 19/08/2026
-- ==============================================================================

BEGIN;

-- 1. Extensão de Colunas em empresa_usuarios para Governança de Convite e Responsável
ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS is_responsavel_principal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS convite_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS convite_token text;

-- Atualizar constraint de status se necessário
ALTER TABLE public.empresa_usuarios
  DROP CONSTRAINT IF EXISTS empresa_usuarios_status_check;

ALTER TABLE public.empresa_usuarios
  ADD CONSTRAINT empresa_usuarios_status_check
  CHECK (status IN ('CONVIDADO', 'ATIVO', 'INATIVO', 'SUSPENSO'));

-- 2. Índice único parcial: Apenas 1 responsável principal ativo por empresa
CREATE UNIQUE INDEX IF NOT EXISTS empresa_usuarios_responsavel_unico_idx
  ON public.empresa_usuarios (empresa_id)
  WHERE is_responsavel_principal = true AND ativo = true;

-- 3. RPC para Convidar / Cadastrar Novo Usuário na Master Franquia
CREATE OR REPLACE FUNCTION public.rpc_platform_convidar_usuario(
  p_empresa_id uuid,
  p_nome text,
  p_email text,
  p_papel_id uuid,
  p_modulos text[] DEFAULT '{}'::text[],
  p_is_responsavel boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quotas record;
  v_total_usuarios int;
  v_overrides_usuarios int := 0;
  v_limite_efetivo int;
  v_plano record;
  v_modulos_empresa text[] := '{}'::text[];
  v_modulos_filtrados text[] := '{}'::text[];
  v_mod text;
  v_usuario_id uuid;
  v_empresa_usuario_id uuid;
  v_email_clean text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  v_email_clean := lower(trim(p_email));
  IF coalesce(v_email_clean, '') = '' OR coalesce(trim(p_nome), '') = '' THEN
    RAISE EXCEPTION 'Nome e e-mail são obrigatórios.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Master Franquia não encontrada.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.papeis WHERE id = p_papel_id) THEN
    RAISE EXCEPTION 'Papel selecionado não existe.';
  END IF;

  -- Validação de Limites Contratados & Overrides
  SELECT * INTO v_quotas FROM public.empresa_quotas WHERE empresa_id = p_empresa_id;
  SELECT count(*) INTO v_total_usuarios FROM public.empresa_usuarios WHERE empresa_id = p_empresa_id AND ativo = true;

  SELECT coalesce(sum(
    CASE
      WHEN efeito = 'LIBERAR' AND (motivo ILIKE '%usuario%' OR motivo ILIKE '%user%') THEN 5
      ELSE 0
    END
  ), 0) INTO v_overrides_usuarios
  FROM public.saas_empresa_overrides
  WHERE empresa_id = p_empresa_id;

  v_limite_efetivo := coalesce(v_quotas.limite_usuarios, 10) + v_overrides_usuarios;

  IF v_total_usuarios >= v_limite_efetivo THEN
    RAISE EXCEPTION 'Limite de usuários contratados atingido (% de %). Solicite aumento de quota antes de convidar novos usuários.', v_total_usuarios, v_limite_efetivo;
  END IF;

  -- Resolução Hierárquica de Módulos Permitidos para a Empresa
  SELECT sp.* INTO v_plano
  FROM public.saas_assinaturas sa
  JOIN public.saas_planos sp ON sp.id = sa.plano_id
  WHERE sa.empresa_id = p_empresa_id AND sa.status IN ('ATIVA', 'TREINAMENTO', 'PENDENTE')
  ORDER BY sa.created_at DESC LIMIT 1;

  IF v_plano.id IS NOT NULL AND v_plano.modulos_habilitados IS NOT NULL THEN
    v_modulos_empresa := v_plano.modulos_habilitados;
  END IF;

  -- Acrescentar módulos liberados por override
  SELECT coalesce(array_agg(recurso_codigo), '{}'::text[]) INTO v_modulos_empresa
  FROM (
    SELECT unnest(v_modulos_empresa) AS recurso_codigo
    UNION
    SELECT recurso_codigo FROM public.saas_empresa_overrides WHERE empresa_id = p_empresa_id AND efeito = 'LIBERAR'
  ) sub;

  -- Filtrar módulos solicitados: usuário nunca recebe módulo indisponível para a empresa
  IF p_modulos IS NOT NULL THEN
    FOREACH v_mod IN ARRAY p_modulos LOOP
      IF v_mod = ANY(v_modulos_empresa) THEN
        v_modulos_filtrados := array_append(v_modulos_filtrados, v_mod);
      END IF;
    END LOOP;
  END IF;

  -- Buscar ou Criar Usuário Base (sem gerar senha manual)
  SELECT id INTO v_usuario_id FROM public.usuarios WHERE email = v_email_clean;
  IF v_usuario_id IS NULL THEN
    INSERT INTO public.usuarios (
      nome,
      email,
      perfil,
      ativo
    ) VALUES (
      trim(p_nome),
      v_email_clean,
      'consultor',
      true
    )
    RETURNING id INTO v_usuario_id;
  END IF;

  -- Se for responsável principal, desmarcar anterior
  IF p_is_responsavel THEN
    UPDATE public.empresa_usuarios
    SET is_responsavel_principal = false, updated_at = NOW()
    WHERE empresa_id = p_empresa_id AND is_responsavel_principal = true;
  END IF;

  -- Inserir vínculo na empresa
  INSERT INTO public.empresa_usuarios (
    empresa_id,
    usuario_id,
    papel_id,
    ativo,
    status,
    is_responsavel_principal,
    erp_modulos_visiveis,
    convite_enviado_em,
    origem
  ) VALUES (
    p_empresa_id,
    v_usuario_id,
    p_papel_id,
    true,
    'CONVIDADO',
    p_is_responsavel,
    v_modulos_filtrados,
    NOW(),
    'PLATAFORMA_HUB'
  )
  ON CONFLICT (empresa_id, usuario_id) WHERE ativo = true
  DO UPDATE SET
    papel_id = p_papel_id,
    status = 'CONVIDADO',
    is_responsavel_principal = p_is_responsavel,
    erp_modulos_visiveis = v_modulos_filtrados,
    convite_enviado_em = NOW(),
    updated_at = NOW()
  RETURNING id INTO v_empresa_usuario_id;

  -- Registrar Auditoria
  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'CONVIDAR_USUARIO',
    'empresa_usuarios',
    v_empresa_usuario_id,
    jsonb_build_object(
      'empresa_id', p_empresa_id,
      'usuario_id', v_usuario_id,
      'nome', p_nome,
      'email', v_email_clean,
      'papel_id', p_papel_id,
      'is_responsavel', p_is_responsavel,
      'modulos_efetivos', v_modulos_filtrados
    ),
    auth.uid()
  );

  RETURN v_empresa_usuario_id;
END;
$$;

-- 4. RPC para Alterar Dados e Permissões do Usuário
CREATE OR REPLACE FUNCTION public.rpc_platform_alterar_usuario(
  p_empresa_usuario_id uuid,
  p_papel_id uuid,
  p_modulos text[] DEFAULT '{}'::text[],
  p_ativo boolean DEFAULT true,
  p_status text DEFAULT 'ATIVO'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
  v_plano record;
  v_modulos_empresa text[] := '{}'::text[];
  v_modulos_filtrados text[] := '{}'::text[];
  v_mod text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_link FROM public.empresa_usuarios WHERE id = p_empresa_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Vínculo do usuário não encontrado.';
  END IF;

  -- Resolução Hierárquica de Módulos da Empresa
  SELECT sp.* INTO v_plano
  FROM public.saas_assinaturas sa
  JOIN public.saas_planos sp ON sp.id = sa.plano_id
  WHERE sa.empresa_id = v_link.empresa_id AND sa.status IN ('ATIVA', 'TREINAMENTO', 'PENDENTE')
  ORDER BY sa.created_at DESC LIMIT 1;

  IF v_plano.id IS NOT NULL AND v_plano.modulos_habilitados IS NOT NULL THEN
    v_modulos_empresa := v_plano.modulos_habilitados;
  END IF;

  SELECT coalesce(array_agg(recurso_codigo), '{}'::text[]) INTO v_modulos_empresa
  FROM (
    SELECT unnest(v_modulos_empresa) AS recurso_codigo
    UNION
    SELECT recurso_codigo FROM public.saas_empresa_overrides WHERE empresa_id = v_link.empresa_id AND efeito = 'LIBERAR'
  ) sub;

  IF p_modulos IS NOT NULL THEN
    FOREACH v_mod IN ARRAY p_modulos LOOP
      IF v_mod = ANY(v_modulos_empresa) THEN
        v_modulos_filtrados := array_append(v_modulos_filtrados, v_mod);
      END IF;
    END LOOP;
  END IF;

  UPDATE public.empresa_usuarios
  SET
    papel_id = coalesce(p_papel_id, papel_id),
    erp_modulos_visiveis = v_modulos_filtrados,
    ativo = p_ativo,
    status = coalesce(p_status, status),
    data_saida = CASE WHEN p_ativo = false THEN NOW() ELSE NULL END,
    updated_at = NOW()
  WHERE id = p_empresa_usuario_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ALTERAR_USUARIO',
    'empresa_usuarios',
    p_empresa_usuario_id,
    jsonb_build_object(
      'papel_id', p_papel_id,
      'ativo', p_ativo,
      'status', p_status,
      'modulos_efetivos', v_modulos_filtrados
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 5. RPC para Definir / Transferir Responsável Principal da Master Franquia
CREATE OR REPLACE FUNCTION public.rpc_platform_definir_responsavel_empresa(
  p_empresa_id uuid,
  p_empresa_usuario_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_link FROM public.empresa_usuarios WHERE id = p_empresa_usuario_id AND empresa_id = p_empresa_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não pertence a esta Master Franquia.';
  END IF;

  -- Desmarcar anteriores
  UPDATE public.empresa_usuarios
  SET is_responsavel_principal = false, updated_at = NOW()
  WHERE empresa_id = p_empresa_id AND is_responsavel_principal = true;

  -- Marcar o novo responsável
  UPDATE public.empresa_usuarios
  SET is_responsavel_principal = true, updated_at = NOW()
  WHERE id = p_empresa_usuario_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'DEFINIR_RESPONSAVEL_PRINCIPAL',
    'empresas',
    p_empresa_id,
    jsonb_build_object('novo_responsavel_id', p_empresa_usuario_id, 'usuario_id', v_link.usuario_id),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- 6. RPC para Reenviar Convite ao Usuário
CREATE OR REPLACE FUNCTION public.rpc_platform_reenviar_convite_usuario(
  p_empresa_usuario_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_link FROM public.empresa_usuarios WHERE id = p_empresa_usuario_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  UPDATE public.empresa_usuarios
  SET
    status = 'CONVIDADO',
    convite_enviado_em = NOW(),
    updated_at = NOW()
  WHERE id = p_empresa_usuario_id;

  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'REENVIAR_CONVITE_USUARIO',
    'empresa_usuarios',
    p_empresa_usuario_id,
    jsonb_build_object('reenviado_em', NOW()),
    auth.uid()
  );

  RETURN true;
END;
$$;

COMMIT;
