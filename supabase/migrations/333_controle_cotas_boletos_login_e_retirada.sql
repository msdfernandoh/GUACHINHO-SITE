-- Fase 333: seleção operacional do login e autorização de retirada de boletos.
-- A carteira continua pertencendo à Gauchinho; o login é uma responsabilidade
-- operacional por cota, não uma nova empresa nem uma duplicação de clientes.

ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS retirar_boleto_automatico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clientes.retirar_boleto_automatico IS
  'Quando true, o robô deve emitir/baixar o boleto mensal para este cliente. False significa retirada pelo cliente ou não autorizado.';

ALTER TABLE public.cotas_definitivas
  ADD COLUMN IF NOT EXISTS robo_boleto_login text;

ALTER TABLE public.cotas_definitivas
  DROP CONSTRAINT IF EXISTS cotas_definitivas_robo_boleto_login_check;

ALTER TABLE public.cotas_definitivas
  ADD CONSTRAINT cotas_definitivas_robo_boleto_login_check
  CHECK (robo_boleto_login IS NULL OR robo_boleto_login IN ('GAUCHINHO_ERONI', 'RACON_FERNANDO'));

COMMENT ON COLUMN public.cotas_definitivas.robo_boleto_login IS
  'Login operacional responsável pela baixa: GAUCHINHO_ERONI ou RACON_FERNANDO.';

CREATE INDEX IF NOT EXISTS cotas_definitivas_robo_boleto_login_idx
  ON public.cotas_definitivas (empresa_id, robo_boleto_login);

-- A configuração do robô Racon Sinop usa a credencial da Racon, mas consulta
-- a carteira canônica da Gauchinho. Mantém a separação entre identidade e dados.
UPDATE public.robo_configuracoes
SET configuracao_tarefas = coalesce(configuracao_tarefas, '{}'::jsonb)
  || jsonb_build_object(
    'empresa_dados_id', '7170f38e-15dd-4b19-8588-51e9a9cf0d4c',
    'robo_boleto_login', 'RACON_FERNANDO'
  ),
    updated_at = now()
WHERE id = '4bf91f25-ae94-42de-8a92-eb92064fb357';

UPDATE public.robo_configuracoes
SET configuracao_tarefas = coalesce(configuracao_tarefas, '{}'::jsonb)
  || jsonb_build_object(
    'empresa_dados_id', '7170f38e-15dd-4b19-8588-51e9a9cf0d4c',
    'robo_boleto_login', 'GAUCHINHO_ERONI'
  ),
    updated_at = now()
WHERE id = '18b9a4c7-5487-499a-9b5d-b0e49415c5a7';
