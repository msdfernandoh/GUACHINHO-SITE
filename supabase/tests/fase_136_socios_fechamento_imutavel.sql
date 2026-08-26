-- Pós-check read-only da Fase 136 / Migration 134.
SELECT jsonb_build_object(
  'tabelas', jsonb_build_object(
    'empresa_socios', to_regclass('public.empresa_socios') IS NOT NULL,
    'empresa_socio_contas', to_regclass('public.empresa_socio_contas') IS NOT NULL,
    'fechamentos', to_regclass('public.financeiro_fechamentos_socios') IS NOT NULL,
    'itens', to_regclass('public.financeiro_fechamento_socios_itens') IS NOT NULL,
    'instrucoes', to_regclass('public.financeiro_fechamento_socios_instrucoes') IS NOT NULL
  ),
  'quadros_invalidos', (
    SELECT count(*) FROM (
      SELECT empresa_id FROM public.empresa_socios WHERE ativo GROUP BY empresa_id
      HAVING round(sum(percentual_participacao), 4) <> 100
    ) q
  ),
  'rpc_salvar_anon', has_function_privilege('anon', 'public.rpc_platform_salvar_quadro_societario(uuid,jsonb)', 'EXECUTE'),
  'rpc_salvar_service', has_function_privilege('service_role', 'public.rpc_platform_salvar_quadro_societario(uuid,jsonb)', 'EXECUTE'),
  'rpc_fechar_anon', has_function_privilege('anon', 'public.rpc_fechar_socios(uuid,date,date,text)', 'EXECUTE'),
  'rpc_fechar_service', has_function_privilege('service_role', 'public.rpc_fechar_socios(uuid,date,date,text)', 'EXECUTE'),
  'triggers_imutabilidade', (
    SELECT count(*) FROM pg_trigger
    WHERE NOT tgisinternal AND tgname LIKE 'trg_financeiro_fechamento%_imutavel'
  ),
  'trigger_bloqueio_sobreposicao', (
    SELECT count(*) FROM pg_trigger
    WHERE NOT tgisinternal AND tgname = 'financeiro_fechamentos_socios_validar_periodo'
  ),
  'tabelas_com_rls', (
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN (
        'empresa_socios', 'empresa_socio_contas', 'financeiro_fechamentos_socios',
        'financeiro_fechamento_socios_itens', 'financeiro_fechamento_socios_instrucoes'
      ) AND c.relrowsecurity
  )
) AS auditoria_fase_136;
