-- ==============================================================================
-- Migration 309: Médias de Lance, Contemplações e Histórico de Assembleias
-- Central e Franquias (Multi-tenancy Global)
-- ==============================================================================

-- 1. Adicionar colunas estatísticas de contemplação e assembleia em public.grupos_consorcio
ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS media_lance_1m NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_lance_3m NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_lance_6m NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS media_lance_12m NUMERIC(8,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_assembleia_numero INTEGER,
  ADD COLUMN IF NOT EXISTS ultima_assembleia_data DATE,
  ADD COLUMN IF NOT EXISTS proxima_assembleia_numero INTEGER,
  ADD COLUMN IF NOT EXISTS proxima_assembleia_data DATE,
  ADD COLUMN IF NOT EXISTS contemplacoes_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contemplacoes_resumo JSONB DEFAULT '{}'::jsonb;

-- Comentários descritivos
COMMENT ON COLUMN public.grupos_consorcio.media_lance_1m IS 'Média percentual de lance livre do último mês extraída pelo Robô 2';
COMMENT ON COLUMN public.grupos_consorcio.media_lance_3m IS 'Média percentual de lance livre dos últimos 3 meses extraída pelo Robô 2';
COMMENT ON COLUMN public.grupos_consorcio.media_lance_6m IS 'Média percentual de lance livre dos últimos 6 meses extraída pelo Robô 2';
COMMENT ON COLUMN public.grupos_consorcio.media_lance_12m IS 'Média percentual de lance livre dos últimos 12 meses (1 ano) extraída pelo Robô 2';
COMMENT ON COLUMN public.grupos_consorcio.ultima_assembleia_numero IS 'Número da última assembleia realizada';
COMMENT ON COLUMN public.grupos_consorcio.ultima_assembleia_data IS 'Data em que ocorreu a última assembleia';
COMMENT ON COLUMN public.grupos_consorcio.proxima_assembleia_numero IS 'Número da próxima assembleia agendada';
COMMENT ON COLUMN public.grupos_consorcio.proxima_assembleia_data IS 'Data agendada para a próxima assembleia';
COMMENT ON COLUMN public.grupos_consorcio.contemplacoes_atualizado_em IS 'Data e hora da última sincronização das contemplações';
COMMENT ON COLUMN public.grupos_consorcio.contemplacoes_resumo IS 'Contadores e resumo da assembleia (sorteio ativas/canceladas, lances livres, fixos)';

-- 2. Tabela histórica de cotas contempladas por assembleia
CREATE TABLE IF NOT EXISTS public.grupo_assembleias_contemplacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE CASCADE,
  codigo_grupo TEXT NOT NULL,
  assembleia_numero INTEGER NOT NULL,
  assembleia_data DATE NOT NULL,
  cota TEXT NOT NULL,
  modalidade TEXT NOT NULL,
  percentual_lance NUMERIC(8,4) NOT NULL DEFAULT 0,
  pago TEXT,
  ponto_venda TEXT,
  bem TEXT,
  filial TEXT,
  data_contemplacao DATE,
  data_confirmacao DATE,
  origem TEXT NOT NULL DEFAULT 'ROBO_IMPORTACAO',
  execucao_id UUID REFERENCES public.robo_execucoes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_grupo_assembleia_cota_modalidade UNIQUE (grupo_id, assembleia_numero, cota, modalidade)
);

-- Índices de consulta otimizada
CREATE INDEX IF NOT EXISTS idx_grupo_contemplacoes_grupo_id ON public.grupo_assembleias_contemplacoes(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupo_contemplacoes_codigo_ass ON public.grupo_assembleias_contemplacoes(codigo_grupo, assembleia_numero);
CREATE INDEX IF NOT EXISTS idx_grupo_contemplacoes_ass_data ON public.grupo_assembleias_contemplacoes(assembleia_data DESC);
CREATE INDEX IF NOT EXISTS idx_grupo_contemplacoes_modalidade ON public.grupo_assembleias_contemplacoes(modalidade);

-- RLS (Row Level Security)
ALTER TABLE public.grupo_assembleias_contemplacoes ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
DROP POLICY IF EXISTS "Leitura de contemplações para usuários autenticados" ON public.grupo_assembleias_contemplacoes;
CREATE POLICY "Leitura de contemplações para usuários autenticados"
  ON public.grupo_assembleias_contemplacoes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Robôs e Service Role gerenciam contemplações" ON public.grupo_assembleias_contemplacoes;
CREATE POLICY "Robôs e Service Role gerenciam contemplações"
  ON public.grupo_assembleias_contemplacoes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
