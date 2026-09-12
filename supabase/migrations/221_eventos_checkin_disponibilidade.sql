-- ===========================================================================
-- Migration 221: Eventos — Controle de Disponibilidade do Check-in
--                (Modo Agendado, Ativo Agora, Antecedência e Auditoria)
-- ===========================================================================

-- 1. Colunas de controle de disponibilidade e antecedência em public.eventos
alter table public.eventos
  add column if not exists checkin_modo text not null default 'agendado',
  add column if not exists checkin_abertura_antecipada_minutos integer not null default 30,
  add column if not exists checkin_ativo_manual_at timestamptz,
  add column if not exists checkin_ativo_manual_por_id uuid references public.usuarios (id) on delete set null;

-- 2. Constraints de integridade para modo e antecedência
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eventos_checkin_modo_check') then
    alter table public.eventos
      add constraint eventos_checkin_modo_check
      check (checkin_modo in ('agendado', 'ativo_agora', 'encerrado'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'eventos_checkin_antecipacao_check') then
    alter table public.eventos
      add constraint eventos_checkin_antecipacao_check
      check (checkin_abertura_antecipada_minutos >= 0);
  end if;
end $$;

-- 3. Documentação das colunas
comment on column public.eventos.checkin_modo is 'Modo de disponibilidade do check-in: "agendado" (abre no dia/hora com antecedência), "ativo_agora" (liberado imediatamente para teste/ensaio) ou "encerrado".';
comment on column public.eventos.checkin_abertura_antecipada_minutos is 'Minutos antes do horário do evento em que o check-in abre automaticamente quando em modo agendado (padrão: 30 minutos).';
comment on column public.eventos.checkin_ativo_manual_at is 'Data/hora em que o modo foi alterado manualmente para ativo_agora.';
comment on column public.eventos.checkin_ativo_manual_por_id is 'Usuário responsável pela ativação manual do check-in (referência a public.usuarios(id) com ON DELETE SET NULL para desacoplamento de auditoria).';

-- ===========================================================================
-- SCRIPT DE ROLLBACK DOCUMENTADO (Executar apenas em caso de reversão explícita)
-- ===========================================================================
-- alter table public.eventos drop constraint if exists eventos_checkin_antecipacao_check;
-- alter table public.eventos drop constraint if exists eventos_checkin_modo_check;
-- alter table public.eventos drop column if exists checkin_ativo_manual_por_id;
-- alter table public.eventos drop column if exists checkin_ativo_manual_at;
-- alter table public.eventos drop column if exists checkin_abertura_antecipada_minutos;
-- alter table public.eventos drop column if exists checkin_modo;
