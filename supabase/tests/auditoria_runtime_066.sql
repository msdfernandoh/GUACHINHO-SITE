-- Executar em branch Supabase descartável após a migration 066.
-- A alteração e o evento append-only são revertidos juntos.
BEGIN;

DO $$
DECLARE
  v_venda uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_venda FROM public.vendas LIMIT 1;
  IF v_venda IS NULL THEN
    RAISE EXCEPTION 'Fixture ausente: venda';
  END IF;

  UPDATE public.vendas SET updated_at = updated_at WHERE id = v_venda;

  SELECT count(*) INTO v_count
  FROM public.audit_logs_central
  WHERE entidade_id = v_venda
    AND modulo = 'venda'
    AND acao = 'update'
    AND origem = 'database_trigger'
    AND resultado = 'SUCESSO';

  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Auditoria runtime falhou: esperado 1 evento, obtido %', v_count;
  END IF;
END $$;

ROLLBACK;

SELECT 'PASS' AS resultado,
       'evento de venda na mesma transação; rollback sem fixture residual' AS teste;
