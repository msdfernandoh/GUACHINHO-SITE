-- Migration 053: Macrobloco B — Comercial e Vendas (CRM Leads, Propostas, Contratações, Vendas e Cotas Definitivas)

-- 1. Garantir coluna empresa_id, participante_comercial_id e organizacao_parceira_id em LEADS
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL;

-- Desativa temporariamente o trigger do usuário para permitir o backfill inicial sem violar RLS/guard
ALTER TABLE public.leads DISABLE TRIGGER leads_prevent_escopo_move;

UPDATE public.leads
SET empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'
WHERE empresa_id IS NULL;

ALTER TABLE public.leads ENABLE TRIGGER leads_prevent_escopo_move;


-- 2. Garantir coluna empresa_id, participante_comercial_id e organizacao_parceira_id em PROPOSTAS
ALTER TABLE public.propostas
ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL;

ALTER TABLE public.propostas DISABLE TRIGGER propostas_prevent_escopo_move;

UPDATE public.propostas
SET empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'
WHERE empresa_id IS NULL;

ALTER TABLE public.propostas ENABLE TRIGGER propostas_prevent_escopo_move;


-- 3. Garantir coluna empresa_id, participante_comercial_id e organizacao_parceira_id em CONTRATACOES_ONLINE
ALTER TABLE public.contratacoes_online
ADD COLUMN IF NOT EXISTS empresa_id UUID NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL;

UPDATE public.contratacoes_online
SET empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'
WHERE empresa_id IS NULL;


-- 4. Tabela public.vendas (Venda Efetivada / Negócio Fechado)
CREATE TABLE IF NOT EXISTS public.vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    lead_id UUID NULL REFERENCES public.leads(id) ON DELETE SET NULL,
    proposta_id UUID NULL REFERENCES public.propostas(id) ON DELETE SET NULL,
    contratacao_id UUID NULL REFERENCES public.contratacoes_online(id) ON DELETE SET NULL,
    cliente_nome TEXT NOT NULL,
    cliente_cpf_cnpj TEXT NULL,
    cliente_email TEXT NULL,
    cliente_telefone TEXT NULL,
    administradora_id UUID NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
    grupo_id UUID NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
    opcao_cota_id UUID NULL REFERENCES public.grupos_cotas(id) ON DELETE SET NULL,
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL,
    valor_credito NUMERIC(15, 2) NOT NULL,
    prazo INTEGER NOT NULL,
    parcela NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('pendente', 'confirmada', 'cancelada', 'suspensa')),
    snapshot_venda JSONB NOT NULL DEFAULT '{}'::jsonb,
    data_venda TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_vendas_contratacao UNIQUE (contratacao_id)
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;

-- 5. Tabela public.cotas_definitivas (Cota Adquirida pelo Cliente)
CREATE TABLE IF NOT EXISTS public.cotas_definitivas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    administradora_id UUID NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
    grupo_id UUID NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
    numero_grupo TEXT NOT NULL,
    numero_cota TEXT NULL,
    valor_credito NUMERIC(15, 2) NOT NULL,
    prazo INTEGER NOT NULL,
    parcela NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'cancelada', 'contemplada', 'quitada')),
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL,
    snapshot_cota JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cotas_definitivas ENABLE ROW LEVEL SECURITY;


-- 6. POLICIES RLS MULTI-TENANT

-- VENDAS
CREATE POLICY vendas_superadmin_all ON public.vendas FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY vendas_staff_read ON public.vendas FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY vendas_staff_insert ON public.vendas FOR INSERT TO authenticated
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY vendas_staff_update ON public.vendas FOR UPDATE TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- COTAS DEFINITIVAS
CREATE POLICY cotas_definitivas_superadmin_all ON public.cotas_definitivas FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY cotas_definitivas_staff_read ON public.cotas_definitivas FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY cotas_definitivas_staff_insert ON public.cotas_definitivas FOR INSERT TO authenticated
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY cotas_definitivas_staff_update ON public.cotas_definitivas FOR UPDATE TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));
