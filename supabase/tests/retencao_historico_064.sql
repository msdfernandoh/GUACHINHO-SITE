-- Executar em branch Supabase descartável após a migration 064.
-- Não persiste mudanças: confirma somente que fatos históricos impedem delete.
BEGIN;

DO $$
DECLARE
  v_empresa uuid;
  v_bloqueou boolean := false;
  v_constraint text;
  v_definicao text;
BEGIN
  FOREACH v_constraint IN ARRAY ARRAY[
    'contratacoes_online_empresa_id_fkey', 'vendas_empresa_id_fkey',
    'cotas_definitivas_empresa_id_fkey', 'cotas_definitivas_venda_id_fkey',
    'comissao_previsoes_franquia_empresa_id_fkey', 'comissao_previsoes_franquia_venda_id_fkey',
    'comissao_previsoes_participantes_empresa_id_fkey', 'comissao_previsoes_participantes_venda_id_fkey',
    'financeiro_recebimentos_empresa_id_fkey', 'financeiro_pagamentos_empresa_id_fkey',
    'financeiro_compensacoes_empresa_id_fkey', 'financeiro_recebimento_itens_recebimento_id_fkey',
    'financeiro_pagamento_itens_pagamento_id_fkey', 'caixa_movimentos_empresa_id_fkey',
    'audit_logs_central_empresa_id_fkey', 'equipes_empresa_id_fkey',
    'metas_comerciais_empresa_id_fkey', 'tarefas_gestao_empresa_id_fkey'
  ] LOOP
    SELECT pg_get_constraintdef(oid) INTO v_definicao
    FROM pg_constraint WHERE conname = v_constraint;
    IF v_definicao IS NULL OR v_definicao NOT LIKE '%ON DELETE RESTRICT%' THEN
      RAISE EXCEPTION 'Retenção falhou: constraint % não está em RESTRICT', v_constraint;
    END IF;
  END LOOP;

  SELECT empresa_id INTO v_empresa
  FROM public.vendas
  WHERE empresa_id IS NOT NULL
  LIMIT 1;

  IF v_empresa IS NULL THEN
    RAISE EXCEPTION 'Fixture ausente: vendas sem empresa para validar retenção';
  END IF;

  BEGIN
    DELETE FROM public.empresas WHERE id = v_empresa;
  EXCEPTION WHEN OTHERS THEN
    v_bloqueou := true;
  END;

  IF NOT v_bloqueou THEN
    RAISE EXCEPTION 'Retenção falhou: exclusão de empresa com histórico não foi bloqueada';
  END IF;
END $$;

ROLLBACK;
