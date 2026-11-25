-- Colaboradores: revenda/administrador cadastra pessoas da equipe que vendem por ela.
-- O colaborador vê só o percentual de comissão definido pelo responsável e pode incluir ágio.
alter table public.contempladas_usuarios
  add column if not exists responsavel_auth_id uuid,
  add column if not exists responsavel_nome text,
  add column if not exists colaborador_percentual numeric(5,2);

alter table public.contempladas_comissoes
  add column if not exists colaborador_auth_id uuid,
  add column if not exists colaborador_nome text,
  add column if not exists tipo text not null default 'REVENDA';

create index if not exists contempladas_usuarios_responsavel_idx
  on public.contempladas_usuarios (empresa_id, responsavel_auth_id);
