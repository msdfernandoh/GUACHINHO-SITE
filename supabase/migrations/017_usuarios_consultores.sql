-- Consultores comerciais para agenda e leads
alter table if exists public.usuarios
  add column if not exists is_consultor boolean not null default false;

comment on column public.usuarios.is_consultor is 'Usuário aparece nos selects de consultor (agenda/leads).';

update public.usuarios
set is_consultor = true
where perfil = 'srd' and coalesce(is_consultor, false) = false;
