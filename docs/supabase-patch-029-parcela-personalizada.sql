-- Cole no SQL Editor do Supabase SOMENTE se public.grupos_consorcio já existir.
-- Se der erro "relation grupos_consorcio does not exist", o schema de grupos ainda não foi aplicado:
--   rode as migrations em supabase/migrations/ (pelo menos 001) ou docs/supabase-aplicar-tudo.sql

-- Diagnóstico rápido:
-- select tablename from pg_tables where schemaname = 'public' and tablename like '%grupo%';

alter table public.grupos_consorcio
  add column if not exists permite_parcela_reduzida_personalizada boolean not null default false;

alter table public.grupos_consorcio
  add column if not exists percentual_parcela_reduzida_personalizada numeric;
