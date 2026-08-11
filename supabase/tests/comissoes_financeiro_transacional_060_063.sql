-- Executar somente em branch Supabase isolada após 060–063.
-- Toda fixture e todo fato financeiro são revertidos ao final.
BEGIN;

DO $test$
DECLARE
  v_empresa constant uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_empresa_b constant uuid := '8e4e13f9-80e6-44db-a21b-584a43b6f024';
  v_admin constant uuid := 'c5f8ecb4-cb5a-5014-b567-50484719b404';
  v_grupo_auto constant uuid := '479db79e-533a-4c23-9d2c-d8bf9f265e57';
  v_grupo_imovel constant uuid := '3a0cf303-cd16-494a-b8eb-5831c6ff37e2';
  v_participante constant uuid := 'a74da3c4-4d1f-49a6-b2fd-a6b48a5fcd00';
  v_programa uuid := gen_random_uuid();
  v_venda uuid := gen_random_uuid();
  v_venda_percentual uuid := gen_random_uuid();
  v_venda_ambigua uuid := gen_random_uuid();
  v_contratacao uuid := gen_random_uuid();
  v_cota uuid := gen_random_uuid();
  v_cota_percentual uuid := gen_random_uuid();
  v_cota_ambigua uuid := gen_random_uuid();
  v_result jsonb;
  v_result_reuso jsonb;
  v_franquia_1 uuid;
  v_participante_1 uuid;
  v_recebimento_1 uuid;
  v_recebimento_2 uuid;
  v_pagamento_1 uuid;
  v_pagamento_2 uuid;
  v_estorno_recebimento uuid;
  v_count integer;
  v_valor numeric;
BEGIN
  INSERT INTO public.comissao_programas(id,empresa_id,nome,administradora_id,ativo)
  VALUES(v_programa,v_empresa,'TESTE CODEX 060-063',v_admin,true);

  -- Franquia genérica percentual e regra Auto fixa mais específica.
  INSERT INTO public.comissao_regras_franquia(
    empresa_id,programa_id,versao,percentual_total_comissao,base_calculo,
    vigencia_inicio,ativa,etapas_cronograma,configuracao_homologada,origem_configuracao
  ) VALUES (
    v_empresa,v_programa,1,2.5000,'credito','2026-01-01',true,
    '[{"ordem":1,"mes_relativo":1,"percentual_etapa":33.33,"nome":"Etapa 1"},{"ordem":2,"mes_relativo":2,"percentual_etapa":33.33,"nome":"Etapa 2"},{"ordem":3,"mes_relativo":3,"percentual_etapa":33.34,"nome":"Etapa 3"}]',
    true,'TESTE_ISOLADO'
  );
  INSERT INTO public.comissao_regras_franquia(
    empresa_id,programa_id,versao,base_calculo,valor_fixo_total,modalidade,
    vigencia_inicio,ativa,etapas_cronograma,configuracao_homologada,origem_configuracao
  ) VALUES (
    v_empresa,v_programa,1,'valor_fixo',25.01,'Auto','2026-01-01',true,
    '[{"ordem":1,"mes_relativo":1,"valor_etapa":8.33,"nome":"Etapa 1"},{"ordem":2,"mes_relativo":2,"valor_etapa":8.33,"nome":"Etapa 2"},{"ordem":3,"mes_relativo":3,"valor_etapa":8.35,"nome":"Etapa 3"}]',
    true,'TESTE_ISOLADO'
  );

  -- Genérica existe, mas a regra específica do participante deve vencer.
  INSERT INTO public.comissao_regras_participantes(
    empresa_id,programa_id,versao,percentual_comissao,base_calculo,vigencia_inicio,
    ativa,etapas_cronograma,configuracao_homologada,origem_configuracao
  ) VALUES (
    v_empresa,v_programa,1,0.5000,'credito','2026-01-01',true,
    '[{"ordem":1,"mes_relativo":1,"percentual_etapa":33.33,"nome":"Etapa 1"},{"ordem":2,"mes_relativo":2,"percentual_etapa":33.33,"nome":"Etapa 2"},{"ordem":3,"mes_relativo":3,"percentual_etapa":33.34,"nome":"Etapa 3"}]',
    true,'TESTE_ISOLADO'
  );
  INSERT INTO public.comissao_regras_participantes(
    empresa_id,programa_id,participante_comercial_id,versao,percentual_comissao,
    base_calculo,vigencia_inicio,ativa,etapas_cronograma,
    configuracao_homologada,origem_configuracao
  ) VALUES (
    v_empresa,v_programa,v_participante,1,1.0000,'credito','2026-01-01',true,
    '[{"ordem":1,"mes_relativo":1,"percentual_etapa":33.33,"nome":"Etapa 1"},{"ordem":2,"mes_relativo":2,"percentual_etapa":33.33,"nome":"Etapa 2"},{"ordem":3,"mes_relativo":3,"percentual_etapa":33.34,"nome":"Etapa 3"}]',
    true,'TESTE_ISOLADO'
  );

  INSERT INTO public.vendas(id,empresa_id,cliente_nome,administradora_id,grupo_id,
    participante_comercial_id,valor_credito,prazo,parcela,status,data_venda)
  VALUES(v_venda,v_empresa,'Fixture Auto',v_admin,v_grupo_auto,v_participante,1000.01,60,20,'confirmada','2026-08-11');
  INSERT INTO public.cotas_definitivas(id,empresa_id,venda_id,administradora_id,grupo_id,
    numero_grupo,valor_credito,prazo,parcela,status,participante_comercial_id)
  VALUES(v_cota,v_empresa,v_venda,v_admin,v_grupo_auto,'TESTE-AUTO',1000.01,60,20,'ativa',v_participante);

  v_result:=public.rpc_gerar_previsoes_comissao(v_empresa,v_venda,'teste-geracao-auto-001');
  v_result_reuso:=public.rpc_gerar_previsoes_comissao(v_empresa,v_venda,'teste-geracao-auto-001');
  IF v_result_reuso->>'reused' <> 'false' THEN
    -- A mesma resposta congelada é devolvida; o registro de idempotência guarda reused=false.
    RAISE EXCEPTION 'Resposta idempotente inesperadamente alterada';
  END IF;
  SELECT count(*),sum(valor_previsto) INTO v_count,v_valor
  FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda;
  IF v_count<>3 OR v_valor<>25.01 THEN RAISE EXCEPTION 'Valor fixo/cronograma inválido: %, %',v_count,v_valor;END IF;
  IF (SELECT valor_previsto FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda AND ordem_etapa=3)<>8.35
    THEN RAISE EXCEPTION 'Distribuição determinística de centavos falhou';END IF;
  SELECT count(*),sum(valor_previsto) INTO v_count,v_valor
  FROM public.comissao_previsoes_participantes WHERE venda_id=v_venda;
  IF v_count<>3 OR v_valor<>10.00 THEN RAISE EXCEPTION 'Percentual participante inválido: %, %',v_count,v_valor;END IF;
  IF (SELECT snapshot_regra->>'precedencia' FROM public.comissao_previsoes_participantes WHERE venda_id=v_venda LIMIT 1)<>'participante'
    THEN RAISE EXCEPTION 'Precedência específica do participante não venceu';END IF;
  SELECT id INTO v_franquia_1 FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda AND ordem_etapa=1;
  SELECT id INTO v_participante_1 FROM public.comissao_previsoes_participantes WHERE venda_id=v_venda AND ordem_etapa=1;

  -- Conversão comercial é uma única transação e a repetição não duplica venda/cota.
  INSERT INTO public.contratacoes_online(
    id,public_token,protocolo,origem,status,empresa_id,nome,telefone,email,
    credito_selecionado,parcela_estimada,prazo,grupo_id,participante_comercial_id,dados_simulacao
  ) VALUES (
    v_contratacao,'codex-token-'||v_contratacao,'CODEX-'||replace(v_contratacao::text,'-',''),
    'grupos','confirmada',v_empresa,'Fixture Conversão','65999999999','fixture@example.invalid',
    1000.01,20.00,60,v_grupo_auto,v_participante,'{}'
  );
  v_result:=public.rpc_converter_contratacao_venda(v_empresa,v_contratacao,'teste-conversao-venda-001');
  PERFORM public.rpc_converter_contratacao_venda(v_empresa,v_contratacao,'teste-conversao-venda-001');
  IF v_result->'venda'->>'contratacao_id'<>v_contratacao::text OR v_result->'cotaDefinitiva'->>'venda_id'<>v_result->'venda'->>'id'
    THEN RAISE EXCEPTION 'Conversão não retornou venda/cota íntegras';END IF;
  IF (SELECT count(*) FROM public.vendas WHERE contratacao_id=v_contratacao)<>1 OR
     (SELECT count(*) FROM public.cotas_definitivas WHERE venda_id=(v_result->'venda'->>'id')::uuid)<>1
    THEN RAISE EXCEPTION 'Conversão idempotente duplicou fatos comerciais';END IF;

  -- Grupo Imóvel usa a regra percentual genérica da franquia.
  INSERT INTO public.vendas(id,empresa_id,cliente_nome,administradora_id,grupo_id,valor_credito,prazo,parcela,status,data_venda)
  VALUES(v_venda_percentual,v_empresa,'Fixture Imóvel',v_admin,v_grupo_imovel,1000.01,60,20,'confirmada','2026-08-11');
  INSERT INTO public.cotas_definitivas(id,empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,valor_credito,prazo,parcela,status)
  VALUES(v_cota_percentual,v_empresa,v_venda_percentual,v_admin,v_grupo_imovel,'TESTE-IMOVEL',1000.01,60,20,'ativa');
  PERFORM public.rpc_gerar_previsoes_comissao(v_empresa,v_venda_percentual,'teste-geracao-percentual-001');
  SELECT sum(valor_previsto) INTO v_valor FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda_percentual;
  IF v_valor<>25.00 THEN RAISE EXCEPTION 'Cálculo percentual/centavos da franquia falhou: %',v_valor;END IF;

  -- Liquidação parcial da franquia libera participante apenas proporcionalmente.
  v_result:=public.rpc_registrar_recebimento(v_empresa,v_admin,'2026-08',4.17,
    jsonb_build_array(jsonb_build_object('previsao_franquia_id',v_franquia_1,'valor_liquidado','4.17')),
    'teste-recebimento-001','2026-08-11','pix','REC-1',NULL);
  v_recebimento_1:=(v_result->'recebimento'->>'id')::uuid;
  PERFORM public.rpc_registrar_recebimento(v_empresa,v_admin,'2026-08',4.17,
    jsonb_build_array(jsonb_build_object('previsao_franquia_id',v_franquia_1,'valor_liquidado','4.17')),
    'teste-recebimento-001','2026-08-11','pix','REC-1',NULL);
  SELECT valor_elegivel INTO v_valor FROM public.comissao_previsoes_participantes WHERE id=v_participante_1;
  IF v_valor<>1.67 THEN RAISE EXCEPTION 'Elegibilidade proporcional inválida: %',v_valor;END IF;
  IF (SELECT count(*) FROM public.financeiro_recebimentos WHERE id=v_recebimento_1)<>1
    THEN RAISE EXCEPTION 'Recebimento idempotente duplicado';END IF;

  BEGIN
    PERFORM public.rpc_registrar_pagamento(v_empresa,'2026-08',1.68,
      jsonb_build_array(jsonb_build_object('previsao_participante_id',v_participante_1,'valor_liquidado','1.68')),
      'teste-pagamento-acima-001','2026-08-11','pix',NULL,NULL);
    RAISE EXCEPTION 'Pagamento acima do elegível foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Pagamento acima do elegível foi aceito' THEN RAISE;END IF;
  END;

  v_result:=public.rpc_registrar_pagamento(v_empresa,'2026-08',1.67,
    jsonb_build_array(jsonb_build_object('previsao_participante_id',v_participante_1,'valor_liquidado','1.67')),
    'teste-pagamento-001','2026-08-11','pix','PAG-1',NULL);
  v_pagamento_1:=(v_result->'pagamento'->>'id')::uuid;

  PERFORM public.rpc_gerar_compensacao(v_empresa,'Compensação manual de teste',5.00,
    'teste-compensacao-001',v_participante,NULL,v_venda,NULL);
  v_result:=public.rpc_registrar_recebimento(v_empresa,v_admin,'2026-08',4.16,
    jsonb_build_array(jsonb_build_object('previsao_franquia_id',v_franquia_1,'valor_liquidado','4.16')),
    'teste-recebimento-002','2026-08-11','pix','REC-2',NULL);
  v_recebimento_2:=(v_result->'recebimento'->>'id')::uuid;
  v_result:=public.rpc_registrar_pagamento(v_empresa,'2026-08',1.66,
    jsonb_build_array(jsonb_build_object('previsao_participante_id',v_participante_1,'valor_liquidado','1.66')),
    'teste-pagamento-002','2026-08-11','pix','PAG-2',NULL);
  v_pagamento_2:=(v_result->'pagamento'->>'id')::uuid;
  IF (v_result->'pagamento'->>'valor_liquido')::numeric<>0 OR
     (v_result->'pagamento'->>'valor_compensado')::numeric<>1.66
    THEN RAISE EXCEPTION 'Compensação não produziu pagamento líquido zero';END IF;
  IF EXISTS(SELECT 1 FROM public.caixa_movimentos WHERE origem_tipo='pagamento_participante' AND origem_id=v_pagamento_2)
    THEN RAISE EXCEPTION 'Pagamento líquido zero gerou saída de caixa';END IF;

  -- Estornar recebimento cria crédito compensatório pelo sobrepagamento; estornar
  -- o pagamento correspondente neutraliza esse crédito por evento append-only.
  v_result:=public.rpc_estornar_recebimento(v_empresa,v_recebimento_2,'Erro bancário','teste-estorno-rec-002');
  v_estorno_recebimento:=(v_result->'estorno'->>'id')::uuid;
  SELECT COALESCE(sum(valor_credito_efetivo),0) INTO v_valor
  FROM public.financeiro_compensacoes_saldos WHERE previsao_participante_id=v_participante_1;
  IF v_valor<>1.66 THEN RAISE EXCEPTION 'Compensação futura de sobrepagamento inválida: %',v_valor;END IF;
  PERFORM public.rpc_estornar_pagamento(v_empresa,v_pagamento_2,'Pagamento revertido','teste-estorno-pag-002');
  SELECT COALESCE(sum(valor_credito_efetivo),0) INTO v_valor
  FROM public.financeiro_compensacoes_saldos WHERE previsao_participante_id=v_participante_1;
  IF v_valor<>0 THEN RAISE EXCEPTION 'Estorno do pagamento não neutralizou compensação futura: %',v_valor;END IF;
  IF NOT EXISTS(SELECT 1 FROM public.financeiro_compensacao_movimentos WHERE pagamento_id=v_pagamento_2 AND tipo='cancelamento')
    THEN RAISE EXCEPTION 'Evento inverso de cancelamento da compensação ausente';END IF;

  -- Cancelamento após pagamento preserva passado e gera compensação futura.
  PERFORM public.rpc_cancelar_venda_comissoes(v_empresa,v_venda,'Distrato','teste-cancelamento-venda-001');
  SELECT COALESCE(sum(valor_credito_efetivo),0) INTO v_valor
  FROM public.financeiro_compensacoes_saldos WHERE previsao_participante_id=v_participante_1;
  IF v_valor<>1.67 THEN RAISE EXCEPTION 'Cancelamento não gerou compensação do valor pago: %',v_valor;END IF;

  -- Cross-tenant deve falhar mesmo com UUID de previsão válido.
  BEGIN
    PERFORM public.rpc_registrar_recebimento(v_empresa_b,v_admin,'2026-08',1.00,
      jsonb_build_array(jsonb_build_object('previsao_franquia_id',v_franquia_1,'valor_liquidado','1.00')),
      'teste-cross-tenant-001','2026-08-11','pix',NULL,NULL);
    RAISE EXCEPTION 'Recebimento cross-tenant foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Recebimento cross-tenant foi aceito' THEN RAISE;END IF;
  END;

  -- Históricos financeiros não aceitam update/delete direto.
  BEGIN
    UPDATE public.financeiro_recebimentos SET observacoes='mutação proibida' WHERE id=v_recebimento_1;
    RAISE EXCEPTION 'Histórico financeiro foi mutado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Histórico financeiro foi mutado' THEN RAISE;END IF;
  END;

  -- Duas regras com a mesma precedência devem falhar, sem escolher silenciosamente.
  INSERT INTO public.comissao_regras_franquia(
    empresa_id,programa_id,versao,base_calculo,valor_fixo_total,modalidade,
    vigencia_inicio,ativa,etapas_cronograma,configuracao_homologada,origem_configuracao
  ) VALUES (
    v_empresa,v_programa,2,'valor_fixo',25.01,'Auto','2026-01-01',true,
    '[{"ordem":1,"mes_relativo":1,"valor_etapa":8.33,"nome":"Etapa 1"},{"ordem":2,"mes_relativo":2,"valor_etapa":8.33,"nome":"Etapa 2"},{"ordem":3,"mes_relativo":3,"valor_etapa":8.35,"nome":"Etapa 3"}]',
    true,'TESTE_ISOLADO'
  );
  INSERT INTO public.vendas(id,empresa_id,cliente_nome,administradora_id,grupo_id,valor_credito,prazo,parcela,status,data_venda)
  VALUES(v_venda_ambigua,v_empresa,'Fixture Ambiguidade',v_admin,v_grupo_auto,1000.01,60,20,'confirmada','2026-08-11');
  INSERT INTO public.cotas_definitivas(id,empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,valor_credito,prazo,parcela,status)
  VALUES(v_cota_ambigua,v_empresa,v_venda_ambigua,v_admin,v_grupo_auto,'TESTE-AMB',1000.01,60,20,'ativa');
  BEGIN
    PERFORM public.rpc_gerar_previsoes_comissao(v_empresa,v_venda_ambigua,'teste-ambiguidade-001');
    RAISE EXCEPTION 'Ambiguidade de regra foi aceita';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='Ambiguidade de regra foi aceita' THEN RAISE;END IF;
  END;
END
$test$;

ROLLBACK;
