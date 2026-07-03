-- Telefone/WhatsApp opcional de quem indicou (formulário /indicar)

alter table public.leads
  add column if not exists parceiro_indicador_telefone text;
