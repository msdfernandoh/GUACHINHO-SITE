-- Lista de convidados: link público por slug (cadastro sem admin)

alter table public.eventos_listas_convidados
  add column if not exists publica boolean not null default false,
  add column if not exists slug text;

create unique index if not exists eventos_listas_convidados_slug_public_idx
  on public.eventos_listas_convidados (slug)
  where slug is not null and publica = true;

-- Leitura anônima só de listas publicadas (metadados para formulário)
create policy eventos_listas_convidados_public_read on public.eventos_listas_convidados
  for select to anon
  using (publica = true and slug is not null);
