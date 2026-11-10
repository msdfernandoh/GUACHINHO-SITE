-- A primeira comissão é competência do repasse efetivamente recebido, não do
-- vencimento original do primeiro boleto. A segunda permanece em 12/2026.
-- As cotas abaixo já tiveram a primeira parcela quitada, portanto a carteira
-- de boletos deve recomeçar somente na competência da segunda parcela.
DO $$
DECLARE
  v_daiana uuid := 'b20e0f00-6892-4056-8e90-141592c2368c';
  v_luiz_1 uuid := '852d4a05-e8a7-4bf3-a562-9eeab2cd3175';
  v_luiz_2 uuid := 'f5142e46-45f6-4544-b306-f991a758635c';
  v_total integer;
BEGIN
  SELECT count(*) INTO v_total
  FROM vendas
  WHERE id IN (v_daiana, v_luiz_1, v_luiz_2);

  IF v_total <> 3 THEN
    RAISE EXCEPTION 'Esperadas 3 vendas de Daiana/Luiz; encontradas %', v_total;
  END IF;

  UPDATE vendas v
  SET snapshot_venda = COALESCE(v.snapshot_venda, '{}'::jsonb) || jsonb_build_object(
        'primeira_parcela_ja_paga', true,
        'competencia_primeiro_repasse', CASE
          WHEN v.id = v_daiana THEN '2026-09'
          ELSE '2026-10'
        END,
        'competencia_inicial_boletos', '2026-12',
        'correcao_competencia_repasse', '20261110173000'
      ),
      updated_at = clock_timestamp()
  WHERE v.id IN (v_daiana, v_luiz_1, v_luiz_2);

  -- Primeira comissão: competência em que o repasse canônico foi recebido.
  UPDATE comissao_previsoes_franquia f
  SET competencia = CASE
        WHEN f.venda_id = v_daiana THEN '2026-09'
        ELSE '2026-10'
      END,
      snapshot_regra = COALESCE(f.snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'competencia_por_repasse', true,
        'correcao_competencia_repasse', '20261110173000'
      ),
      updated_at = clock_timestamp()
  WHERE f.venda_id IN (v_daiana, v_luiz_1, v_luiz_2)
    AND f.ordem_etapa = 1;

  -- Participantes vinculados seguem a competência da previsão de franquia.
  UPDATE comissao_previsoes_participantes p
  SET competencia = f.competencia,
      snapshot_regra = COALESCE(p.snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'competencia_por_repasse', true,
        'correcao_competencia_repasse', '20261110173000'
      ),
      updated_at = clock_timestamp()
  FROM comissao_previsoes_franquia f
  WHERE p.previsao_franquia_id = f.id
    AND p.ordem_etapa = 1
    AND f.venda_id IN (v_daiana, v_luiz_1, v_luiz_2);

  -- Mantém explícita a segunda comissão em dezembro, sem alterar valores ou status.
  UPDATE comissao_previsoes_franquia f
  SET competencia = '2026-12',
      updated_at = clock_timestamp()
  WHERE f.venda_id IN (v_daiana, v_luiz_1, v_luiz_2)
    AND f.ordem_etapa = 2;

  UPDATE comissao_previsoes_participantes p
  SET competencia = '2026-12',
      updated_at = clock_timestamp()
  WHERE p.venda_id IN (v_daiana, v_luiz_1, v_luiz_2)
    AND p.ordem_etapa = 2;
END $$;
