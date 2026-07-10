-- Endereço na contratação online (etapa CPF/CNPJ)

alter table public.contratacoes_online
  add column if not exists cep text,
  add column if not exists endereco text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text;

create index if not exists contratacoes_online_cep_idx on public.contratacoes_online (cep);
