-- 233: CRM Pipeline Etapas, Lead Incompleto, Lead Arquivos e Melhorias Comerciais
-- Forward-only, tenant-aware e preservação estrita de dados legados.
BEGIN;

-- 1. TABELA DE ETAPAS DO FUNIL CANÔNICO POR EMPRESA
CREATE TABLE IF NOT EXISTS public.crm_funil_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  slug text NOT NULL,
  ordem integer NOT NULL,
  cor text NOT NULL DEFAULT '#0099dd',
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  is_standby boolean NOT NULL DEFAULT false,
  is_ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_funil_etapas_empresa_slug_unique UNIQUE (empresa_id, slug),
  CONSTRAINT crm_funil_etapas_empresa_ordem_unique UNIQUE (empresa_id, ordem)
);

CREATE INDEX IF NOT EXISTS crm_funil_etapas_empresa_ordem_idx
  ON public.crm_funil_etapas(empresa_id, ordem) WHERE is_ativo = true;

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_crm_funil_etapas_updated_at ON public.crm_funil_etapas;
CREATE TRIGGER trg_crm_funil_etapas_updated_at
  BEFORE UPDATE ON public.crm_funil_etapas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS crm_funil_etapas
ALTER TABLE public.crm_funil_etapas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_funil_etapas_select ON public.crm_funil_etapas;
CREATE POLICY crm_funil_etapas_select ON public.crm_funil_etapas
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS crm_funil_etapas_write ON public.crm_funil_etapas;
CREATE POLICY crm_funil_etapas_write ON public.crm_funil_etapas
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_funil_etapas TO authenticated, service_role;

-- 2. SEED DAS 12 ETAPAS CANÔNICAS PARA TODAS AS EMPRESAS ATIVAS (INCLUINDO GAUCHINHO)
DO $$
DECLARE
  v_empresa RECORD;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    -- 1. Novo lead
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Novo lead', 'novo_lead', 1, '#3b82f6', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 2. Contato realizado
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Contato realizado', 'contato_realizado', 2, '#06b6d4', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 3. Qualificado
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Qualificado', 'qualificado', 3, '#8b5cf6', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 4. Reunião agendada
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Reunião agendada', 'reuniao_agendada', 4, '#ec4899', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 5. Reunião realizada
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Reunião realizada', 'reuniao_realizada', 5, '#f59e0b', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 6. Proposta enviada
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Proposta enviada', 'proposta_enviada', 6, '#eab308', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 7. Documentação / cadastro
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Documentação / cadastro', 'documentacao_cadastro', 7, '#10b981', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 8. Boleto enviado
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Boleto enviado', 'boleto_enviado', 8, '#14b8a6', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 9. Venda fechada
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Venda fechada', 'venda_fechada', 9, '#22c55e', true, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor, is_won = true;

    -- 10. Pós-venda / acompanhamento
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Pós-venda / acompanhamento', 'pos_venda', 10, '#64748b', false, false, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor;

    -- 11. Perdido
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Perdido', 'perdido', 11, '#ef4444', false, true, false)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor, is_lost = true;

    -- 12. Stand-by / futuro
    INSERT INTO public.crm_funil_etapas (empresa_id, nome, slug, ordem, cor, is_won, is_lost, is_standby)
    VALUES (v_empresa.id, 'Stand-by / futuro', 'standby_futuro', 12, '#a855f7', false, false, true)
    ON CONFLICT (empresa_id, slug) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem, cor = EXCLUDED.cor, is_standby = true;
  END LOOP;
END $$;

-- 3. ENRIQUECIMENTO DA TABELA public.leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS etapa_id uuid REFERENCES public.crm_funil_etapas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_incompleto boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS modelo_interesse text,
  ADD COLUMN IF NOT EXISTS data_ultimo_contato timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_perda_codigo text;

CREATE INDEX IF NOT EXISTS leads_etapa_id_idx ON public.leads(etapa_id);
CREATE INDEX IF NOT EXISTS leads_is_incompleto_idx ON public.leads(is_incompleto) WHERE is_incompleto = true;

-- Constraint para modelo_interesse se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_modelo_interesse_chk'
  ) THEN
    ALTER TABLE public.leads ADD CONSTRAINT leads_modelo_interesse_chk
      CHECK (modelo_interesse IS NULL OR modelo_interesse IN (
        'CLIENTE_FINAL', 'MICROFRANQUEADO', 'GERADOR_NEGOCIOS', 'GERADOR_POSSIBILIDADES', 'NAO_DEFINIDO'
      ));
  END IF;
END $$;

-- 4. BACKFILL NÃO-DESTRUTIVO DE etapa_id EM LEADS COM BASE NO STATUS ATUAL
DO $$
DECLARE
  v_empresa RECORD;
  v_etapa_novo uuid;
  v_etapa_contato uuid;
  v_etapa_qualificado uuid;
  v_etapa_proposta uuid;
  v_etapa_doc uuid;
  v_etapa_fechado uuid;
  v_etapa_perdido uuid;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    SELECT id INTO v_etapa_novo FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'novo_lead';
    SELECT id INTO v_etapa_contato FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'contato_realizado';
    SELECT id INTO v_etapa_qualificado FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'qualificado';
    SELECT id INTO v_etapa_proposta FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'proposta_enviada';
    SELECT id INTO v_etapa_doc FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'documentacao_cadastro';
    SELECT id INTO v_etapa_fechado FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'venda_fechada';
    SELECT id INTO v_etapa_perdido FROM public.crm_funil_etapas WHERE empresa_id = v_empresa.id AND slug = 'perdido';

    -- Fechado
    UPDATE public.leads
    SET etapa_id = v_etapa_fechado
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND (fechado = true OR LOWER(status) = 'fechado');

    -- Perdido
    UPDATE public.leads
    SET etapa_id = v_etapa_perdido
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND (LOWER(status) IN ('perdido', 'sem resposta', 'arquivado') OR perdido_at IS NOT NULL);

    -- Proposta enviada
    UPDATE public.leads
    SET etapa_id = v_etapa_proposta
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND LOWER(status) = 'proposta enviada';

    -- Documentação / Negociação
    UPDATE public.leads
    SET etapa_id = v_etapa_doc
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND LOWER(status) = 'negociação';

    -- Qualificado / Simulação enviada
    UPDATE public.leads
    SET etapa_id = v_etapa_qualificado
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND LOWER(status) IN ('qualificado', 'simulação enviada');

    -- Contato realizado / Em atendimento
    UPDATE public.leads
    SET etapa_id = v_etapa_contato
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL
      AND LOWER(status) IN ('em atendimento', 'tentativa de contato', 'contato realizado');

    -- Restante -> Novo lead
    UPDATE public.leads
    SET etapa_id = v_etapa_novo
    WHERE empresa_id = v_empresa.id AND etapa_id IS NULL;
  END LOOP;
END $$;

-- 5. TABELA DE ARQUIVOS E ANEXOS DO LEAD
CREATE TABLE IF NOT EXISTS public.lead_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  arquivo_url text NOT NULL,
  arquivo_nome text NOT NULL,
  arquivo_tamanho bigint,
  mime_type text,
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_arquivos_lead_idx ON public.lead_arquivos(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS lead_arquivos_empresa_idx ON public.lead_arquivos(empresa_id);

ALTER TABLE public.lead_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_arquivos_select ON public.lead_arquivos;
CREATE POLICY lead_arquivos_select ON public.lead_arquivos
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS lead_arquivos_write ON public.lead_arquivos;
CREATE POLICY lead_arquivos_write ON public.lead_arquivos
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_arquivos TO authenticated, service_role;

-- 6. TABELA DE MOTIVOS DE PERDA PADRONIZADOS
CREATE TABLE IF NOT EXISTS public.crm_motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_motivos_perda_empresa_codigo_unique UNIQUE (empresa_id, codigo)
);

ALTER TABLE public.crm_motivos_perda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crm_motivos_perda_select ON public.crm_motivos_perda;
CREATE POLICY crm_motivos_perda_select ON public.crm_motivos_perda
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS crm_motivos_perda_write ON public.crm_motivos_perda;
CREATE POLICY crm_motivos_perda_write ON public.crm_motivos_perda
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_motivos_perda TO authenticated, service_role;

-- Seed inicial de motivos de perda
DO $$
DECLARE
  v_empresa RECORD;
BEGIN
  FOR v_empresa IN SELECT id FROM public.empresas LOOP
    INSERT INTO public.crm_motivos_perda (empresa_id, codigo, nome, ordem) VALUES
      (v_empresa.id, 'sem_interesse', 'Sem interesse', 1),
      (v_empresa.id, 'sem_perfil', 'Sem perfil financeiro', 2),
      (v_empresa.id, 'comprou_outro', 'Já comprou com outro', 3),
      (v_empresa.id, 'nao_respondeu', 'Não respondeu / sumiu', 4),
      (v_empresa.id, 'momento_futuro', 'Momento futuro', 5),
      (v_empresa.id, 'parcela_alta', 'Achou parcela alta', 6),
      (v_empresa.id, 'nao_entendeu', 'Não entendeu consórcio', 7),
      (v_empresa.id, 'preferiu_financiamento', 'Preferiu financiamento', 8),
      (v_empresa.id, 'falta_documentacao', 'Falta de documentação', 9),
      (v_empresa.id, 'outros', 'Outros motivos', 10)
    ON CONFLICT (empresa_id, codigo) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;
  END LOOP;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
