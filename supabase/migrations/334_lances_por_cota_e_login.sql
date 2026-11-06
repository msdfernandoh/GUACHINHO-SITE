-- 334: Estratégia de lance por cota, por modalidade e por login operacional.
-- A configuração do login reutiliza cotas_definitivas.robo_boleto_login.

ALTER TABLE public.cota_estrategias_lance
  ADD COLUMN IF NOT EXISTS lance_livre_embutido_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS lance_fixo_embutido_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_embutido_percentual numeric(8,4);

ALTER TABLE public.cota_estrategias_lance
  DROP CONSTRAINT IF EXISTS cota_estrategias_lance_embutidos_por_modalidade_check;

ALTER TABLE public.cota_estrategias_lance
  ADD CONSTRAINT cota_estrategias_lance_embutidos_por_modalidade_check
  CHECK (
    coalesce(lance_livre_embutido_percentual, 0) >= 0 AND
    coalesce(lance_fixo_embutido_percentual, 0) >= 0 AND
    coalesce(segundo_lance_fixo_embutido_percentual, 0) >= 0
  );

CREATE INDEX IF NOT EXISTS cota_estrategias_lance_ativa_vencimento_idx
  ON public.cota_estrategias_lance (empresa_id, ativa, data_vencimento);

COMMENT ON COLUMN public.cota_estrategias_lance.lance_livre_embutido_percentual IS
  'Percentual de embutido escolhido para o lance livre desta cota.';
COMMENT ON COLUMN public.cota_estrategias_lance.lance_fixo_embutido_percentual IS
  'Percentual de embutido escolhido para o primeiro lance fixo desta cota.';
COMMENT ON COLUMN public.cota_estrategias_lance.segundo_lance_fixo_embutido_percentual IS
  'Percentual de embutido escolhido para o segundo lance fixo desta cota.';

-- As configurações já existentes passam a declarar explicitamente qual login
-- operacional atende cada robô, sem duplicar credenciais na cota.
UPDATE public.robo_configuracoes
SET configuracao_tarefas = coalesce(configuracao_tarefas, '{}'::jsonb)
  || jsonb_build_object(
    'robo_boleto_login', CASE
      WHEN upper(nome) LIKE '%ERONI%' OR upper(nome) LIKE '%GAUCHINHO%' THEN 'GAUCHINHO_ERONI'
      WHEN upper(nome) LIKE '%FERNANDO%' OR upper(nome) LIKE '%RACON%' THEN 'RACON_FERNANDO'
      ELSE configuracao_tarefas->>'robo_boleto_login'
    END
  ),
  updated_at = now()
WHERE configuracao_tarefas->>'tipo_rotina' IN ('FRANQUIA_LANCES_AUTOMATICOS', 'FRANQUIA_DOWNLOAD_BOLETOS');
