-- Esconde a comissão na página principal; o olho só revela com a senha do usuário.
alter table public.contempladas_usuarios add column if not exists ocultar_comissao boolean not null default false;
