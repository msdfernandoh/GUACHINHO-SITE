-- Ativação inicial aprovada do shell ERP para a tenant existente Gauchinho.
BEGIN;
UPDATE public.empresas
SET configuracoes = jsonb_set(
  COALESCE(configuracoes, '{}'::jsonb),
  '{erp_sistema}',
  '{"habilitado":true,"modulos":["painel","leads","propostas","contratacoes","vendas","grupos","comissoes","financeiro","relatorios","metas","tarefas","usuarios"]}'::jsonb,
  true
)
WHERE slug = 'gauchinho';
COMMIT;
