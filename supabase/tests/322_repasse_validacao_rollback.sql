-- Executar após a DDL 322, SEM commit da DDL, na mesma transação.
-- Usa os relatórios reais para validar integridade e repetição. Termina em ROLLBACK.
SELECT set_config('request.jwt.claim.sub',
  (SELECT auth_user_id::text FROM public.usuarios WHERE email='hugo@msdeducacao.com.br' LIMIT 1),true);
CREATE TEMP TABLE preservacao_322 AS SELECT
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.clientes x) clientes,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.vendas x) vendas,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.cotas_definitivas x) cotas,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.financeiro_recebimentos x) recebimentos,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.caixa_movimentos x) caixa,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.financeiro_pagamentos x) pagamentos,
  (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.comissao_previsoes_participantes x WHERE valor_pago>0) comissoes_pagas;

SET LOCAL ROLE authenticated;
SELECT public.rpc_autorizar_comissao_repasse_controle_322(
  '7170f38e-15dd-4b19-8588-51e9a9cf0d4c','b2c91567-229e-4c9a-81e2-187795f13e23',
  'd32ca86d-e5e5-4355-8449-c31ee3586d13',
  'Autorização expressa do titular em 19/10/2026: parcelas reais da DUO para Eroni; sem faturamento da venda.');
SELECT public.rpc_reprocessar_repasse_racon('7170f38e-15dd-4b19-8588-51e9a9cf0d4c','3cfd0b50-54e1-4e05-927b-9fca862c7485');
SELECT public.rpc_reprocessar_repasse_racon('7170f38e-15dd-4b19-8588-51e9a9cf0d4c','9df42da9-4b22-4137-a343-4f41b05c5eab');
RESET ROLE;

CREATE TEMP TABLE repeticao_322 AS SELECT
  (SELECT count(*) FROM public.erp_repasse_item_baixas) baixas,
  (SELECT count(*) FROM public.financeiro_recebimento_itens) itens,
  (SELECT count(*) FROM public.comissao_previsoes_franquia) previsoes,
  (SELECT count(*) FROM public.comissao_previsoes_participantes) participantes;
SET LOCAL ROLE authenticated;
SELECT public.rpc_reprocessar_repasse_racon('7170f38e-15dd-4b19-8588-51e9a9cf0d4c','3cfd0b50-54e1-4e05-927b-9fca862c7485');
-- Mesmo vínculo manual da Mônica, sem repetir a baixa.
SELECT public.rpc_vincular_item_repasse_com_cota('7170f38e-15dd-4b19-8588-51e9a9cf0d4c',
  'd735683d-5afc-4e71-8d8d-4b186ba730ff','a12e41ce-9ee1-4700-a22c-0a1583156543','teste-322-repeticao');
RESET ROLE;

DO $$
DECLARE antes record; depois record; r record; n integer;
BEGIN
  SELECT * INTO antes FROM preservacao_322;
  SELECT
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.clientes x) clientes,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.vendas x) vendas,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.cotas_definitivas x) cotas,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.financeiro_recebimentos x) recebimentos,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.caixa_movimentos x) caixa,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.financeiro_pagamentos x) pagamentos,
    (SELECT md5(string_agg(to_jsonb(x)::text,'' ORDER BY id)) FROM public.comissao_previsoes_participantes x WHERE valor_pago>0) comissoes_pagas INTO depois;
  IF to_jsonb(antes) IS DISTINCT FROM to_jsonb(depois) THEN RAISE EXCEPTION 'Falha de preservação dos dados anteriores'; END IF;
  SELECT * INTO r FROM repeticao_322;
  IF r.baixas<>(SELECT count(*) FROM public.erp_repasse_item_baixas)
    OR r.itens<>(SELECT count(*) FROM public.financeiro_recebimento_itens)
    OR r.previsoes<>(SELECT count(*) FROM public.comissao_previsoes_franquia)
    OR r.participantes<>(SELECT count(*) FROM public.comissao_previsoes_participantes)
    THEN RAISE EXCEPTION 'Repetição criou novos fatos'; END IF;
  SELECT count(*) INTO n FROM public.erp_repasse_importacao_itens
    WHERE importacao_id='3cfd0b50-54e1-4e05-927b-9fca862c7485' AND previsao_franquia_id IS NULL;
  IF n<>3 THEN RAISE EXCEPTION 'Esperadas somente três divergências de valor, encontrado %',n; END IF;
  IF EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i
    JOIN public.comissao_previsoes_franquia f ON f.id=i.previsao_franquia_id
    JOIN public.comissao_previsoes_participantes p ON p.previsao_franquia_id=f.id
    WHERE i.importacao_id='3cfd0b50-54e1-4e05-927b-9fca862c7485' AND f.snapshot_regra->>'cota_existente_322'='true'
      AND (f.valor_previsto<>i.valor_comissao OR p.valor_elegivel<>round(p.valor_previsto,2)
        OR f.percentual_imposto<>17.5 OR p.valor_pago<>0)) THEN RAISE EXCEPTION 'Valor, imposto ou elegibilidade incorretos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i
    JOIN public.comissao_previsoes_participantes p ON p.previsao_franquia_id=i.previsao_franquia_id
    JOIN public.vendas v ON v.id=p.venda_id
    WHERE i.id='9c6c2191-3472-4446-8424-ee22fa880958' AND p.participante_comercial_id='d32ca86d-e5e5-4355-8449-c31ee3586d13'
      AND v.somente_controle AND NOT v.afeta_faturamento AND p.valor_elegivel=618.75) THEN RAISE EXCEPTION 'DUO não preservou controle e comissão do Eroni'; END IF;
  IF has_function_privilege('authenticated','public.repasse_conciliar_linha_322(uuid,uuid)','EXECUTE')
    OR has_function_privilege('anon','public.rpc_autorizar_comissao_repasse_controle_322(uuid,uuid,uuid,text)','EXECUTE')
    THEN RAISE EXCEPTION 'Privilégios excessivos'; END IF;
END $$;

-- Proteção contra seleção de outra cota e outro tenant, sem escrever.
DO $$ BEGIN
  BEGIN
    PERFORM public.rpc_vincular_item_repasse_com_cota('7170f38e-15dd-4b19-8588-51e9a9cf0d4c',
      'd735683d-5afc-4e71-8d8d-4b186ba730ff','99f340b7-f094-48b5-83f6-c67441a6c247','teste-322-cota-incorreta');
    RAISE EXCEPTION 'Teste aceitou cota incorreta';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'Cota da comissão difere da cota do PDF' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.rpc_reprocessar_repasse_racon('00000000-0000-0000-0000-000000000001','3cfd0b50-54e1-4e05-927b-9fca862c7485');
    RAISE EXCEPTION 'Teste aceitou outro tenant';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('Sem permissão para atualizar a leitura deste repasse','Relatório não encontrado no tenant') THEN RAISE; END IF;
  END;
END $$;
SAVEPOINT saldo_322;
-- Simulação de linha acima do saldo, integralmente revertida ao savepoint.
UPDATE public.erp_repasse_importacao_itens SET valor_comissao=valor_comissao+100000
  WHERE importacao_id='9df42da9-4b22-4137-a343-4f41b05c5eab' AND linha=6;
DO $$ DECLARE i record; resultado jsonb; BEGIN
  SELECT * INTO i FROM public.erp_repasse_importacao_itens
    WHERE importacao_id='9df42da9-4b22-4137-a343-4f41b05c5eab' AND linha=6;
  resultado:=public.rpc_vincular_item_repasse_com_cota(i.empresa_id,i.id,i.previsao_franquia_id,'teste-322-sem-saldo');
  IF NOT (resultado->>'baixa_pendente')::boolean OR (resultado->>'valor_vinculado')::numeric<>750
    THEN RAISE EXCEPTION 'Vínculo sem saldo não preservou a baixa anterior'; END IF;
END $$;
ROLLBACK TO SAVEPOINT saldo_322;

SAVEPOINT importador_322;
DO $$ DECLARE imp record; item record; resultado jsonb; BEGIN
  SELECT * INTO imp FROM public.erp_repasse_importacoes WHERE id='3cfd0b50-54e1-4e05-927b-9fca862c7485';
  SELECT * INTO item FROM public.erp_repasse_importacao_itens WHERE importacao_id=imp.id AND linha=2;
  resultado:=public.rpc_importar_repasse_racon(imp.empresa_id,imp.administradora_id,imp.competencia,
    'teste-transacional-322.pdf','teste-transacional-322.pdf',repeat('a',64),
    jsonb_build_object('valor_total',item.valor_comissao,'itens',jsonb_build_array(item.dados_origem)),current_date,'Teste rollback',NULL);
  IF (resultado->>'importacao_id') IS NULL OR (resultado->>'idempotente')::boolean
    THEN RAISE EXCEPTION 'Importador novo não retornou relatório'; END IF;
END $$;
ROLLBACK TO SAVEPOINT importador_322;

SELECT 'APROVADO: preservação integral, 10 vínculos de 15/10, continuidade em 05/10, repetição, manual com e sem saldo, importador novo, fiscal, tenant e privilégios' AS resultado;
ROLLBACK;
