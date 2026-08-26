-- 107: Governança completa de Perfis de Comissão, Regras de Perfis e Vínculos de Participantes
BEGIN;

-- 1. TABELA DE PERFIS DE COMISSÃO (Entidade reutilizável por papel comercial)
CREATE TABLE IF NOT EXISTS public.comissao_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  papel_base text NOT NULL CHECK (papel_base IN ('MICROFRANQUIA','CONSULTOR','VENDEDOR','SDR','ATENDENTE','INDICADOR','PARCEIRO','GESTOR')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);

ALTER TABLE public.comissao_perfis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'comissao_perfis' AND policyname = 'comissao_perfis_tenant_isolation'
  ) THEN
    CREATE POLICY comissao_perfis_tenant_isolation ON public.comissao_perfis
      FOR ALL TO authenticated
      USING (public.can_write_tenant_internal(empresa_id))
      WITH CHECK (public.can_write_tenant_internal(empresa_id));
  END IF;
END $$;

-- 2. INSERIR PERFIS PADRÃO PARA CADA EMPRESA ATIVA
INSERT INTO public.comissao_perfis (empresa_id, nome, descricao, papel_base, ativo)
SELECT e.id, p.nome, p.descricao, p.papel_base, true
FROM public.empresas e
CROSS JOIN (
  VALUES
    ('Microfranquia Padrão', 'Perfil padrão de repasse para microfranqueados da unidade', 'MICROFRANQUIA'),
    ('Consultor Padrão', 'Perfil padrão de comissão para consultores comerciais', 'CONSULTOR'),
    ('SDR Padrão', 'Perfil padrão de prospecção e qualificação de oportunidades', 'SDR'),
    ('Indicador Padrão', 'Perfil padrão de remuneração para parceiros indicadores', 'INDICADOR'),
    ('Parceiro Padrão', 'Perfil padrão para imobiliárias e corretores parceiros', 'PARCEIRO')
) AS p(nome, descricao, papel_base)
WHERE e.ativo = true
ON CONFLICT (empresa_id, nome) DO NOTHING;

-- 3. EVOLUÇÃO DE comissao_regras_participantes COM PERFIL_ID E STATUS CANÔNICO
ALTER TABLE public.comissao_regras_participantes
  ADD COLUMN IF NOT EXISTS perfil_id uuid REFERENCES public.comissao_perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS curva_estorno_id uuid REFERENCES public.administradora_curvas_estorno(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aplicar_curva_estorno boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS seguir_cronograma_franquia boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'HOMOLOGADA',
  ADD COLUMN IF NOT EXISTS nome_regra text,
  ADD COLUMN IF NOT EXISTS observacoes text;

DO $$
BEGIN
  ALTER TABLE public.comissao_regras_participantes
    DROP CONSTRAINT IF EXISTS comissao_regras_participantes_status_chk;
  ALTER TABLE public.comissao_regras_participantes
    ADD CONSTRAINT comissao_regras_participantes_status_chk
    CHECK (status IN ('RASCUNHO','HOMOLOGADA','SUBSTITUIDA','INATIVA'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. TABELA DE VÍNCULO PARTICIPANTE -> PERFIL DE COMISSÃO
CREATE TABLE IF NOT EXISTS public.participante_comissao_perfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  participante_id uuid NOT NULL REFERENCES public.participantes_comerciais(id) ON DELETE CASCADE,
  papel_tipo text NOT NULL,
  perfil_id uuid NOT NULL REFERENCES public.comissao_perfis(id) ON DELETE RESTRICT,
  override_percentual numeric(7,4),
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  CHECK (override_percentual IS NULL OR (override_percentual >= 0 AND override_percentual <= 100)),
  UNIQUE (empresa_id, participante_id, papel_tipo, perfil_id)
);

ALTER TABLE public.participante_comissao_perfis ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'participante_comissao_perfis' AND policyname = 'participante_comissao_perfis_tenant_isolation'
  ) THEN
    CREATE POLICY participante_comissao_perfis_tenant_isolation ON public.participante_comissao_perfis
      FOR ALL TO authenticated
      USING (public.can_write_tenant_internal(empresa_id))
      WITH CHECK (public.can_write_tenant_internal(empresa_id));
  END IF;
END $$;

-- 5. Vincular perfil padrão inicial aos participantes já existentes com base nos tipos
INSERT INTO public.participante_comissao_perfis (empresa_id, participante_id, papel_tipo, perfil_id, vigencia_inicio, ativo)
SELECT
  p.empresa_id,
  p.id as participante_id,
  pt.tipo_codigo as papel_tipo,
  cp.id as perfil_id,
  CURRENT_DATE as vigencia_inicio,
  true as ativo
FROM public.participantes_comerciais p
JOIN public.participante_tipos pt ON pt.participante_id = p.id
JOIN public.comissao_perfis cp ON cp.empresa_id = p.empresa_id AND (
  (pt.tipo_codigo = 'MICROFRANQUIA' AND cp.papel_base = 'MICROFRANQUIA') OR
  (pt.tipo_codigo = 'CONSULTOR' AND cp.papel_base = 'CONSULTOR') OR
  (pt.tipo_codigo = 'SDR' AND cp.papel_base = 'SDR') OR
  (pt.tipo_codigo = 'INDICADOR' AND cp.papel_base = 'INDICADOR') OR
  (pt.tipo_codigo = 'PARCEIRO' AND cp.papel_base = 'PARCEIRO') OR
  (pt.tipo_codigo NOT IN ('MICROFRANQUIA','CONSULTOR','SDR','INDICADOR','PARCEIRO') AND cp.papel_base = 'CONSULTOR')
)
ON CONFLICT (empresa_id, participante_id, papel_tipo, perfil_id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
