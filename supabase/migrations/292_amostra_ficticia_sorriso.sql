-- Amostra isolada para a master Sorriso. IDs estáveis tornam a operação repetível.
-- Todos os nomes e descrições indicam demonstração; nenhum contato real é criado.
BEGIN;

DO $amostra$
DECLARE
  v_empresa uuid;
  v_administradora uuid;
  v_grupo uuid;
  v_cliente uuid;
  v_lead uuid;
  v_proposta uuid;
  v_venda uuid := md5('sorriso-amostra-venda-1')::uuid;
  v_conta uuid;
  v_indice integer;
  v_nomes text[] := ARRAY[
    '[DEMO] Ana Exemplo', '[DEMO] Bruno Exemplo', '[DEMO] Carla Exemplo',
    '[DEMO] Diego Exemplo', '[DEMO] Elisa Exemplo'
  ];
  v_creditos numeric[] := ARRAY[80000, 120000, 95000, 150000, 110000];
  v_despesas text[] := ARRAY[
    '[DEMO] Aluguel da unidade fictícia',
    '[DEMO] Internet da unidade fictícia',
    '[DEMO] Material de escritório fictício'
  ];
  v_valores numeric[] := ARRAY[1200, 180, 95];
BEGIN
  SELECT id INTO v_empresa FROM public.empresas WHERE slug = 'sorriso';
  IF v_empresa IS NULL THEN RETURN; END IF;

  SELECT ea.administradora_id INTO v_administradora
  FROM public.empresa_administradoras ea
  WHERE ea.empresa_id = v_empresa AND ea.status = 'ATIVA'
  ORDER BY ea.created_at LIMIT 1;

  FOR v_indice IN 1..5 LOOP
    v_cliente := md5('sorriso-amostra-cliente-' || v_indice)::uuid;
    v_lead := md5('sorriso-amostra-lead-' || v_indice)::uuid;
    INSERT INTO public.clientes(id, empresa_id, tipo_pessoa, nome, origem, observacoes)
    VALUES(v_cliente, v_empresa, 'PF', v_nomes[v_indice], 'manual',
           'REGISTRO FICTÍCIO DE DEMONSTRAÇÃO. Não representa pessoa ou negociação real.')
    ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.leads(id, empresa_id, nome, origem, origem_detalhe,
                             tipo_interesse, valor_credito, status, criado_manual, observacoes)
    VALUES(v_lead, v_empresa, v_nomes[v_indice], 'demonstracao',
           'Amostra fictícia da Racon Sorriso', 'consorcio', v_creditos[v_indice],
           'Novo', true, 'REGISTRO FICTÍCIO DE DEMONSTRAÇÃO.')
    ON CONFLICT (id) DO NOTHING;
    IF v_indice <= 3 THEN
      v_proposta := md5('sorriso-amostra-proposta-' || v_indice)::uuid;
      INSERT INTO public.propostas(id, empresa_id, cliente_id, lead_id, nome_cliente,
                                   tipo_proposta, tipo_bem, valor_credito, prazo,
                                   valor_parcela, status, observacoes)
      VALUES(v_proposta, v_empresa, v_cliente, v_lead, v_nomes[v_indice],
             'Consórcio demonstrativo', 'Veículo', v_creditos[v_indice], 80,
             round(v_creditos[v_indice] / 80, 2), 'Gerada',
             'REGISTRO FICTÍCIO DE DEMONSTRAÇÃO. Não enviar nem contratar.')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END LOOP;

  -- A baixa usa a rotina transacional, que também registra a saída no caixa.
  FOR v_indice IN 1..3 LOOP
    v_conta := md5('sorriso-amostra-conta-pagar-' || v_indice)::uuid;
    INSERT INTO public.financeiro_contas_pagar(
      id, empresa_id, descricao, fornecedor, vencimento, competencia, valor,
      status, observacao, importacao_origem, importacao_chave)
    VALUES(v_conta, v_empresa, v_despesas[v_indice], '[DEMO] Fornecedor fictício',
           DATE '2026-09-15' + v_indice, '2026-09', v_valores[v_indice],
           'aberta', 'REGISTRO FICTÍCIO DE DEMONSTRAÇÃO. Pagamento simulado.',
           'AMOSTRA_SORRISO', 'amostra-sorriso-' || v_indice)
    ON CONFLICT (id) DO NOTHING;
    PERFORM public.rpc_baixar_conta_pagar(v_empresa, v_conta, DATE '2026-09-18' + v_indice);
  END LOOP;

  -- Uma previsão de comissão acompanha uma venda fictícia e fica fora do faturamento.
  IF v_administradora IS NOT NULL THEN
    SELECT id INTO v_grupo FROM public.grupos_consorcio
    WHERE administradora_id = v_administradora AND ativo = true
    ORDER BY codigo_grupo LIMIT 1;
    IF v_grupo IS NOT NULL THEN
      INSERT INTO public.vendas(
        id, empresa_id, cliente_id, proposta_id, cliente_nome,
        administradora_id, grupo_id, valor_credito, prazo, parcela,
        status, origem_registro, afeta_faturamento, snapshot_venda)
      VALUES(v_venda, v_empresa, md5('sorriso-amostra-cliente-1')::uuid,
             md5('sorriso-amostra-proposta-1')::uuid, v_nomes[1],
             v_administradora, v_grupo, 80000, 80, 1000,
             'confirmada', 'OPERACIONAL', false,
             '{"demonstracao":true,"descricao":"Venda fictícia, fora do faturamento"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
      INSERT INTO public.comissao_previsoes_franquia(
        id, empresa_id, venda_id, administradora_id, ordem_etapa, nome_etapa,
        competencia, base_calculo_valor, percentual_aplicado, valor_previsto,
        status, snapshot_regra, tipo_gatilho)
      VALUES(md5('sorriso-amostra-comissao-1')::uuid, v_empresa, v_venda,
             v_administradora, 1, '[DEMO] Comissão prevista fictícia',
             '2026-10', 80000, 1.5, 1200, 'prevista',
             '{"demonstracao":true,"observacao":"Previsão fictícia; sem repasse real"}'::jsonb,
             'MES_RELATIVO')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
END $amostra$;

COMMIT;
