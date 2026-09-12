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

comment on column public.eventos.checkin_modo is 'Modo de disponibilidade do check-in: "agendado" (abre no dia/hora com antecedência), "ativo_agora" (liberado imediatamente para teste/ensaio) ou "encerrado".';
comment on column public.eventos.checkin_abertura_antecipada_minutos is 'Minutos antes do horário do evento em que o check-in abre automaticamente quando em modo agendado (padrão: 30 minutos).';
comment on column public.eventos.checkin_ativo_manual_at is 'Data/hora em que o modo foi alterado manualmente para ativo_agora.';
comment on column public.eventos.checkin_ativo_manual_por_id is 'Usuário responsável pela ativação manual do check-in.';
