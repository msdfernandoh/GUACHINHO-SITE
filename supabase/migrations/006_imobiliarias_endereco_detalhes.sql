-- Endereço estruturado e descrição curta para vitrine pública

alter table public.imobiliarias
  add column if not exists estado text,
  add column if not exists numero text,
  add column if not exists bairro text,
  add column if not exists complemento text,
  add column if not exists descricao_curta text;
