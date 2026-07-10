-- Vincula participante do sorteio à inscrição oficial do evento

alter table public.eventos_sorteio_participantes
  add column if not exists evento_participante_id uuid references public.eventos_participantes (id) on delete cascade;

create unique index if not exists eventos_sorteio_participantes_inscricao_unique
  on public.eventos_sorteio_participantes (sorteio_id, evento_participante_id)
  where evento_participante_id is not null;

create index if not exists eventos_sorteio_participantes_inscricao_idx
  on public.eventos_sorteio_participantes (evento_participante_id);
