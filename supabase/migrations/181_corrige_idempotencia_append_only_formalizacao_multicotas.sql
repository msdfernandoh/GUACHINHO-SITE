-- 181: a formalizacao multicotas deve respeitar o ledger de idempotencia
-- append-only. A resposta final e reconstruida das cotas persistidas em retry;
-- portanto nao ha motivo para reescrever o registro criado pelo nucleo canonico.
BEGIN;

DO $migration$
DECLARE
  v_assinatura regprocedure :=
    'public.rpc_converter_contratacao_venda_multicotas(uuid,uuid,integer,text)'::regprocedure;
  v_definicao text;
  v_bloco_mutavel text := $sql$
  -- Mantém a resposta do núcleo canônico compatível em eventuais retries.
  UPDATE public.operacoes_idempotentes
  SET resposta = v_response
  WHERE empresa_id = p_empresa_id
    AND operacao = 'CONVERSAO_VENDA'
    AND idempotency_key = p_idempotency_key;
$sql$;
BEGIN
  SELECT pg_get_functiondef(v_assinatura) INTO v_definicao;

  IF position(v_bloco_mutavel IN v_definicao) = 0 THEN
    RAISE EXCEPTION
      'Bloco mutável esperado não encontrado em rpc_converter_contratacao_venda_multicotas';
  END IF;

  v_definicao := replace(
    v_definicao,
    v_bloco_mutavel,
    E'\n  -- operacoes_idempotentes e append-only; a resposta multicotas e\n  -- reconstruida deterministicamente a partir de cotas_definitivas.\n'
  );

  IF position('UPDATE public.operacoes_idempotentes' IN v_definicao) > 0 THEN
    RAISE EXCEPTION 'A RPC multicotas ainda tenta alterar o ledger de idempotência';
  END IF;

  EXECUTE v_definicao;
END
$migration$;

COMMIT;
NOTIFY pgrst, 'reload schema';

