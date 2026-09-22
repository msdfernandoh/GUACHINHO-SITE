-- Acompanhante e consumo de vagas nos convites do app do indicador.
alter table public.programa_convites_eventos_pendentes
  add column if not exists tem_acompanhante boolean not null default false,
  add column if not exists nome_acompanhante text,
  add column if not exists quantidade_vagas integer not null default 1
    check (quantidade_vagas in (1,2));

alter table public.eventos_listas_convidados_itens
  add column if not exists tem_acompanhante boolean not null default false,
  add column if not exists nome_acompanhante text,
  add column if not exists quantidade_vagas integer not null default 1
    check (quantidade_vagas in (1,2));

notify pgrst, 'reload schema';
