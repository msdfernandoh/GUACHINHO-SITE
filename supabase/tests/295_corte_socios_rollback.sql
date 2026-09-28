-- Teste transacional: não cria fechamento ou conta persistente.
BEGIN;
INSERT INTO public.financeiro_fechamentos_socios_cortes
  (empresa_id,periodo_inicio,periodo_fim,demonstrativo,observacoes,idempotency_key)
VALUES ('7170f38e-15dd-4b19-8588-51e9a9cf0d4c','2000-01-01','2000-01-31','{}',
  'Teste transacional da trava de período; desfazer integralmente.',
  'teste-corte-rollback-2000-01');
DO $$
BEGIN
  BEGIN
    INSERT INTO public.financeiro_contas_pagar
      (empresa_id,descricao,vencimento,competencia,valor)
    VALUES ('7170f38e-15dd-4b19-8588-51e9a9cf0d4c','TESTE NAO PERSISTENTE',
      '2000-01-20','2000-01',1);
    RAISE EXCEPTION 'FALHA: a despesa antiga foi aceita';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Não é permitido lançar despesa anterior ao corte de 2000-01-31' THEN
      RAISE;
    END IF;
  END;
END;
$$;
ROLLBACK;
