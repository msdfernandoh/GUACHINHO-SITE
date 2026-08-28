-- Seguro prestamista pertence a todos os grupos. A adesao antes da
-- contemplacao e uma escolha da venda; depois da contemplacao e obrigatoria.
-- As colunas booleanas permanecem por compatibilidade com o runtime legado,
-- mas deixam de representar uma configuracao opcional do cadastro do grupo.

update public.grupos_consorcio
set
  seguro_habilitado = true,
  seguro_pos_contemplacao = true
where seguro_habilitado is distinct from true
   or seguro_pos_contemplacao is distinct from true;

alter table public.grupos_consorcio
  alter column seguro_habilitado set default true,
  alter column seguro_pos_contemplacao set default true;

comment on column public.grupos_consorcio.seguro_habilitado is
  'Compatibilidade: seguro prestamista esta disponivel em todos os grupos; a escolha inicial pertence a venda.';

comment on column public.grupos_consorcio.seguro_pos_contemplacao is
  'Compatibilidade: seguro prestamista e obrigatorio para todos os clientes apos a contemplacao.';
