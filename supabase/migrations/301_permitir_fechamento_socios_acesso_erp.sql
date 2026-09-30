-- 301: mantém a validação de menus individuais do ERP alinhada ao catálogo atual.
-- Forward-only: não altera vínculos existentes nem concede acessos automaticamente.
begin;

alter table public.empresa_usuarios
  drop constraint if exists empresa_usuarios_erp_modulos_visiveis_check;

alter table public.empresa_usuarios
  add constraint empresa_usuarios_erp_modulos_visiveis_check check (
    erp_modulos_visiveis is null or
    erp_modulos_visiveis <@ array[
      'painel','leads','propostas','contratacoes','vendas','grupos','comissoes',
      'financeiro','relatorios','metas','tarefas','usuarios','clientes','consultores',
      'lances','assembleias','regras-comissao','repasse-franquia','minhas-comissoes',
      'contas-pagar','conta-corrente-socios'
    ]::text[]
  );

comment on constraint empresa_usuarios_erp_modulos_visiveis_check on public.empresa_usuarios is
  'Permite somente IDs do catálogo ERP, incluindo o fechamento dos sócios.';

commit;
