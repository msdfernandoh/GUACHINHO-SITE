-- Alinha somente o catálogo aceito; não altera vínculos nem concede menus.
begin;
alter table public.empresa_usuarios drop constraint empresa_usuarios_erp_modulos_visiveis_check;
alter table public.empresa_usuarios add constraint empresa_usuarios_erp_modulos_visiveis_check check (
erp_modulos_visiveis is null or erp_modulos_visiveis <@ array[
'painel','leads','whatsapp','propostas','contratacoes','vendas','grupos','comissoes',
'financeiro','relatorios','metas','tarefas','usuarios','clientes','consultores',
'lances','assembleias','regras-comissao','repasse-franquia','minhas-comissoes',
'contas-pagar','conta-corrente-socios','robos']::text[]);
commit;
