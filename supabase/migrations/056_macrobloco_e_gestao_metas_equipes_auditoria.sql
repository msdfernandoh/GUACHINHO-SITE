-- Migration 056: Macrobloco E — Gestão, Metas, Equipes, Tarefas e Auditoria Central
-- Suporta multi-tenant isolado por empresa_id via RLS e previne colisão de dados

-- 1. Tabela public.equipes
CREATE TABLE IF NOT EXISTS public.equipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT NULL,
  gestor_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabela public.equipe_membros
CREATE TABLE IF NOT EXISTS public.equipe_membros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipe_id UUID NOT NULL REFERENCES public.equipes(id) ON DELETE CASCADE,
  participante_id UUID NOT NULL REFERENCES public.participantes_comerciais(id) ON DELETE CASCADE,
  papel_equipe TEXT NOT NULL DEFAULT 'membro' CHECK (papel_equipe IN ('gestor', 'membro', 'supervisor')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT equipe_membros_unique_member UNIQUE (equipe_id, participante_id)
);

-- 3. Tabela public.metas_comerciais
CREATE TABLE IF NOT EXISTS public.metas_comerciais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  alvo_tipo TEXT NOT NULL CHECK (alvo_tipo IN ('empresa', 'equipe', 'participante', 'parceiro')),
  alvo_id UUID NULL,
  indicador TEXT NOT NULL CHECK (indicador IN ('valor_credito_vendido', 'quantidade_vendas', 'propostas_criadas', 'receita_prevista_franquia', 'receita_recebida')),
  periodo_tipo TEXT NOT NULL CHECK (periodo_tipo IN ('mensal', 'trimestral', 'anual', 'personalizado')),
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  valor_meta NUMERIC(15, 2) NOT NULL CHECK (valor_meta >= 0),
  observacoes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Tabela public.tarefas_gestao
CREATE TABLE IF NOT EXISTS public.tarefas_gestao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT NULL,
  responsavel_id UUID NULL REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
  equipe_id UUID NULL REFERENCES public.equipes(id) ON DELETE SET NULL,
  origem_tipo TEXT NULL CHECK (origem_tipo IS NULL OR origem_tipo IN ('lead', 'proposta', 'venda', 'participante', 'parceiro', 'interna')),
  origem_id UUID NULL,
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida', 'cancelada')),
  data_limite TIMESTAMPTZ NULL,
  concluido_em TIMESTAMPTZ NULL,
  created_by UUID NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Tabela public.audit_logs_central
CREATE TABLE IF NOT EXISTS public.audit_logs_central (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  usuario_id UUID NULL REFERENCES public.usuarios(id) ON DELETE SET NULL,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NULL,
  detalhes JSONB NOT NULL DEFAULT '{}'::jsonb,
  correlation_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_equipes_empresa ON public.equipes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_equipe_membros_equipe ON public.equipe_membros(equipe_id);
CREATE INDEX IF NOT EXISTS idx_equipe_membros_participante ON public.equipe_membros(participante_id);
CREATE INDEX IF NOT EXISTS idx_metas_empresa_periodo ON public.metas_comerciais(empresa_id, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa_status ON public.tarefas_gestao(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas_gestao(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_central_empresa ON public.audit_logs_central(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_central_correlation ON public.audit_logs_central(correlation_id) WHERE correlation_id IS NOT NULL;

-- HABILITAR RLS EM TODAS AS 5 TABELAS
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipe_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas_gestao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs_central ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS RLS STAF/TENANT
DROP POLICY IF EXISTS equipes_tenant_policy ON public.equipes;
CREATE POLICY equipes_tenant_policy ON public.equipes
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS equipe_membros_tenant_policy ON public.equipe_membros;
CREATE POLICY equipe_membros_tenant_policy ON public.equipe_membros
  FOR ALL TO authenticated
  USING (
    equipe_id IN (
      SELECT e.id FROM public.equipes e WHERE e.empresa_id IN (
        SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    equipe_id IN (
      SELECT e.id FROM public.equipes e WHERE e.empresa_id IN (
        SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS metas_tenant_policy ON public.metas_comerciais;
CREATE POLICY metas_tenant_policy ON public.metas_comerciais
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tarefas_tenant_policy ON public.tarefas_gestao;
CREATE POLICY tarefas_tenant_policy ON public.tarefas_gestao
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS audit_logs_central_tenant_policy ON public.audit_logs_central;
CREATE POLICY audit_logs_central_tenant_policy ON public.audit_logs_central
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT eu.empresa_id FROM public.empresa_usuarios eu WHERE eu.usuario_id = auth.uid()
    )
  );
