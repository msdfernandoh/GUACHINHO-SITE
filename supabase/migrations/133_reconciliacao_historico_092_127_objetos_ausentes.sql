-- 133: reconciliacao forward-only da lacuna historica 092-127
-- Restaura somente contratos ausentes comprovados no schema de Production.
-- Nao recalcula comissoes, nao remove fatos e preserva a RPC canonica da 132.
BEGIN;

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 094_platform_usuarios_governanca.sql
-- -----------------------------------------------------------------------------
-- ==============================================================================
-- Migration 094: Plataforma SaaS - Governança Global de Usuários e Responsáveis
--                (Gestão de Acesso, Convites, Responsável Principal, Resolução
--                 de Módulos Efetivos e Validação de Quotas)
-- Data: 19/08/2026
-- ==============================================================================
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

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 117_financeiro_fornecedores_bancos_centros.sql
-- -----------------------------------------------------------------------------
-- 117: Cadastros Financeiros (Fornecedores com Auto-criação, Bancos e Centros de Custo)
-- 1. Tabela de Fornecedores
CREATE TABLE IF NOT EXISTS public.financeiro_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(trim(nome)) > 0),
  razao_social text,
  cnpj_cpf text,
  email text,
  telefone text,
  chave_pix text,
  tipo_chave_pix text,
  banco text,
  agencia text,
  conta text,
  observacao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(empresa_id, nome)
);

-- 2. Evolução de tabelas existentes
ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.financeiro_fornecedores(id) ON DELETE SET NULL;

ALTER TABLE public.financeiro_contas_bancarias
  ADD COLUMN IF NOT EXISTS tipo_conta text DEFAULT 'CORRENTE',
  ADD COLUMN IF NOT EXISTS chave_pix text,
  ADD COLUMN IF NOT EXISTS saldo_inicial numeric(15,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS observacao text;

ALTER TABLE public.financeiro_centros_custo
  ADD COLUMN IF NOT EXISTS departamento text,
  ADD COLUMN IF NOT EXISTS descricao text;

-- 3. RLS para Fornecedores
ALTER TABLE public.financeiro_fornecedores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financeiro_fornecedores_select ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_select ON public.financeiro_fornecedores
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_insert ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_insert ON public.financeiro_fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_update ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_update ON public.financeiro_fornecedores
  FOR UPDATE TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

DROP POLICY IF EXISTS financeiro_fornecedores_delete ON public.financeiro_fornecedores;
CREATE POLICY financeiro_fornecedores_delete ON public.financeiro_fornecedores
  FOR DELETE TO authenticated
  USING (public.can_write_tenant_internal(empresa_id));

-- 4. Função para obter ou criar fornecedor por nome
CREATE OR REPLACE FUNCTION public.rpc_obter_ou_criar_fornecedor(
  p_empresa_id uuid,
  p_nome text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_nome_limpo text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_nome_limpo := trim(coalesce(p_nome, ''));
  IF length(v_nome_limpo) = 0 THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_id
  FROM public.financeiro_fornecedores
  WHERE empresa_id = p_empresa_id
    AND lower(trim(nome)) = lower(v_nome_limpo)
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.financeiro_fornecedores (empresa_id, nome, ativo)
  VALUES (p_empresa_id, v_nome_limpo, true)
  ON CONFLICT (empresa_id, nome) DO UPDATE
  SET ativo = true
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- 5. Backfill de fornecedores existentes
DO $$
DECLARE
  v_rec record;
  v_forn_id uuid;
BEGIN
  FOR v_rec IN
    SELECT DISTINCT empresa_id, trim(fornecedor) AS nome
    FROM public.financeiro_contas_pagar
    WHERE fornecedor IS NOT NULL AND length(trim(fornecedor)) > 0
  LOOP
    BEGIN
      INSERT INTO public.financeiro_fornecedores (empresa_id, nome, ativo)
      VALUES (v_rec.empresa_id, v_rec.nome, true)
      ON CONFLICT (empresa_id, nome) DO NOTHING;

      SELECT id INTO v_forn_id
      FROM public.financeiro_fornecedores
      WHERE empresa_id = v_rec.empresa_id AND lower(trim(nome)) = lower(v_rec.nome)
      LIMIT 1;

      UPDATE public.financeiro_contas_pagar
      SET fornecedor_id = v_forn_id
      WHERE empresa_id = v_rec.empresa_id
        AND lower(trim(fornecedor)) = lower(v_rec.nome)
        AND fornecedor_id IS NULL;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 093_platform_master_franquias_hub.sql
-- -----------------------------------------------------------------------------
-- ==============================================================================
-- Migration 093: Plataforma SaaS - HUB Operacional Completo de Master Franquias
--                (Ativação com Checklist, Suspensão com Motivo, Troca de Plano,
--                 Troca de Modelo, Concessão de Administradoras e Gestão de Parceiros)
-- Data: 19/08/2026
-- ==============================================================================
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

-- A troca de modelo NÃO é recriada aqui. A assinatura homônima foi
-- canonicalizada pela migration 132 para empresa_site_modelos e deve ser
-- preservada integralmente.

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

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 092_platform_planos_limits_overrides_v2.sql
-- -----------------------------------------------------------------------------
-- ==============================================================================
-- Migration 092: Plataforma SaaS - Governança do Catálogo ERP, Validações de Quotas,
--                Exclusão Segura de Planos e Hierarquia Efetiva de Overrides
-- Data: 18/08/2026
-- ==============================================================================
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

-- rpc_platform_salvar_assinatura já existe em Production com a assinatura e
-- defaults corretos. A migration 133 não sobrescreve contratos existentes.

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 095_platform_overrides_gestao_operacional.sql
-- -----------------------------------------------------------------------------
-- ==============================================================================
-- Migration 095: Plataforma SaaS - Gestão Operacional de Exceções & Overrides
--                (Tipos de Override, Vigência Automática, Valores Efetivos,
--                 Resolução de Conflitos e Auditoria de Encerramento)
-- Data: 19/08/2026
-- ==============================================================================
-- 1. Extensão de Colunas em saas_empresa_overrides
ALTER TABLE public.saas_empresa_overrides
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'MODULO_ERP',
  ADD COLUMN IF NOT EXISTS valor_numerico int,
  ADD COLUMN IF NOT EXISTS valor_booleano boolean,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ATIVO',
  ADD COLUMN IF NOT EXISTS observacao text,
  ADD COLUMN IF NOT EXISTS encerrado_em timestamptz,
  ADD COLUMN IF NOT EXISTS encerrado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_encerramento text,
  ADD COLUMN IF NOT EXISTS criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- Constraint de status
ALTER TABLE public.saas_empresa_overrides
  DROP CONSTRAINT IF EXISTS saas_empresa_overrides_status_check;

ALTER TABLE public.saas_empresa_overrides
  ADD CONSTRAINT saas_empresa_overrides_status_check
  CHECK (status IN ('ATIVO', 'INATIVO', 'ENCERRADO', 'EXPIRADO'));

-- Constraint de tipos suportados
ALTER TABLE public.saas_empresa_overrides
  DROP CONSTRAINT IF EXISTS saas_empresa_overrides_tipo_check;

ALTER TABLE public.saas_empresa_overrides
  ADD CONSTRAINT saas_empresa_overrides_tipo_check
  CHECK (tipo IN (
    'MODULO_ERP',
    'LIMITE_USUARIOS',
    'LIMITE_PARCEIROS',
    'LIMITE_SITES',
    'LIMITE_DOMINIOS_PROPRIOS',
    'ERP_HABILITADO',
    'RECURSO_CATALOGO'
  ));

-- 2. Índices de Consulta Rápida de Vigência e Status
CREATE INDEX IF NOT EXISTS saas_empresa_overrides_empresa_status_idx
  ON public.saas_empresa_overrides (empresa_id, status, vigencia_inicio, vigencia_fim);

CREATE INDEX IF NOT EXISTS saas_empresa_overrides_recurso_idx
  ON public.saas_empresa_overrides (empresa_id, recurso_codigo);

-- 3. RPC para Criar / Aplicar Novo Override na Master Franquia
CREATE OR REPLACE FUNCTION public.rpc_platform_criar_override(
  p_empresa_id uuid,
  p_tipo text,
  p_recurso_codigo text,
  p_efeito text DEFAULT 'LIBERAR',
  p_valor_numerico int DEFAULT NULL,
  p_valor_booleano boolean DEFAULT NULL,
  p_motivo text DEFAULT 'condição comercial',
  p_observacao text DEFAULT NULL,
  p_vigencia_inicio date DEFAULT current_date,
  p_vigencia_fim date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_override_id uuid;
  v_recurso_limpo text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Master Franquia não encontrada.';
  END IF;

  v_recurso_limpo := lower(trim(p_recurso_codigo));
  IF coalesce(v_recurso_limpo, '') = '' THEN
    RAISE EXCEPTION 'Código do recurso / limite é obrigatório.';
  END IF;

  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Motivo do override é obrigatório.';
  END IF;

  IF p_vigencia_fim IS NOT NULL AND p_vigencia_fim < p_vigencia_inicio THEN
    RAISE EXCEPTION 'Data de término da vigência não pode ser anterior ao início.';
  END IF;

  SELECT id INTO v_uid FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  -- Resolução de Conflitos: Encerrar override ativo anterior para o mesmo recurso/empresa
  UPDATE public.saas_empresa_overrides
  SET
    status = 'ENCERRADO',
    encerrado_em = NOW(),
    encerrado_por = v_uid,
    motivo_encerramento = 'Substituído por nova versão de override'
  WHERE
    empresa_id = p_empresa_id
    AND recurso_codigo = v_recurso_limpo
    AND status = 'ATIVO'
    AND (vigencia_fim IS NULL OR vigencia_fim >= p_vigencia_inicio);

  -- Inserir novo override
  INSERT INTO public.saas_empresa_overrides (
    empresa_id,
    tipo,
    recurso_codigo,
    efeito,
    valor_numerico,
    valor_booleano,
    motivo,
    observacao,
    vigencia_inicio,
    vigencia_fim,
    status,
    criado_por
  ) VALUES (
    p_empresa_id,
    p_tipo,
    v_recurso_limpo,
    p_efeito,
    p_valor_numerico,
    p_valor_booleano,
    trim(p_motivo),
    trim(p_observacao),
    coalesce(p_vigencia_inicio, current_date),
    p_vigencia_fim,
    'ATIVO',
    v_uid
  )
  RETURNING id INTO v_override_id;

  -- Atualizar quotas operacionais caso seja limite numérico
  IF p_tipo = 'LIMITE_USUARIOS' AND p_valor_numerico IS NOT NULL THEN
    UPDATE public.empresa_quotas
    SET limite_usuarios = p_valor_numerico, updated_at = NOW()
    WHERE empresa_id = p_empresa_id;
  ELSIF p_tipo = 'LIMITE_SITES' AND p_valor_numerico IS NOT NULL THEN
    UPDATE public.empresa_quotas
    SET limite_sites_parceiros = p_valor_numerico, updated_at = NOW()
    WHERE empresa_id = p_empresa_id;
  ELSIF p_tipo = 'LIMITE_DOMINIOS_PROPRIOS' AND p_valor_numerico IS NOT NULL THEN
    UPDATE public.empresa_quotas
    SET limite_dominios_proprios = p_valor_numerico, updated_at = NOW()
    WHERE empresa_id = p_empresa_id;
  END IF;

  -- Registrar Auditoria
  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'CRIAR_OVERRIDE',
    'saas_empresa_overrides',
    v_override_id,
    jsonb_build_object(
      'empresa_id', p_empresa_id,
      'tipo', p_tipo,
      'recurso_codigo', v_recurso_limpo,
      'efeito', p_efeito,
      'valor_numerico', p_valor_numerico,
      'valor_booleano', p_valor_booleano,
      'motivo', p_motivo,
      'vigencia_inicio', p_vigencia_inicio,
      'vigencia_fim', p_vigencia_fim
    ),
    auth.uid()
  );

  RETURN v_override_id;
END;
$$;

-- 4. RPC para Encerrar Override (Preservando Histórico)
CREATE OR REPLACE FUNCTION public.rpc_platform_encerrar_override(
  p_override_id uuid,
  p_motivo_encerramento text DEFAULT 'Encerramento manual via Plataforma'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
  v_uid uuid;
  v_assinatura record;
  v_plano record;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin.';
  END IF;

  SELECT * INTO v_link FROM public.saas_empresa_overrides WHERE id = p_override_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Override não encontrado.';
  END IF;

  SELECT id INTO v_uid FROM public.usuarios WHERE auth_user_id = auth.uid() LIMIT 1;

  UPDATE public.saas_empresa_overrides
  SET
    status = 'ENCERRADO',
    encerrado_em = NOW(),
    encerrado_por = v_uid,
    motivo_encerramento = coalesce(p_motivo_encerramento, 'Encerramento manual')
  WHERE id = p_override_id;

  -- Restaurar quotas para valor herdado do plano/assinatura
  SELECT * INTO v_assinatura FROM public.saas_assinaturas WHERE empresa_id = v_link.empresa_id AND status = 'ATIVA' LIMIT 1;
  IF v_assinatura.id IS NOT NULL THEN
    SELECT * INTO v_plano FROM public.saas_planos WHERE id = v_assinatura.plano_id;
  END IF;

  IF v_link.tipo = 'LIMITE_USUARIOS' THEN
    UPDATE public.empresa_quotas
    SET limite_usuarios = coalesce(v_assinatura.usuarios_contratados, v_plano.limite_usuarios, 10), updated_at = NOW()
    WHERE empresa_id = v_link.empresa_id;
  ELSIF v_link.tipo = 'LIMITE_SITES' THEN
    UPDATE public.empresa_quotas
    SET limite_sites_parceiros = coalesce(v_assinatura.sites_parceiros_contratados, v_plano.limite_sites_parceiros, 5), updated_at = NOW()
    WHERE empresa_id = v_link.empresa_id;
  ELSIF v_link.tipo = 'LIMITE_DOMINIOS_PROPRIOS' THEN
    UPDATE public.empresa_quotas
    SET limite_dominios_proprios = coalesce(v_assinatura.dominios_proprios_contratados, v_plano.limite_dominios_proprios, 0), updated_at = NOW()
    WHERE empresa_id = v_link.empresa_id;
  END IF;

  -- Registrar Auditoria
  INSERT INTO public.plataforma_auditoria (
    acao,
    entidade_tipo,
    entidade_id,
    campos_alterados,
    executado_por
  ) VALUES (
    'ENCERRAR_OVERRIDE',
    'saas_empresa_overrides',
    p_override_id,
    jsonb_build_object(
      'motivo_encerramento', p_motivo_encerramento,
      'encerrado_em', NOW()
    ),
    auth.uid()
  );

  RETURN true;
END;
$$;

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 098_erp_participantes_lances_governanca.sql
-- -----------------------------------------------------------------------------
-- 098: Governança de Participantes Comerciais e Lances/Estratégias de Cotas no ERP
-- 1. Campos de edição, escopo e módulos em participantes_comerciais
-- 2. Campos de validade 5 meses, 2º lance fixo, fidelidade, comprovante e confirmação em cota_estrategias_lance
-- 3. Bucket de storage privado 'lances-comprovantes'
-- 4. RPCs seguras com tenant-isolation e validação de integridade referencial
-- 1. EVOLUÇÃO DE participantes_comerciais
ALTER TABLE public.participantes_comerciais
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escopo_visualizacao text DEFAULT 'TODOS';

DO $$
BEGIN
  ALTER TABLE public.participantes_comerciais
    DROP CONSTRAINT IF EXISTS participantes_comerciais_escopo_check;
  ALTER TABLE public.participantes_comerciais
    ADD CONSTRAINT participantes_comerciais_escopo_check
    CHECK (escopo_visualizacao IN ('TODOS', 'VINCULADOS', 'CRIADOS', 'VINCULADOS_OU_CRIADOS'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. EVOLUÇÃO DE cota_estrategias_lance
ALTER TABLE public.cota_estrategias_lance
  ADD COLUMN IF NOT EXISTS data_lance date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lance_fidelidade_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_observacao text,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS comprovante_storage_path text,
  ADD COLUMN IF NOT EXISTS comprovante_nome text,
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmado_por_nome text,
  ADD COLUMN IF NOT EXISTS confirmado_observacao text,
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revogado_motivo text,
  ADD COLUMN IF NOT EXISTS consultor_responsavel_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL;

-- 3. BUCKET DE STORAGE PRIVADO PARA COMPROVANTES DE LANCE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lances-comprovantes',
  'lances-comprovantes',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- RLS para lances-comprovantes
DO $$
BEGIN
  DROP POLICY IF EXISTS "lances_comprovantes_auth_read" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_delete" ON storage.objects;

  CREATE POLICY "lances_comprovantes_auth_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'lances-comprovantes')
    WITH CHECK (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'lances-comprovantes');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. RPC DE VERIFICAÇÃO DE DEPENDÊNCIAS DE PARTICIPANTE ANTES DE EXCLUSÃO
CREATE OR REPLACE FUNCTION public.rpc_verificar_dependencias_participante(
  p_empresa_id uuid,
  p_participante_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_vendas_count integer := 0;
  v_cotas_count integer := 0;
  v_propostas_count integer := 0;
  v_comissoes_count integer := 0;
  v_regras_count integer := 0;
  v_leads_count integer := 0;
  v_pode_excluir boolean := true;
  v_motivos text[] := ARRAY[]::text[];
BEGIN
  -- Vendas
  SELECT count(*) INTO v_vendas_count
  FROM public.vendas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_vendas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_vendas_count || ' venda(s) registrada(s)');
  END IF;

  -- Cotas Definitivas
  SELECT count(*) INTO v_cotas_count
  FROM public.cotas_definitivas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_cotas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_cotas_count || ' cota(s) definitiva(s) associada(s)');
  END IF;

  -- Propostas
  SELECT count(*) INTO v_propostas_count
  FROM public.propostas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_propostas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_propostas_count || ' proposta(s) comercial(is)');
  END IF;

  -- Previsões de Comissão
  SELECT count(*) INTO v_comissoes_count
  FROM public.comissao_previsoes_participantes
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_comissoes_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_comissoes_count || ' previsão(ões) de comissão');
  END IF;

  -- Regras de Comissão
  SELECT count(*) INTO v_regras_count
  FROM public.comissao_regras_participantes
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_regras_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_regras_count || ' regra(s) de comissionamento ativa(s)');
  END IF;

  -- Leads atribuídos
  SELECT count(*) INTO v_leads_count
  FROM public.leads
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_leads_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_leads_count || ' lead(s) no CRM');
  END IF;

  RETURN jsonb_build_object(
    'pode_excluir', v_pode_excluir,
    'total_vinculos', (v_vendas_count + v_cotas_count + v_propostas_count + v_comissoes_count + v_regras_count + v_leads_count),
    'motivos', v_motivos
  );
END $$;

-- 5. RPC DE CONFIRMAÇÃO DE LANCE
CREATE OR REPLACE FUNCTION public.rpc_confirmar_lance_cota(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_cota record;
  v_estrategia record;
  v_usuario_id uuid;
  v_usuario_nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Cota não encontrada no tenant'; END IF;

  SELECT * INTO v_estrategia FROM public.cota_estrategias_lance WHERE cota_definitiva_id = p_cota_id FOR UPDATE;
  IF v_estrategia.id IS NULL THEN RAISE EXCEPTION 'Cota não possui estratégia registrada'; END IF;

  v_usuario_id := public.current_usuario_id();
  SELECT coalesce(nome, email, 'Operador') INTO v_usuario_nome FROM public.usuarios WHERE id = v_usuario_id;
  IF v_usuario_nome IS NULL THEN v_usuario_nome := 'Operador ERP'; END IF;

  UPDATE public.cota_estrategias_lance SET
    confirmado = true,
    confirmado_em = now(),
    confirmado_por_usuario_id = v_usuario_id,
    confirmado_por_nome = v_usuario_nome,
    confirmado_observacao = p_observacao,
    revogado_em = null,
    revogado_por_usuario_id = null,
    revogado_motivo = null,
    updated_by_usuario_id = v_usuario_id,
    updated_at = now()
  WHERE id = v_estrategia.id
  RETURNING * INTO v_estrategia;

  INSERT INTO public.cota_estrategias_lance_historico(
    empresa_id, estrategia_id, cota_definitiva_id, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_estrategia.id, p_cota_id,
    jsonb_build_object('confirmado', false),
    jsonb_build_object('confirmado', true, 'confirmado_por', v_usuario_nome, 'confirmado_em', now()),
    coalesce(p_observacao, 'Confirmação operacional de lance realizado na assembleia'),
    v_usuario_id
  );

  RETURN to_jsonb(v_estrategia);
END $$;

-- 6. RPC DE REVOGAÇÃO DE CONFIRMAÇÃO DE LANCE
CREATE OR REPLACE FUNCTION public.rpc_revogar_confirmacao_lance_cota(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_estrategia record;
  v_usuario_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  IF length(trim(coalesce(p_motivo, '')))<3 THEN
    RAISE EXCEPTION 'Informe o motivo da revogação da confirmação';
  END IF;

  SELECT * INTO v_estrategia FROM public.cota_estrategias_lance WHERE cota_definitiva_id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_estrategia.id IS NULL THEN RAISE EXCEPTION 'Estratégia não encontrada'; END IF;

  v_usuario_id := public.current_usuario_id();

  UPDATE public.cota_estrategias_lance SET
    confirmado = false,
    revogado_em = now(),
    revogado_por_usuario_id = v_usuario_id,
    revogado_motivo = trim(p_motivo),
    updated_by_usuario_id = v_usuario_id,
    updated_at = now()
  WHERE id = v_estrategia.id
  RETURNING * INTO v_estrategia;

  INSERT INTO public.cota_estrategias_lance_historico(
    empresa_id, estrategia_id, cota_definitiva_id, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_estrategia.id, p_cota_id,
    jsonb_build_object('confirmado', true),
    jsonb_build_object('confirmado', false, 'revogado_motivo', trim(p_motivo)),
    trim(p_motivo),
    v_usuario_id
  );

  RETURN to_jsonb(v_estrategia);
END $$;

REVOKE ALL ON FUNCTION public.rpc_verificar_dependencias_participante(uuid, uuid), public.rpc_confirmar_lance_cota(uuid, uuid, text), public.rpc_revogar_confirmacao_lance_cota(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_verificar_dependencias_participante(uuid, uuid), public.rpc_confirmar_lance_cota(uuid, uuid, text), public.rpc_revogar_confirmacao_lance_cota(uuid, uuid, text) TO authenticated;

-- -----------------------------------------------------------------------------
-- Fonte historica reconciliada: 096_platform_sites_parceiros_identidade_visual.sql
-- -----------------------------------------------------------------------------
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

-- Privilegios finais: RPCs de usuario exigem JWT e nunca ficam publicas ou
-- executaveis via service_role. A checagem de tenant/superadmin permanece interna.
DO $$
DECLARE v_func regprocedure;
BEGIN
  FOR v_func IN
    SELECT p.oid::regprocedure
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY (ARRAY['rpc_platform_criar_modulo_catalogo','rpc_platform_excluir_plano','rpc_platform_salvar_assinatura','rpc_platform_atualizar_dados_empresa','rpc_platform_ativar_empresa','rpc_platform_suspender_empresa','rpc_platform_reativar_empresa','rpc_platform_alterar_plano_empresa','rpc_platform_conceder_administradora_empresa','rpc_platform_revogar_administradora_empresa','rpc_platform_criar_site_parceiro','rpc_platform_convidar_usuario','rpc_platform_alterar_usuario','rpc_platform_definir_responsavel_empresa','rpc_platform_reenviar_convite_usuario','rpc_platform_criar_override','rpc_platform_encerrar_override','rpc_platform_salvar_identidade_site_parceiro','rpc_verificar_dependencias_participante','rpc_confirmar_lance_cota','rpc_revogar_confirmacao_lance_cota','rpc_obter_ou_criar_fornecedor'])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', v_func);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_func);
    EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog', v_func);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
