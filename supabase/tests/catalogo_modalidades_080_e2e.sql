-- E2E decisivo da migration 080. Exclusivo para branch Supabase isolada.
-- Todos os dados abaixo são sintéticos e determinísticos.

BEGIN;

-- Homologa somente as regras sintéticas Racon/Automóveis criadas pelo replay 076.
UPDATE public.comissao_programas p
SET status = 'ATIVO', ativo = true, updated_at = now()
WHERE p.empresa_id = (SELECT id FROM public.empresas WHERE slug = 'gauchinho')
  AND p.administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  AND EXISTS (
    SELECT 1 FROM public.comissao_regras_franquia r
    JOIN public.administradora_tipos t ON t.id = r.tipo_administradora_id
    WHERE r.programa_id = p.id AND t.codigo = 'AUTOMOVEIS'
  );

UPDATE public.comissao_regras_franquia r
SET configuracao_homologada = true, ativa = true, updated_at = now()
WHERE r.empresa_id = (SELECT id FROM public.empresas WHERE slug = 'gauchinho')
  AND r.tipo_administradora_id = (
    SELECT id FROM public.administradora_tipos
    WHERE administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
      AND codigo = 'AUTOMOVEIS'
  );

-- Grupo 5488: o singular legado fica propositalmente em INTEGRAL.
UPDATE public.grupos_consorcio
SET tipo_administradora_id = (
      SELECT id FROM public.administradora_tipos
      WHERE administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
        AND codigo = 'AUTOMOVEIS'
    ),
    modalidade_comissao_id = (
      SELECT id FROM public.administradora_modalidades_comissao
      WHERE administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
        AND codigo = 'INTEGRAL'
    )
WHERE id = md5('catalogo-080-grupo-008')::uuid
  AND codigo_grupo = '5488';

INSERT INTO public.grupos_modalidades_disponiveis (
  grupo_id, administradora_modalidade_id, ativo, ordem, configuracao
)
SELECT
  md5('catalogo-080-grupo-008')::uuid,
  m.id,
  true,
  CASE m.codigo WHEN 'INTEGRAL' THEN 1 WHEN 'REDUZIDA_60_99' THEN 2 ELSE 3 END,
  jsonb_build_object('origem', 'E2E_080_SINTETICO', 'oficial', true)
FROM public.administradora_modalidades_comissao m
WHERE m.administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  AND m.codigo IN ('INTEGRAL', 'REDUZIDA_60_99', 'REDUZIDA_ABAIXO_59')
ON CONFLICT (grupo_id, administradora_modalidade_id) DO UPDATE
SET ativo = true, ordem = EXCLUDED.ordem, configuracao = EXCLUDED.configuracao;

INSERT INTO public.grupos_cotas (
  id, grupo_id, valor_credito, valor_parcela, parcela_integral,
  parcela_com_seguro, parcela_sem_seguro, status, ativo, ordem
) VALUES (
  md5('catalogo-080-e2e-produto-100000')::uuid,
  md5('catalogo-080-grupo-008')::uuid,
  100000, 2500, 2500, 2600, 2500, 'Disponível', true, 100
)
ON CONFLICT (id) DO UPDATE SET
  valor_credito = EXCLUDED.valor_credito,
  parcela_com_seguro = EXCLUDED.parcela_com_seguro,
  parcela_sem_seguro = EXCLUDED.parcela_sem_seguro,
  status = EXCLUDED.status,
  ativo = true;

INSERT INTO public.grupo_cota_modalidade_valores (
  grupo_cota_id, administradora_modalidade_id, valor_parcela,
  percentual_reducao, configuracao, ativo
)
SELECT
  md5('catalogo-080-e2e-produto-100000')::uuid,
  m.id,
  CASE m.codigo
    WHEN 'INTEGRAL' THEN 2500.00
    WHEN 'REDUZIDA_60_99' THEN 1750.00
    ELSE 1250.00
  END,
  CASE m.codigo WHEN 'INTEGRAL' THEN NULL WHEN 'REDUZIDA_60_99' THEN 70 ELSE 50 END,
  jsonb_build_object('origem', 'E2E_080_SINTETICO', 'valor_oficial', true),
  true
FROM public.administradora_modalidades_comissao m
WHERE m.administradora_id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  AND m.codigo IN ('INTEGRAL', 'REDUZIDA_60_99', 'REDUZIDA_ABAIXO_59')
ON CONFLICT (grupo_cota_id, administradora_modalidade_id) DO UPDATE
SET valor_parcela = EXCLUDED.valor_parcela,
    percentual_reducao = EXCLUDED.percentual_reducao,
    configuracao = EXCLUDED.configuracao,
    ativo = true;

-- Produto não utilizado para provar edição persistente em consulta posterior.
INSERT INTO public.grupos_cotas (id, grupo_id, valor_credito, status, ativo, ordem)
VALUES (
  md5('catalogo-080-e2e-produto-nao-utilizado')::uuid,
  md5('catalogo-080-grupo-008')::uuid,
  123456, 'Disponível', true, 101
)
ON CONFLICT (id) DO NOTHING;
UPDATE public.grupos_cotas
SET valor_credito = 123457, updated_at = now()
WHERE id = md5('catalogo-080-e2e-produto-nao-utilizado')::uuid;

-- Fato legado sintético: simula uma venda anterior à 080 e fica fora do trigger novo.
SET LOCAL session_replication_role = replica;
INSERT INTO public.vendas (
  id, empresa_id, cliente_nome, administradora_id, grupo_id,
  valor_credito, prazo, parcela, snapshot_venda, data_venda
) VALUES (
  md5('catalogo-080-venda-legada')::uuid,
  (SELECT id FROM public.empresas WHERE slug = 'gauchinho'),
  'Cliente Sintético Legado',
  'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
  md5('catalogo-080-grupo-001')::uuid,
  75000, 100, 999.99,
  '{"origem":"LEGADO_SINTETICO_PRE_080"}'::jsonb,
  '2026-08-01T12:00:00Z'
)
ON CONFLICT (id) DO NOTHING;
SET LOCAL session_replication_role = origin;

-- Negativos: a venda nova nunca pode inferir a modalidade singular do Grupo.
DO $$
DECLARE v_empresa uuid := (SELECT id FROM public.empresas WHERE slug = 'gauchinho');
BEGIN
  BEGIN
    INSERT INTO public.vendas (
      empresa_id, cliente_nome, administradora_id, grupo_id, opcao_cota_id,
      valor_credito, prazo, parcela
    ) VALUES (
      v_empresa, 'Cliente Sintético Sem Modalidade',
      'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
      md5('catalogo-080-grupo-008')::uuid,
      md5('catalogo-080-e2e-produto-100000')::uuid,
      100000, 100, 1
    );
    RAISE EXCEPTION 'FALHA_TESTE: venda sem modalidade foi aceita';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('nao pode ser inferida do Grupo' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
  END;
END $$;

-- Produto sem valor oficial para a modalidade escolhida deve bloquear.
DO $$
DECLARE v_empresa uuid := (SELECT id FROM public.empresas WHERE slug = 'gauchinho');
        v_modalidade uuid := (SELECT id FROM public.administradora_modalidades_comissao WHERE codigo='INTEGRAL' AND administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid);
BEGIN
  BEGIN
    INSERT INTO public.vendas (
      empresa_id, cliente_nome, administradora_id, grupo_id, opcao_cota_id,
      modalidade_comissao_id, valor_credito, prazo, parcela
    ) VALUES (
      v_empresa, 'Cliente Sintético Sem Valor',
      'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
      md5('catalogo-080-grupo-008')::uuid,
      md5('catalogo-080-e2e-produto-nao-utilizado')::uuid,
      v_modalidade, 123457, 100, 1
    );
    RAISE EXCEPTION 'FALHA_TESTE: produto sem valor foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('CONFIGURACAO PENDENTE' IN SQLERRM) = 0 THEN
      RAISE;
    END IF;
  END;
END $$;

-- Grupo sem modalidade disponível deve bloquear antes de qualquer fallback.
UPDATE public.grupos_consorcio
SET tipo_administradora_id = (
  SELECT id FROM public.administradora_tipos
  WHERE administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid AND codigo='AUTOMOVEIS'
)
WHERE id=md5('catalogo-080-grupo-009')::uuid;
DO $$
DECLARE v_empresa uuid := (SELECT id FROM public.empresas WHERE slug = 'gauchinho');
        v_modalidade uuid := (SELECT id FROM public.administradora_modalidades_comissao WHERE codigo='INTEGRAL' AND administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid);
        v_produto uuid := (SELECT id FROM public.grupos_cotas WHERE grupo_id=md5('catalogo-080-grupo-009')::uuid ORDER BY ordem LIMIT 1);
BEGIN
  BEGIN
    INSERT INTO public.vendas (empresa_id,cliente_nome,administradora_id,grupo_id,opcao_cota_id,modalidade_comissao_id,valor_credito,prazo,parcela)
    VALUES(v_empresa,'Cliente Sintético Grupo Sem Modalidade','c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,md5('catalogo-080-grupo-009')::uuid,v_produto,v_modalidade,100000,100,1);
    RAISE EXCEPTION 'FALHA_TESTE: grupo sem modalidade foi aceito';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('indisponiveis para Grupo' IN SQLERRM) = 0 THEN RAISE; END IF;
  END;
END $$;

-- As três vendas decisivas: mesmo Grupo, mesmo Produto, modalidades diferentes.
INSERT INTO public.vendas (id,empresa_id,cliente_nome,administradora_id,grupo_id,opcao_cota_id,modalidade_comissao_id,valor_credito,prazo,parcela,data_venda)
SELECT
  md5('catalogo-080-venda-'||m.codigo)::uuid,
  (SELECT id FROM public.empresas WHERE slug='gauchinho'),
  'Cliente Sintético '||m.codigo,
  'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,
  md5('catalogo-080-grupo-008')::uuid,
  md5('catalogo-080-e2e-produto-100000')::uuid,
  m.id,100000,100,1,'2026-08-17T12:00:00Z'
FROM public.administradora_modalidades_comissao m
WHERE m.administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  AND m.codigo IN('INTEGRAL','REDUZIDA_60_99','REDUZIDA_ABAIXO_59');

INSERT INTO public.cotas_definitivas (id,empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,numero_cota,valor_credito,prazo,parcela,snapshot_cota)
SELECT md5('catalogo-080-cota-'||m.codigo)::uuid,v.empresa_id,v.id,v.administradora_id,v.grupo_id,'5488','E2E-'||m.codigo,v.valor_credito,v.prazo,v.parcela,v.snapshot_venda
FROM public.administradora_modalidades_comissao m
JOIN public.vendas v ON v.id=md5('catalogo-080-venda-'||m.codigo)::uuid
WHERE m.administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
  AND m.codigo IN('INTEGRAL','REDUZIDA_60_99','REDUZIDA_ABAIXO_59');

SELECT public.rpc_gerar_previsoes_comissao(
  (SELECT id FROM public.empresas WHERE slug='gauchinho'),
  md5('catalogo-080-venda-INTEGRAL')::uuid,
  'e2e-080-integral'
);
SELECT public.rpc_gerar_previsoes_comissao(
  (SELECT id FROM public.empresas WHERE slug='gauchinho'),
  md5('catalogo-080-venda-REDUZIDA_60_99')::uuid,
  'e2e-080-reduzida-60-99'
);
SELECT public.rpc_gerar_previsoes_comissao(
  (SELECT id FROM public.empresas WHERE slug='gauchinho'),
  md5('catalogo-080-venda-REDUZIDA_ABAIXO_59')::uuid,
  'e2e-080-reduzida-abaixo-59'
);

SELECT public.rpc_marcar_cota_contemplada(
  (SELECT id FROM public.empresas WHERE slug='gauchinho'),
  md5('catalogo-080-cota-REDUZIDA_ABAIXO_59')::uuid,
  DATE '2026-08-17','SORTEIO',100000,
  'Contemplação sintética E2E 080','e2e-080-contemplacao'
);

-- Regra sem homologação: o motor canônico bloqueia e o sub-bloco desfaz a venda de teste.
DO $$
DECLARE v_empresa uuid := (SELECT id FROM public.empresas WHERE slug='gauchinho');
        v_regra uuid := (SELECT r.id FROM public.comissao_regras_franquia r JOIN public.administradora_modalidades_comissao m ON m.id=r.modalidade_comissao_id JOIN public.administradora_tipos t ON t.id=r.tipo_administradora_id WHERE t.codigo='IMOVEL' AND m.codigo='INTEGRAL' LIMIT 1);
BEGIN
  BEGIN
    UPDATE public.comissao_regras_franquia SET configuracao_homologada=false WHERE id=v_regra;
    UPDATE public.grupos_consorcio SET tipo_administradora_id=(SELECT id FROM public.administradora_tipos WHERE codigo='IMOVEL' AND administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid) WHERE id=md5('catalogo-080-grupo-008')::uuid;
    INSERT INTO public.vendas (id,empresa_id,cliente_nome,administradora_id,grupo_id,opcao_cota_id,modalidade_comissao_id,valor_credito,prazo,parcela)
    SELECT md5('catalogo-080-venda-regra-pendente')::uuid,v_empresa,'Cliente Sintético Regra Pendente','c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,md5('catalogo-080-grupo-008')::uuid,md5('catalogo-080-e2e-produto-100000')::uuid,m.id,100000,100,1 FROM public.administradora_modalidades_comissao m WHERE m.codigo='INTEGRAL' AND m.administradora_id='c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid;
    INSERT INTO public.cotas_definitivas(id,empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,valor_credito,prazo,parcela)
    VALUES(md5('catalogo-080-cota-regra-pendente')::uuid,v_empresa,md5('catalogo-080-venda-regra-pendente')::uuid,'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid,md5('catalogo-080-grupo-008')::uuid,'5488',100000,100,2500);
    PERFORM public.rpc_gerar_previsoes_comissao(v_empresa,md5('catalogo-080-venda-regra-pendente')::uuid,'e2e-080-regra-pendente');
    RAISE EXCEPTION 'FALHA_TESTE: regra não homologada foi aceita';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('Nenhuma regra V2 homologada' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

-- Produto utilizado não pode ser apagado fisicamente.
DO $$
BEGIN
  BEGIN
    DELETE FROM public.grupos_cotas WHERE id=md5('catalogo-080-e2e-produto-100000')::uuid;
    RAISE EXCEPTION 'FALHA_TESTE: produto utilizado foi excluído';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('nao pode ser excluido' IN SQLERRM)=0 THEN RAISE; END IF;
  END;
END $$;

-- Asserções finais dos snapshots, parcelas, regras e compatibilidade histórica.
DO $$
DECLARE v_count int; v_distinct_parcelas int; v_distinct_regras int;
BEGIN
  SELECT count(*),count(DISTINCT v.valor_parcela_modalidade),count(DISTINCT f.regra_franquia_id)
  INTO v_count,v_distinct_parcelas,v_distinct_regras
  FROM public.vendas v
  JOIN public.comissao_previsoes_franquia f ON f.venda_id=v.id
  WHERE v.id IN(md5('catalogo-080-venda-INTEGRAL')::uuid,md5('catalogo-080-venda-REDUZIDA_60_99')::uuid,md5('catalogo-080-venda-REDUZIDA_ABAIXO_59')::uuid);
  IF v_count=0 OR v_distinct_parcelas<>3 OR v_distinct_regras<>3 THEN
    RAISE EXCEPTION 'E2E 080 não congelou três parcelas/regras independentes';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id=md5('catalogo-080-venda-REDUZIDA_ABAIXO_59')::uuid AND tipo_gatilho='CONTEMPLACAO') THEN
    RAISE EXCEPTION 'E2E 080 não gerou a etapa CONTEMPLACAO';
  END IF;
  IF EXISTS(SELECT 1 FROM public.vendas WHERE id=md5('catalogo-080-venda-legada')::uuid AND (modalidade_comissao_id IS NOT NULL OR valor_parcela_modalidade IS NOT NULL OR parcela<>999.99 OR snapshot_venda<>'{"origem":"LEGADO_SINTETICO_PRE_080"}'::jsonb)) THEN
    RAISE EXCEPTION 'Venda histórica sintética foi alterada';
  END IF;
  IF EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id=md5('catalogo-080-venda-legada')::uuid) THEN
    RAISE EXCEPTION 'Venda histórica sintética foi recalculada';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='grupos_cotas' AND column_name='parcela_com_seguro')
     OR EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name IN('grupos_modalidades_disponiveis','grupo_cota_modalidade_valores') AND column_name LIKE '%seguro%') THEN
    RAISE EXCEPTION 'Seguro deixou de ser dimensão separada';
  END IF;
END $$;

COMMIT;

-- Evidência tabular para o relatório.
SELECT
  m.codigo AS modalidade,
  v.valor_parcela_modalidade AS parcela_congelada,
  v.snapshot_venda->>'modalidade_comissao_codigo' AS snapshot_modalidade,
  t.nome AS tipo,
  p.nome AS programa,
  r.id AS regra_id,
  bool_or(f.tipo_gatilho='CONTEMPLACAO') AS possui_previsao_contemplacao,
  count(f.id) AS previsoes
FROM public.vendas v
JOIN public.administradora_modalidades_comissao m ON m.id=v.modalidade_comissao_id
JOIN public.comissao_previsoes_franquia f ON f.venda_id=v.id
JOIN public.comissao_regras_franquia r ON r.id=f.regra_franquia_id
JOIN public.administradora_tipos t ON t.id=r.tipo_administradora_id
JOIN public.comissao_programas p ON p.id=r.programa_id
WHERE v.id IN(md5('catalogo-080-venda-INTEGRAL')::uuid,md5('catalogo-080-venda-REDUZIDA_60_99')::uuid,md5('catalogo-080-venda-REDUZIDA_ABAIXO_59')::uuid)
GROUP BY m.codigo,v.valor_parcela_modalidade,v.snapshot_venda,t.nome,p.nome,r.id
ORDER BY m.codigo;
