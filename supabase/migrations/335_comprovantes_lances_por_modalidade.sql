-- Evidência de auditoria: uma linha de oferta pode existir mesmo quando o
-- Newcon não exibe protocolo, desde que o comprovante da tela tenha sido salvo.
-- A modalidade continua identificando individualmente cada lance da cota.
ALTER TABLE public.cota_lances_ofertados
  ALTER COLUMN protocolo DROP NOT NULL;

COMMENT ON COLUMN public.cota_lances_ofertados.comprovante_storage_path IS
  'Arquivo individual da modalidade ofertada; nunca reutilizar o caminho de outra modalidade da mesma cota.';
