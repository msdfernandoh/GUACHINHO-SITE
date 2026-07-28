-- Tokens OAuth Google Calendar fora de public.usuarios (sem SELECT para authenticated)
-- Se existir google_calendar_refresh_token em usuarios, copia para secrets antes de remover.

alter table public.usuarios
  add column if not exists google_calendar_email text;

comment on column public.usuarios.google_calendar_email is 'E-mail da conta Google autorizada no OAuth (pode diferir do e-mail de login).';

create table if not exists public.usuario_google_calendar_secrets (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

comment on table public.usuario_google_calendar_secrets is 'Refresh tokens Google — apenas service role (RLS sem policies).';

alter table public.usuario_google_calendar_secrets enable row level security;

-- Nenhuma policy: authenticated/anon não acessam; service role ignora RLS.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'usuarios'
      and column_name = 'google_calendar_refresh_token'
  ) then
    insert into public.usuario_google_calendar_secrets (usuario_id, refresh_token, updated_at)
    select u.id, u.google_calendar_refresh_token, coalesce(u.google_calendar_connected_at, now())
    from public.usuarios u
    where u.google_calendar_refresh_token is not null
      and length(trim(u.google_calendar_refresh_token)) > 0
    on conflict (usuario_id) do update
      set refresh_token = excluded.refresh_token,
          updated_at = excluded.updated_at;

    alter table public.usuarios drop column google_calendar_refresh_token;
  end if;
end $$;

revoke all on table public.usuario_google_calendar_secrets from anon, authenticated;
grant all on table public.usuario_google_calendar_secrets to service_role;
