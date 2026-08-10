-- Migration 055: Macrobloco D — Recebimentos, Pagamentos, Repasses, Estornos, Compensações e Caixa

-- 1. Tabela financeiro_recebimentos (Recebimentos Reais da Administradora)
CREATE TABLE IF NOT EXISTS public.financeiro_recebimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    administradora_id UUID NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
    competencia VARCHAR(7) NOT NULL,
    data_recebimento DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_total NUMERIC(15, 2) NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('pix', 'ted', 'boleto', 'outros')),
    referencia_documento TEXT NULL,
    observacoes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'estornado', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_recebimentos ENABLE ROW LEVEL SECURITY;

-- 2. Tabela financeiro_recebimento_itens (Vínculo N:N entre Recebimento e Previsões da Franquia)
CREATE TABLE IF NOT EXISTS public.financeiro_recebimento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recebimento_id UUID NOT NULL REFERENCES public.financeiro_recebimentos(id) ON DELETE CASCADE,
    previsao_franquia_id UUID NOT NULL REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT,
    valor_liquidado NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_recebimento_itens ENABLE ROW LEVEL SECURITY;

-- 3. Tabela financeiro_pagamentos (Pagamentos / Repasses Reais a Participantes / Parceiros)
CREATE TABLE IF NOT EXISTS public.financeiro_pagamentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE RESTRICT,
    competencia VARCHAR(7) NOT NULL,
    data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
    valor_bruto NUMERIC(15, 2) NOT NULL,
    valor_compensado NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    valor_liquido NUMERIC(15, 2) NOT NULL,
    forma_pagamento TEXT NOT NULL DEFAULT 'pix' CHECK (forma_pagamento IN ('pix', 'ted', 'outros')),
    referencia_documento TEXT NULL,
    observacoes TEXT NULL,
    status TEXT NOT NULL DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'estornado', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_pagamentos ENABLE ROW LEVEL SECURITY;

-- 4. Tabela financeiro_pagamento_itens (Vínculo entre Pagamento e Previsões do Participante)
CREATE TABLE IF NOT EXISTS public.financeiro_pagamento_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pagamento_id UUID NOT NULL REFERENCES public.financeiro_pagamentos(id) ON DELETE CASCADE,
    previsao_participante_id UUID NOT NULL REFERENCES public.comissao_previsoes_participantes(id) ON DELETE RESTRICT,
    valor_liquidado NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_pagamento_itens ENABLE ROW LEVEL SECURITY;

-- 5. Tabela financeiro_compensacoes (Saldos a Compensar / Estornos de Participantes)
CREATE TABLE IF NOT EXISTS public.financeiro_compensacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    participante_comercial_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT,
    organizacao_parceira_id UUID NULL REFERENCES public.organizacoes_parceiras(id) ON DELETE RESTRICT,
    venda_id UUID NULL REFERENCES public.vendas(id) ON DELETE SET NULL,
    motivo TEXT NOT NULL,
    valor_original NUMERIC(15, 2) NOT NULL,
    valor_saldo NUMERIC(15, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'parcial', 'compensada', 'cancelada')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.financeiro_compensacoes ENABLE ROW LEVEL SECURITY;

-- 6. Tabela caixa_movimentos (Livro Razão / Movimentos Imutáveis de Caixa do Tenant)
CREATE TABLE IF NOT EXISTS public.caixa_movimentos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    tipo_movimento TEXT NOT NULL CHECK (tipo_movimento IN ('entrada', 'saida')),
    origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('recebimento_administradora', 'pagamento_participante', 'estorno_recebimento', 'estorno_pagamento', 'ajuste_caixa')),
    origem_id UUID NULL,
    data_movimento DATE NOT NULL DEFAULT CURRENT_DATE,
    competencia VARCHAR(7) NOT NULL,
    valor NUMERIC(15, 2) NOT NULL,
    descricao TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.caixa_movimentos ENABLE ROW LEVEL SECURITY;


-- 7. POLICIES RLS MULTI-TENANT

-- financeiro_recebimentos
CREATE POLICY fin_rec_superadmin_all ON public.financeiro_recebimentos FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY fin_rec_staff_read ON public.financeiro_recebimentos FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY fin_rec_staff_write ON public.financeiro_recebimentos FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- financeiro_recebimento_itens
CREATE POLICY fin_rec_itens_superadmin_all ON public.financeiro_recebimento_itens FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY fin_rec_itens_staff_read ON public.financeiro_recebimento_itens FOR SELECT TO authenticated
USING (public.is_staff() AND (recebimento_id IN (SELECT r.id FROM public.financeiro_recebimentos r WHERE r.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))));

CREATE POLICY fin_rec_itens_staff_write ON public.financeiro_recebimento_itens FOR ALL TO authenticated
USING (public.is_staff() AND (recebimento_id IN (SELECT r.id FROM public.financeiro_recebimentos r WHERE r.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))))
WITH CHECK (public.is_staff() AND (recebimento_id IN (SELECT r.id FROM public.financeiro_recebimentos r WHERE r.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))));

-- financeiro_pagamentos
CREATE POLICY fin_pag_superadmin_all ON public.financeiro_pagamentos FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY fin_pag_staff_read ON public.financeiro_pagamentos FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY fin_pag_staff_write ON public.financeiro_pagamentos FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- financeiro_pagamento_itens
CREATE POLICY fin_pag_itens_superadmin_all ON public.financeiro_pagamento_itens FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY fin_pag_itens_staff_read ON public.financeiro_pagamento_itens FOR SELECT TO authenticated
USING (public.is_staff() AND (pagamento_id IN (SELECT p.id FROM public.financeiro_pagamentos p WHERE p.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))));

CREATE POLICY fin_pag_itens_staff_write ON public.financeiro_pagamento_itens FOR ALL TO authenticated
USING (public.is_staff() AND (pagamento_id IN (SELECT p.id FROM public.financeiro_pagamentos p WHERE p.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))))
WITH CHECK (public.is_staff() AND (pagamento_id IN (SELECT p.id FROM public.financeiro_pagamentos p WHERE p.empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true))));

-- financeiro_compensacoes
CREATE POLICY fin_comp_superadmin_all ON public.financeiro_compensacoes FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY fin_comp_staff_read ON public.financeiro_compensacoes FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY fin_comp_staff_write ON public.financeiro_compensacoes FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

-- caixa_movimentos
CREATE POLICY caixa_superadmin_all ON public.caixa_movimentos FOR ALL TO authenticated
USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());

CREATE POLICY caixa_staff_read ON public.caixa_movimentos FOR SELECT TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));

CREATE POLICY caixa_staff_write ON public.caixa_movimentos FOR ALL TO authenticated
USING (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)))
WITH CHECK (public.is_staff() AND (empresa_id IN (SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = public.current_usuario_id() AND eu.ativo = true)));
