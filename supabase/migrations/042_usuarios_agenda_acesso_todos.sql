-- Permite que usuários (ex.: atendente) vejam e gerenciem a agenda de todos os consultores.

alter table public.usuarios
  add column if not exists agenda_acesso_todos boolean not null default false;

comment on column public.usuarios.agenda_acesso_todos is
  'Se true, vê todos os compromissos na Agenda (agendar, editar, cancelar) de qualquer consultor.';
