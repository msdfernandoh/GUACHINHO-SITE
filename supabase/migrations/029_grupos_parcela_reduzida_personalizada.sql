-- Parcela reduzida personalizada (promoções pontuais por grupo)
-- Pré-requisito: tabela public.grupos_consorcio (migration 001_initial_schema.sql e demais do módulo grupos).

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'grupos_consorcio'
  ) then
    raise exception
      'Tabela public.grupos_consorcio não existe neste projeto. '
      'Aplique antes as migrations 001–028 (ou o bloco grupos em docs/supabase-aplicar-tudo.sql). '
      'No SQL Editor, confira: select tablename from pg_tables where schemaname = ''public'' and tablename like ''%%grupo%%'';';
  end if;
end $$;

alter table public.grupos_consorcio
  add column if not exists permite_parcela_reduzida_personalizada boolean not null default false;

alter table public.grupos_consorcio
  add column if not exists percentual_parcela_reduzida_personalizada numeric;

comment on column public.grupos_consorcio.permite_parcela_reduzida_personalizada is
  'Se true, o simulador /grupos exibe parcela Personalizada com % editável na linha.';

comment on column public.grupos_consorcio.percentual_parcela_reduzida_personalizada is
  'Percentual sugerido da parcela personalizada (ex. 40 = 40%% da integral). Opcional.';
