-- Migration 052: Tabela de Configuração Local Empresa x Grupo (Fase 5 - Etapa E1)
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

-- Policy 1: PLATFORM_SUPERADMIN tem controle total
CREATE POLICY empresa_grupos_config_superadmin_all
ON public.empresa_grupos_config
FOR ALL
TO authenticated
USING (public.is_platform_superadmin())
WITH CHECK (public.is_platform_superadmin());

-- Policy 2: Usuários staff da empresa leem a configuração local da própria empresa
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
    )
);

-- Policy 3: Usuários staff da empresa atualizam a configuração local da própria empresa
CREATE POLICY empresa_grupos_config_staff_update
ON public.empresa_grupos_config
FOR UPDATE
TO authenticated
USING (
    public.is_staff() AND (
        empresa_id IN (
            SELECT eu.empresa_id
            FROM public.empresa_usuarios eu
            WHERE eu.usuario_id = auth.uid()
        )
    )
)
WITH CHECK (
    public.is_staff() AND (
        empresa_id IN (
            SELECT eu.empresa_id
            FROM public.empresa_usuarios eu
            WHERE eu.usuario_id = auth.uid()
        )
    )
);

-- Índices de alta performance
CREATE INDEX IF NOT EXISTS idx_empresa_grupos_config_empresa_id ON public.empresa_grupos_config(empresa_id);
CREATE INDEX IF NOT EXISTS idx_empresa_grupos_config_grupo_id ON public.empresa_grupos_config(grupo_id);
