-- A validade do lance representa uma oferta efetivamente enviada.
-- Estratégias configuradas permanecem ativas para o robô, mas não podem
-- aparentar execução antes de existir protocolo, horário ou confirmação.
UPDATE public.cota_estrategias_lance
SET
  data_lance = NULL,
  data_vencimento = NULL
WHERE ultimo_lance_ofertado_em IS NULL
  AND protocolo_lance_livre IS NULL
  AND protocolo_lance_fixo IS NULL
  AND protocolo_segundo_lance_fixo IS NULL
  AND coalesce(confirmado, false) = false
  AND (data_lance IS NOT NULL OR data_vencimento IS NOT NULL);
