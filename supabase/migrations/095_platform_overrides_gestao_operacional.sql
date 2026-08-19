-- ==============================================================================
-- Migration 095: Plataforma SaaS - Gestão Operacional de Exceções & Overrides
--                (Tipos de Override, Vigência Automática, Valores Efetivos,
--                 Resolução de Conflitos e Auditoria de Encerramento)
-- Data: 19/08/2026
-- ==============================================================================

BEGIN;

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

COMMIT;
