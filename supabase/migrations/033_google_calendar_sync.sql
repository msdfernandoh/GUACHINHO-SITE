-- Sincronização da agenda comercial com Google Calendar (consultores Gmail)
-- Pré-requisitos: 001_initial_schema.sql (usuarios) e 016_eventos_agenda.sql (agenda_compromissos)

DO $$
BEGIN
  IF to_regclass('public.usuarios') IS NULL THEN
    RAISE EXCEPTION
      'Tabela public.usuarios não existe neste banco. Rode as migrations na ordem (001 → … → 032) ou execute na raiz do repo: supabase link --project-ref SEU_REF && supabase db push. Só então aplique esta migration 033.';
  END IF;
  IF to_regclass('public.agenda_compromissos') IS NULL THEN
    RAISE EXCEPTION
      'Tabela public.agenda_compromissos não existe. Aplique supabase/migrations/016_eventos_agenda.sql (ou supabase db push completo) antes da 033.';
  END IF;
END $$;

alter table public.usuarios
  add column if not exists google_agenda_sync boolean not null default false,
  add column if not exists google_calendar_refresh_token text,
  add column if not exists google_calendar_connected_at timestamptz;

comment on column public.usuarios.google_agenda_sync is 'Se true, consultor pode conectar Gmail e receber compromissos no Google Agenda.';
comment on column public.usuarios.google_calendar_refresh_token is 'OAuth refresh token — uso exclusivo no servidor (service role).';

alter table public.agenda_compromissos
  add column if not exists google_calendar_event_id text;

comment on column public.agenda_compromissos.google_calendar_event_id is 'ID do evento criado no Google Calendar do consultor.';
