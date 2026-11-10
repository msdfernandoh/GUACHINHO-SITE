-- Corrige um cronograma formalizado com a data da venda no lugar do vencimento.
-- Regra operacional confirmada: a 1a parcela vence em novembro/2026 e a 2a em
-- dezembro/2026. Pagamento antecipado nao pode antecipar a competencia da comissao.
--
-- Escopo propositalmente restrito as tres vendas abaixo (5 cotas de Luiz Carlos
-- Fregonese Filho e 14 cotas de Daiana Caruline Tasso). Valores, status e datas de
-- liquidacao existentes sao preservados; somente a competencia e o cronograma sao
-- alinhados ao vencimento contratual.

DO $$
DECLARE
  v_vendas uuid[] := ARRAY[
    '852d4a05-e8a7-4bf3-a562-9eeab2cd3175'::uuid,
    'f5142e46-45f6-4544-b306-f991a758635c'::uuid,
    'b20e0f00-6892-4056-8e90-141592c2368c'::uuid
  ];
  v_primeira_parcela date := date '2026-11-10';
  v_segunda_parcela date := date '2026-12-10';
  v_vendas_encontradas integer;
  v_cotas_encontradas integer;
BEGIN
  SELECT count(*)
    INTO v_vendas_encontradas
  FROM public.vendas v
  WHERE v.id = ANY (v_vendas)
    AND v.status = 'confirmada';

  IF v_vendas_encontradas <> 3 THEN
    RAISE EXCEPTION
      'Correcao de cronograma cancelada: esperadas 3 vendas confirmadas, encontradas %',
      v_vendas_encontradas;
  END IF;

  SELECT count(*)
    INTO v_cotas_encontradas
  FROM public.cotas_definitivas c
  WHERE c.venda_id = ANY (v_vendas)
    AND c.status = 'ativa';

  IF v_cotas_encontradas <> 19 THEN
    RAISE EXCEPTION
      'Correcao de cronograma cancelada: esperadas 19 cotas ativas, encontradas %',
      v_cotas_encontradas;
  END IF;

  UPDATE public.vendas v
  SET
    data_primeira_parcela = v_primeira_parcela,
    data_segunda_parcela = v_segunda_parcela,
    snapshot_venda = jsonb_set(
      jsonb_set(
        COALESCE(v.snapshot_venda, '{}'::jsonb)
          || jsonb_build_object(
            'data_primeira_parcela', to_char(v_primeira_parcela, 'YYYY-MM-DD'),
            'data_segunda_parcela', to_char(v_segunda_parcela, 'YYYY-MM-DD'),
            'correcao_cronograma_comissao', '20261110160000',
            'motivo_correcao_cronograma',
              'Vencimento contratual: primeira parcela em novembro e segunda em dezembro; pagamento antecipado nao altera a competencia.'
          ),
        '{dados_simulacao,data_primeira_parcela}',
        to_jsonb(to_char(v_primeira_parcela, 'YYYY-MM-DD')),
        true
      ),
      '{dados_simulacao,data_segunda_parcela}',
      to_jsonb(to_char(v_segunda_parcela, 'YYYY-MM-DD')),
      true
    ),
    updated_at = clock_timestamp()
  WHERE v.id = ANY (v_vendas);

  UPDATE public.cotas_definitivas c
  SET
    snapshot_cota = COALESCE(c.snapshot_cota, '{}'::jsonb)
      || jsonb_build_object(
        'data_primeira_parcela', to_char(v_primeira_parcela, 'YYYY-MM-DD'),
        'data_segunda_parcela', to_char(v_segunda_parcela, 'YYYY-MM-DD'),
        'correcao_cronograma_comissao', '20261110160000'
      ),
    updated_at = clock_timestamp()
  WHERE c.venda_id = ANY (v_vendas)
    AND c.status = 'ativa';

  -- Inclui inclusive a primeira previsao ja liquidada: ela deve ser exibida na
  -- competencia de novembro, mesmo que tenha sido paga antecipadamente em outubro.
  UPDATE public.comissao_previsoes_franquia f
  SET
    competencia = CASE
      WHEN f.ordem_etapa = 1 THEN to_char(v_primeira_parcela, 'YYYY-MM')
      ELSE to_char(v_segunda_parcela + make_interval(months => f.ordem_etapa - 2), 'YYYY-MM')
    END,
    snapshot_regra = COALESCE(f.snapshot_regra, '{}'::jsonb)
      || jsonb_build_object(
        'correcao_cronograma_comissao', '20261110160000',
        'competencia_por_vencimento', true
      ),
    updated_at = clock_timestamp()
  WHERE f.venda_id = ANY (v_vendas);

  UPDATE public.comissao_previsoes_participantes p
  SET
    competencia = CASE
      WHEN p.ordem_etapa = 1 THEN to_char(v_primeira_parcela, 'YYYY-MM')
      ELSE to_char(v_segunda_parcela + make_interval(months => p.ordem_etapa - 2), 'YYYY-MM')
    END,
    snapshot_regra = COALESCE(p.snapshot_regra, '{}'::jsonb)
      || jsonb_build_object(
        'correcao_cronograma_comissao', '20261110160000',
        'competencia_por_vencimento', true
      ),
    updated_at = clock_timestamp()
  WHERE p.venda_id = ANY (v_vendas);

  RAISE NOTICE
    'Cronograma corrigido para 3 vendas e 19 cotas: 1a parcela %, 2a parcela %',
    v_primeira_parcela,
    v_segunda_parcela;
END $$;
