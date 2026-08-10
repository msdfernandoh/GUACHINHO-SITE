-- Migration 052: Tabela de Configuração Local Empresa x Grupo (Fase 5 - Etapa E1.2 Hardened & Reconciled)
-- Permite que empresas personalizem visibilidade, destaque, ordem e títulos de apresentação local
-- sem duplicar ou mutar atributos oficiais do catálogo global da administradora.

CREATE TABLE IF NOT EXISTS public.empresa_grupos_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE CASCADE,
    visivel BOOLEAN NOT NULL DEFAULT true,
    destaque BOOLEAN NOT NULL DEFAULT false,
    ordem INTEGER NULL,
    titulo_comercial TEXT NULL,
    descricao_comercial TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_empresa_grupos_config_empresa_grupo UNIQUE (empresa_id, grupo_id)
);

-- Trigger para atualização automática de updated_at
CREATE OR REPLACE FUNCTION public.set_empresa_grupos_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_empresa_grupos_config_updated_at ON public.empresa_grupos_config;
CREATE TRIGGER trg_empresa_grupos_config_updated_at
    BEFORE UPDATE ON public.empresa_grupos_config
    FOR EACH ROW
    EXECUTE FUNCTION public.set_empresa_grupos_config_updated_at();

-- Habilita RLS
ALTER TABLE public.empresa_grupos_config ENABLE ROW LEVEL SECURITY;

-- 1. Helper SQL function para verificar se o grupo possui concessão ATIVA para a empresa
CREATE OR REPLACE FUNCTION public.grupo_concedido_para_empresa(p_empresa_id UUID, p_grupo_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.grupos_consorcio g
        JOIN public.empresa_administradoras ea ON ea.administradora_id = g.administradora_id
        JOIN public.administradoras a ON a.id = g.administradora_id
        WHERE g.id = p_grupo_id
          AND ea.empresa_id = p_empresa_id
          AND ea.status = 'ATIVA'
          AND a.status = 'ATIVA'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.grupo_concedido_para_empresa(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.grupo_concedido_para_empresa(UUID, UUID) TO authenticated, service_role;

-- 2. Helper SQL function para verificar se o usuário possui permissão de GESTÃO COMERCIAL/ADMINISTRATIVA da empresa (master ou srd)
CREATE OR REPLACE FUNCTION public.can_manage_empresa_grupos_config(p_empresa_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    IF public.is_platform_superadmin() THEN
        RETURN true;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.usuarios u
        JOIN public.empresa_usuarios eu ON eu.usuario_id = u.id
        WHERE eu.empresa_id = p_empresa_id
          AND u.auth_user_id = auth.uid()
          AND u.ativo = true
          AND eu.ativo = true
          AND u.perfil IN ('master', 'srd')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.can_manage_empresa_grupos_config(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_manage_empresa_grupos_config(UUID) TO authenticated, service_role;

-- Policy 1: PLATFORM_SUPERADMIN tem controle total (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS empresa_grupos_config_superadmin_all ON public.empresa_grupos_config;
CREATE POLICY empresa_grupos_config_superadmin_all
ON public.empresa_grupos_config
FOR ALL
TO authenticated
USING (public.is_platform_superadmin())
WITH CHECK (public.is_platform_superadmin());

-- Policy 2: Leitura (SELECT) — permitida para staff (master, srd, visualizador) da própria empresa com concessão ativa
DROP POLICY IF EXISTS empresa_grupos_config_staff_read ON public.empresa_grupos_config;
CREATE POLICY empresa_grupos_config_staff_read
ON public.empresa_grupos_config
FOR SELECT
TO authenticated
USING (
    public.is_staff() AND (
        empresa_id IN (
            SELECT eu.empresa_id
            FROM public.empresa_usuarios eu
            WHERE eu.usuario_id = auth.uid()
        )
    ) AND public.grupo_concedido_para_empresa(empresa_id, grupo_id)
);

-- Policy 3: Inserção (INSERT) — exige perfil de gestão (master/srd) e concessão ativa (visualizador estritamente BLOQUEADO)
DROP POLICY IF EXISTS empresa_grupos_config_staff_insert ON public.empresa_grupos_config;
CREATE POLICY empresa_grupos_config_staff_insert
ON public.empresa_grupos_config
FOR INSERT
TO authenticated
WITH CHECK (
    public.can_manage_empresa_grupos_config(empresa_id)
    AND public.grupo_concedido_para_empresa(empresa_id, grupo_id)
);

-- Policy 4: Atualização (UPDATE) — exige perfil de gestão (master/srd) e concessão ativa (visualizador estritamente BLOQUEADO)
DROP POLICY IF EXISTS empresa_grupos_config_staff_update ON public.empresa_grupos_config;
CREATE POLICY empresa_grupos_config_staff_update
ON public.empresa_grupos_config
FOR UPDATE
TO authenticated
USING (
    public.can_manage_empresa_grupos_config(empresa_id)
    AND public.grupo_concedido_para_empresa(empresa_id, grupo_id)
)
WITH CHECK (
    public.can_manage_empresa_grupos_config(empresa_id)
    AND public.grupo_concedido_para_empresa(empresa_id, grupo_id)
);

-- Policy 5: Exclusão (DELETE) — exige perfil de gestão (master/srd) e concessão ativa (visualizador estritamente BLOQUEADO)
DROP POLICY IF EXISTS empresa_grupos_config_staff_delete ON public.empresa_grupos_config;
CREATE POLICY empresa_grupos_config_staff_delete
ON public.empresa_grupos_config
FOR DELETE
TO authenticated
USING (
    public.can_manage_empresa_grupos_config(empresa_id)
    AND public.grupo_concedido_para_empresa(empresa_id, grupo_id)
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_empresa_grupos_config_empresa_id ON public.empresa_grupos_config(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_grupos_config_grupo_id ON public.empresa_grupos_config(grupo_id);
