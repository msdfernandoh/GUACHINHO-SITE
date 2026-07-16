-- Observação livre do cliente no fluxo de contratação online (etapa documentos)

alter table public.contratacoes_online
  add column if not exists observacao_cliente text;
