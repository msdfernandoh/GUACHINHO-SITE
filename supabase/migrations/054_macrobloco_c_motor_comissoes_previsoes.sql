-- Migration 054: Macrobloco C — Motor de Comissões, Previsões e Competências

-- 1. Tabela comissao_programas (Programas de Comissão do Tenant)
CREATE TABLE IF NOT EXISTS public.comissao_programas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    descricao TEXT NULL,
    administradora_id UUID NULL REFERENCES public.administradoras(id) ON DELETE CASCADE,
    ativo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comissao_programas ENABLE ROW LEVEL SECURITY;

-- 2. Tabela comissao_regras_franquia (Regra de Comissão da Franquia com a Administradora)
CREATE TABLE IF NOT EXISTS public.comissao_regras_franquia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES public.comissao_programas(id) ON DELETE CASCADE,
    versao INTEGER NOT NULL DEFAULT 1,
    percentual_total_comissao NUMERIC(7, 4) NOT NULL DEFAULT 4.0000,
    base_calculo TEXT NOT NULL DEFAULT 'credito' CHECK (base_calculo IN ('credito', 'valor_fixo')),
    vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
    vigencia_fim DATE NULL,
    ativa BOOLEAN NOT NULL DEFAULT true,
    etapas_cronograma JSONB NOT NULL DEFAULT '[{"ordem": 1, "mes_relativo": 1, "percentual_etapa": 100, "nome": "Parcela Única"}]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comissao_regras_franquia ENABLE ROW LEVEL SECURITY;

-- 3. Tabela comissao_regras_participantes (Regra de Repasse ao Consultor / Parceiro)
CREATE TABLE IF NOT EXISTS public.comissao_regras_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    programa_id UUID NOT NULL REFERENCES public.comissao_programas(id) ON DELETE CASCADE,
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE CASCADE,
    tipo_participante TEXT NULL,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE CASCADE,
    percentual_comissao NUMERIC(7, 4) NOT NULL DEFAULT 1.5000,
    base_calculo TEXT NOT NULL DEFAULT 'credito' CHECK (base_calculo IN ('credito', 'comissao_franquia', 'valor_fixo')),
    ativa BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comissao_regras_participantes ENABLE ROW LEVEL SECURITY;

-- 4. Tabela comissao_previsoes_franquia (Previsões de Comissão da Empresa/Franquia)
CREATE TABLE IF NOT EXISTS public.comissao_previsoes_franquia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    cota_definitiva_id UUID NULL REFERENCES public.cotas_definitivas(id) ON DELETE SET NULL,
    administradora_id UUID NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
    regra_franquia_id UUID NULL REFERENCES public.comissao_regras_franquia(id) ON DELETE SET NULL,
    ordem_etapa INTEGER NOT NULL DEFAULT 1,
    nome_etapa TEXT NOT NULL DEFAULT 'Parcela Única',
    competencia VARCHAR(7) NOT NULL,
    base_calculo_valor NUMERIC(15, 2) NOT NULL,
    percentual_aplicado NUMERIC(7, 4) NOT NULL,
    valor_previsto NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista', 'elegivel', 'suspensa', 'cancelada')),
    snapshot_regra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_previsao_franquia_venda_etapa UNIQUE (venda_id, ordem_etapa)
);

ALTER TABLE public.comissao_previsoes_franquia ENABLE ROW LEVEL SECURITY;

-- 5. Tabela comissao_previsoes_participantes (Previsões de Comissão para Consultores / Parceiros)
CREATE TABLE IF NOT EXISTS public.comissao_previsoes_participantes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    venda_id UUID NOT NULL REFERENCES public.vendas(id) ON DELETE CASCADE,
    cota_definitiva_id UUID NULL REFERENCES public.cotas_definitivas(id) ON DELETE SET NULL,
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL,
    regra_participante_id UUID NULL REFERENCES public.comissao_regras_participantes(id) ON DELETE SET NULL,
    ordem_etapa INTEGER NOT NULL DEFAULT 1,
    nome_etapa TEXT NOT NULL DEFAULT 'Parcela Única',
    competencia VARCHAR(7) NOT NULL,
    base_calculo_valor NUMERIC(15, 2) NOT NULL,
    percentual_aplicado NUMERIC(7, 4) NOT NULL,
    valor_previsto NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista', 'elegivel', 'suspensa', 'cancelada')),
    snapshot_regra JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.comissao_previsoes_participantes ENABLE ROW LEVEL SECURITY;


-- 6. POLICIES RLS MULTI-TENANT

-- comissao_programas
CREATE POLICY comissao_programas_superadmin_all ON public.comissao_programas FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY comissao_programas_staff_read ON public.comissao_programas FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY comissao_programas_staff_write ON public.comissao_programas FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- comissao_regras_franquia
CREATE POLICY comissao_regras_franquia_superadmin_all ON public.comissao_regras_franquia FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY comissao_regras_franquia_staff_read ON public.comissao_regras_franquia FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY comissao_regras_franquia_staff_write ON public.comissao_regras_franquia FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- comissao_regras_participantes
CREATE POLICY comissao_regras_part_superadmin_all ON public.comissao_regras_participantes FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY comissao_regras_part_staff_read ON public.comissao_regras_participantes FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY comissao_regras_part_staff_write ON public.comissao_regras_participantes FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- comissao_previsoes_franquia
CREATE POLICY comissao_prev_franq_superadmin_all ON public.comissao_previsoes_franquia FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY comissao_prev_franq_staff_read ON public.comissao_previsoes_franquia FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY comissao_prev_franq_staff_write ON public.comissao_previsoes_franquia FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- comissao_previsoes_participantes
CREATE POLICY comissao_prev_part_superadmin_all ON public.comissao_previsoes_participantes FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY comissao_prev_part_staff_read ON public.comissao_previsoes_participantes FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY comissao_prev_part_staff_write ON public.comissao_previsoes_participantes FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));
