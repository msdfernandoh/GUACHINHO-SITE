-- 300: permite a meta mensal de equipe comercial no painel de fechamento.
BEGIN;

ALTER TABLE public.metas_comerciais
  DROP CONSTRAINT IF EXISTS metas_comerciais_indicador_check;

ALTER TABLE public.metas_comerciais
  ADD CONSTRAINT metas_comerciais_indicador_check CHECK (
    indicador IN (
      'valor_credito_vendido', 'quantidade_vendas', 'propostas_criadas',
      'receita_prevista_franquia', 'receita_recebida', 'consultores_cadastrados'
    )
  );

CREATE INDEX IF NOT EXISTS metas_comerciais_empresa_indicador_periodo_idx
  ON public.metas_comerciais (empresa_id, alvo_tipo, indicador, data_inicio, data_fim);

COMMIT;
