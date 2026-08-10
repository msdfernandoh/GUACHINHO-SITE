-- Homologacao destrutiva somente para branch Supabase efemera.
-- Todas as fixtures e mutacoes ficam dentro de uma transacao revertida ao final.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.assert_count(p_sql text, p_expected bigint, p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual bigint;
BEGIN
  EXECUTE p_sql INTO v_actual;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: esperado %, obtido %', p_label, p_expected, v_actual;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_row_count(p_sql text, p_expected bigint, p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_actual bigint;
BEGIN
  EXECUTE p_sql;
  GET DIAGNOSTICS v_actual = ROW_COUNT;
  IF v_actual IS DISTINCT FROM p_expected THEN
    RAISE EXCEPTION 'FAIL %: esperado %, obtido %', p_label, p_expected, v_actual;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_error(p_sql text, p_label text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_failed boolean := false;
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    v_failed := true;
  END;

  IF NOT v_failed THEN
    RAISE EXCEPTION 'FAIL %: operacao deveria ter sido bloqueada', p_label;
  END IF;
END
$$;

-- UUIDs reservados exclusivamente para esta transacao de teste.
INSERT INTO public.empresas (id, slug, razao_social, nome_fantasia) VALUES
  ('f0570000-0000-0000-0000-000000000001', 'codex-rls-a', 'Codex RLS A', 'Codex A'),
  ('f0570000-0000-0000-0000-000000000002', 'codex-rls-b', 'Codex RLS B', 'Codex B');

INSERT INTO auth.users (id, email, raw_app_meta_data, raw_user_meta_data) VALUES
  ('f0572000-0000-0000-0000-000000000001', 'codex-viewer-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0572000-0000-0000-0000-000000000002', 'codex-consultor-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0572000-0000-0000-0000-000000000003', 'codex-gestor-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0572000-0000-0000-0000-000000000004', 'codex-admin-a@example.invalid', '{}'::jsonb, '{}'::jsonb),
  ('f0572000-0000-0000-0000-000000000005', 'codex-admin-b@example.invalid', '{}'::jsonb, '{}'::jsonb);

INSERT INTO public.usuarios (id, auth_user_id, nome, email, perfil) VALUES
  ('f0571000-0000-0000-0000-000000000001', 'f0572000-0000-0000-0000-000000000001', 'Viewer A', 'codex-viewer-a@example.invalid', 'visualizador'),
  ('f0571000-0000-0000-0000-000000000002', 'f0572000-0000-0000-0000-000000000002', 'Consultor A', 'codex-consultor-a@example.invalid', 'visualizador'),
  ('f0571000-0000-0000-0000-000000000003', 'f0572000-0000-0000-0000-000000000003', 'Gestor A', 'codex-gestor-a@example.invalid', 'srd'),
  ('f0571000-0000-0000-0000-000000000004', 'f0572000-0000-0000-0000-000000000004', 'Admin A', 'codex-admin-a@example.invalid', 'visualizador'),
  ('f0571000-0000-0000-0000-000000000005', 'f0572000-0000-0000-0000-000000000005', 'Admin B', 'codex-admin-b@example.invalid', 'imobiliaria');

INSERT INTO public.empresa_usuarios (empresa_id, usuario_id, papel_id) VALUES
  ('f0570000-0000-0000-0000-000000000001', 'f0571000-0000-0000-0000-000000000001', (SELECT id FROM public.papeis WHERE codigo = 'visualizador' AND escopo = 'COMPANY' LIMIT 1)),
  ('f0570000-0000-0000-0000-000000000001', 'f0571000-0000-0000-0000-000000000002', (SELECT id FROM public.papeis WHERE codigo = 'consultor' AND escopo = 'COMPANY' LIMIT 1)),
  ('f0570000-0000-0000-0000-000000000001', 'f0571000-0000-0000-0000-000000000003', (SELECT id FROM public.papeis WHERE codigo = 'gestor' AND escopo = 'COMPANY' LIMIT 1)),
  ('f0570000-0000-0000-0000-000000000001', 'f0571000-0000-0000-0000-000000000004', (SELECT id FROM public.papeis WHERE codigo = 'admin_empresa' AND escopo = 'COMPANY' LIMIT 1)),
  ('f0570000-0000-0000-0000-000000000002', 'f0571000-0000-0000-0000-000000000005', (SELECT id FROM public.papeis WHERE codigo = 'admin_empresa' AND escopo = 'COMPANY' LIMIT 1));

INSERT INTO public.administradoras (id, nome, slug) VALUES
  ('f0573000-0000-0000-0000-000000000001', 'Codex Administradora', 'codex-administradora');
INSERT INTO public.grupos_consorcio (id, codigo_grupo, modalidade, administradora_id) VALUES
  ('f0573000-0000-0000-0000-000000000002', 'CODEX-RLS', 'Imovel', 'f0573000-0000-0000-0000-000000000001');

INSERT INTO public.participantes_comerciais (id, empresa_id, nome, telefone) VALUES
  ('f0574000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Participante A', '65000000001'),
  ('f0574000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Participante B', '65000000002');

INSERT INTO public.vendas (id, empresa_id, cliente_nome, administradora_id, grupo_id, valor_credito, prazo, parcela) VALUES
  ('f0575000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Venda A', 'f0573000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000002', 100000, 100, 1000),
  ('f0575000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Venda B', 'f0573000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000002', 100000, 100, 1000);
INSERT INTO public.cotas_definitivas (id, empresa_id, venda_id, administradora_id, grupo_id, numero_grupo, valor_credito, prazo, parcela) VALUES
  ('f0575100-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0575000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000002', 'A', 100000, 100, 1000),
  ('f0575100-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0575000-0000-0000-0000-000000000002', 'f0573000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000002', 'B', 100000, 100, 1000);

INSERT INTO public.comissao_programas (id, empresa_id, nome) VALUES
  ('f0576000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Programa A'),
  ('f0576000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Programa B');
INSERT INTO public.comissao_regras_franquia (id, empresa_id, programa_id) VALUES
  ('f0576100-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0576000-0000-0000-0000-000000000001'),
  ('f0576100-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0576000-0000-0000-0000-000000000002');
INSERT INTO public.comissao_regras_participantes (id, empresa_id, programa_id, participante_comercial_id) VALUES
  ('f0576200-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0576000-0000-0000-0000-000000000001', 'f0574000-0000-0000-0000-000000000001'),
  ('f0576200-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0576000-0000-0000-0000-000000000002', 'f0574000-0000-0000-0000-000000000002');
INSERT INTO public.comissao_previsoes_franquia (id, empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, competencia, base_calculo_valor, percentual_aplicado, valor_previsto) VALUES
  ('f0576300-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0575000-0000-0000-0000-000000000001', 'f0575100-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000001', 'f0576100-0000-0000-0000-000000000001', '2026-08', 100000, 4, 4000),
  ('f0576300-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0575000-0000-0000-0000-000000000002', 'f0575100-0000-0000-0000-000000000002', 'f0573000-0000-0000-0000-000000000001', 'f0576100-0000-0000-0000-000000000002', '2026-08', 100000, 4, 4000);
INSERT INTO public.comissao_previsoes_participantes (id, empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, regra_participante_id, competencia, base_calculo_valor, percentual_aplicado, valor_previsto) VALUES
  ('f0576400-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0575000-0000-0000-0000-000000000001', 'f0575100-0000-0000-0000-000000000001', 'f0574000-0000-0000-0000-000000000001', 'f0576200-0000-0000-0000-000000000001', '2026-08', 100000, 1.5, 1500),
  ('f0576400-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0575000-0000-0000-0000-000000000002', 'f0575100-0000-0000-0000-000000000002', 'f0574000-0000-0000-0000-000000000002', 'f0576200-0000-0000-0000-000000000002', '2026-08', 100000, 1.5, 1500);

INSERT INTO public.financeiro_recebimentos (id, empresa_id, administradora_id, competencia, valor_total) VALUES
  ('f0577000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0573000-0000-0000-0000-000000000001', '2026-08', 4000),
  ('f0577000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0573000-0000-0000-0000-000000000001', '2026-08', 4000);
INSERT INTO public.financeiro_recebimento_itens (id, recebimento_id, previsao_franquia_id, valor_liquidado) VALUES
  ('f0577100-0000-0000-0000-000000000001', 'f0577000-0000-0000-0000-000000000001', 'f0576300-0000-0000-0000-000000000001', 4000),
  ('f0577100-0000-0000-0000-000000000002', 'f0577000-0000-0000-0000-000000000002', 'f0576300-0000-0000-0000-000000000002', 4000);
INSERT INTO public.financeiro_pagamentos (id, empresa_id, participante_comercial_id, competencia, valor_bruto, valor_liquido) VALUES
  ('f0577200-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0574000-0000-0000-0000-000000000001', '2026-08', 1500, 1500),
  ('f0577200-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0574000-0000-0000-0000-000000000002', '2026-08', 1500, 1500);
INSERT INTO public.financeiro_pagamento_itens (id, pagamento_id, previsao_participante_id, valor_liquidado) VALUES
  ('f0577300-0000-0000-0000-000000000001', 'f0577200-0000-0000-0000-000000000001', 'f0576400-0000-0000-0000-000000000001', 1500),
  ('f0577300-0000-0000-0000-000000000002', 'f0577200-0000-0000-0000-000000000002', 'f0576400-0000-0000-0000-000000000002', 1500);
INSERT INTO public.financeiro_compensacoes (id, empresa_id, participante_comercial_id, venda_id, motivo, valor_original, valor_saldo) VALUES
  ('f0577400-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0574000-0000-0000-0000-000000000001', 'f0575000-0000-0000-0000-000000000001', 'A', 100, 100),
  ('f0577400-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'f0574000-0000-0000-0000-000000000002', 'f0575000-0000-0000-0000-000000000002', 'B', 100, 100);
INSERT INTO public.caixa_movimentos (id, empresa_id, tipo_movimento, origem_tipo, competencia, valor, descricao) VALUES
  ('f0577500-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'entrada', 'ajuste_caixa', '2026-08', 100, 'A'),
  ('f0577500-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'entrada', 'ajuste_caixa', '2026-08', 100, 'B');

INSERT INTO public.equipes (id, empresa_id, nome, gestor_id) VALUES
  ('f0578000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Equipe A', 'f0574000-0000-0000-0000-000000000001'),
  ('f0578000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Equipe B', 'f0574000-0000-0000-0000-000000000002');
INSERT INTO public.equipe_membros (id, equipe_id, participante_id) VALUES
  ('f0578100-0000-0000-0000-000000000001', 'f0578000-0000-0000-0000-000000000001', 'f0574000-0000-0000-0000-000000000001'),
  ('f0578100-0000-0000-0000-000000000002', 'f0578000-0000-0000-0000-000000000002', 'f0574000-0000-0000-0000-000000000002');
INSERT INTO public.metas_comerciais (id, empresa_id, titulo, alvo_tipo, alvo_id, indicador, periodo_tipo, data_inicio, data_fim, valor_meta) VALUES
  ('f0578200-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Meta A', 'equipe', 'f0578000-0000-0000-0000-000000000001', 'quantidade_vendas', 'mensal', '2026-08-01', '2026-08-31', 1),
  ('f0578200-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Meta B', 'equipe', 'f0578000-0000-0000-0000-000000000002', 'quantidade_vendas', 'mensal', '2026-08-01', '2026-08-31', 1);
INSERT INTO public.tarefas_gestao (id, empresa_id, titulo, responsavel_id, equipe_id, origem_tipo) VALUES
  ('f0578300-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'Tarefa A', 'f0574000-0000-0000-0000-000000000001', 'f0578000-0000-0000-0000-000000000001', 'interna'),
  ('f0578300-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'Tarefa B', 'f0574000-0000-0000-0000-000000000002', 'f0578000-0000-0000-0000-000000000002', 'interna');
INSERT INTO public.audit_logs_central (id, empresa_id, modulo, acao, entidade_tipo) VALUES
  ('f0578400-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'teste', 'insert', 'teste'),
  ('f0578400-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000002', 'teste', 'insert', 'teste');

-- Nenhum FOR ALL e cardinalidade esperada de policies por tabela.
DO $$
DECLARE
  v_table text;
  v_count integer;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'vendas','cotas_definitivas','comissao_programas','comissao_regras_franquia',
    'comissao_regras_participantes','comissao_previsoes_franquia',
    'comissao_previsoes_participantes','financeiro_recebimentos',
    'financeiro_recebimento_itens','financeiro_pagamentos','financeiro_pagamento_itens',
    'financeiro_compensacoes','equipes','equipe_membros','metas_comerciais','tarefas_gestao'
  ] LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = v_table AND cmd IN ('SELECT','INSERT','UPDATE','DELETE');
    IF v_count <> 4 THEN RAISE EXCEPTION 'FAIL policies %: %', v_table, v_count; END IF;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY['caixa_movimentos','audit_logs_central'] LOOP
    SELECT count(*) INTO v_count FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND tablename = v_table AND cmd IN ('SELECT','INSERT');
    IF v_count <> 2 THEN RAISE EXCEPTION 'FAIL policies append-only %: %', v_table, v_count; END IF;
  END LOOP;

  SELECT count(*) INTO v_count FROM pg_catalog.pg_policies
  WHERE schemaname = 'public'
    AND tablename = ANY (ARRAY['vendas','cotas_definitivas','comissao_programas','comissao_regras_franquia','comissao_regras_participantes','comissao_previsoes_franquia','comissao_previsoes_participantes','financeiro_recebimentos','financeiro_recebimento_itens','financeiro_pagamentos','financeiro_pagamento_itens','financeiro_compensacoes','caixa_movimentos','equipes','equipe_membros','metas_comerciais','tarefas_gestao','audit_logs_central'])
    AND cmd = 'ALL';
  IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: ainda existem policies FOR ALL'; END IF;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.assert_tenant_matrix(
  p_auth uuid,
  p_own uuid,
  p_other uuid,
  p_global boolean,
  p_write boolean,
  p_label text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table text;
  v_parent text;
  v_expected_other bigint := CASE WHEN p_global THEN 1 ELSE 0 END;
  v_expected_write bigint := CASE WHEN p_write THEN 1 ELSE 0 END;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_auth::text, true);

  FOREACH v_table IN ARRAY ARRAY[
    'vendas','cotas_definitivas','comissao_programas','comissao_regras_franquia',
    'comissao_regras_participantes','comissao_previsoes_franquia',
    'comissao_previsoes_participantes','financeiro_recebimentos','financeiro_pagamentos',
    'financeiro_compensacoes','equipes','metas_comerciais','tarefas_gestao',
    'caixa_movimentos','audit_logs_central'
  ] LOOP
    PERFORM pg_temp.assert_count(format('SELECT count(*) FROM public.%I WHERE empresa_id = %L', v_table, p_own), 1, p_label || ' read own ' || v_table);
    PERFORM pg_temp.assert_count(format('SELECT count(*) FROM public.%I WHERE empresa_id = %L', v_table, p_other), v_expected_other, p_label || ' read other ' || v_table);
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'vendas','cotas_definitivas','comissao_programas','comissao_regras_franquia',
    'comissao_regras_participantes','comissao_previsoes_franquia',
    'comissao_previsoes_participantes','financeiro_recebimentos','financeiro_pagamentos',
    'financeiro_compensacoes','equipes','metas_comerciais','tarefas_gestao'
  ] LOOP
    PERFORM pg_temp.assert_row_count(format('UPDATE public.%I SET empresa_id = empresa_id WHERE empresa_id = %L', v_table, p_own), v_expected_write, p_label || ' write own ' || v_table);
    PERFORM pg_temp.assert_row_count(format('UPDATE public.%I SET empresa_id = empresa_id WHERE empresa_id = %L', v_table, p_other), CASE WHEN p_global AND p_write THEN 1 ELSE 0 END, p_label || ' write other ' || v_table);
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY[
    'financeiro_recebimento_itens','financeiro_pagamento_itens','equipe_membros'
  ] LOOP
    v_parent := CASE v_table
      WHEN 'financeiro_recebimento_itens' THEN 'financeiro_recebimentos'
      WHEN 'financeiro_pagamento_itens' THEN 'financeiro_pagamentos'
      ELSE 'equipes'
    END;
    PERFORM pg_temp.assert_count(format('SELECT count(*) FROM public.%I c JOIN public.%I p ON p.id = c.%I WHERE p.empresa_id = %L', v_table, v_parent, CASE WHEN v_table = 'equipe_membros' THEN 'equipe_id' WHEN v_table = 'financeiro_recebimento_itens' THEN 'recebimento_id' ELSE 'pagamento_id' END, p_own), 1, p_label || ' read own ' || v_table);
    PERFORM pg_temp.assert_count(format('SELECT count(*) FROM public.%I c JOIN public.%I p ON p.id = c.%I WHERE p.empresa_id = %L', v_table, v_parent, CASE WHEN v_table = 'equipe_membros' THEN 'equipe_id' WHEN v_table = 'financeiro_recebimento_itens' THEN 'recebimento_id' ELSE 'pagamento_id' END, p_other), v_expected_other, p_label || ' read other ' || v_table);
    PERFORM pg_temp.assert_row_count(format('UPDATE public.%I SET id = id WHERE id IN (SELECT c.id FROM public.%I c JOIN public.%I p ON p.id = c.%I WHERE p.empresa_id = %L)', v_table, v_table, v_parent, CASE WHEN v_table = 'equipe_membros' THEN 'equipe_id' WHEN v_table = 'financeiro_recebimento_itens' THEN 'recebimento_id' ELSE 'pagamento_id' END, p_own), v_expected_write, p_label || ' write own ' || v_table);
  END LOOP;

  PERFORM pg_temp.assert_error('UPDATE public.caixa_movimentos SET descricao = descricao WHERE empresa_id = ' || quote_literal(p_own), p_label || ' caixa append-only');
  PERFORM pg_temp.assert_error('DELETE FROM public.audit_logs_central WHERE empresa_id = ' || quote_literal(p_own), p_label || ' audit append-only');
END
$$;

SELECT set_config(
  'codex.superadmin_auth',
  (SELECT u.auth_user_id::text FROM public.empresa_usuarios eu JOIN public.usuarios u ON u.id = eu.usuario_id JOIN public.papeis p ON p.id = eu.papel_id WHERE eu.ativo AND p.codigo = 'super_admin' AND p.escopo = 'PLATFORM' AND p.empresa_id IS NULL AND u.auth_user_id IS NOT NULL LIMIT 1),
  true
);

-- Anon nao possui nem privilegio de leitura nas tabelas internas.
SET LOCAL ROLE anon;
SELECT pg_temp.assert_error('SELECT * FROM public.vendas', 'anon vendas');
SELECT pg_temp.assert_error('SELECT * FROM public.audit_logs_central', 'anon auditoria');
RESET ROLE;

-- Perfil legado propositalmente divergente comprova que a autorizacao vem de papel N:N.
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_tenant_matrix('f0572000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000002', false, false, 'visualizador');
SELECT pg_temp.assert_tenant_matrix('f0572000-0000-0000-0000-000000000002', 'f0570000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000002', false, false, 'consultor');
SELECT pg_temp.assert_tenant_matrix('f0572000-0000-0000-0000-000000000003', 'f0570000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000002', false, false, 'gestor');
SELECT pg_temp.assert_tenant_matrix('f0572000-0000-0000-0000-000000000004', 'f0570000-0000-0000-0000-000000000001', 'f0570000-0000-0000-0000-000000000002', false, true, 'admin_empresa');
SELECT pg_temp.assert_tenant_matrix(
  current_setting('codex.superadmin_auth')::uuid,
  'f0570000-0000-0000-0000-000000000001',
  'f0570000-0000-0000-0000-000000000002',
  true,
  true,
  'platform_superadmin'
);

-- INSERT: admin no proprio tenant; visualizador e cross-tenant bloqueados.
SELECT set_config('request.jwt.claim.sub', 'f0572000-0000-0000-0000-000000000004', true);
SELECT pg_temp.assert_row_count($q$INSERT INTO public.equipes (empresa_id,nome) VALUES ('f0570000-0000-0000-0000-000000000001','Admin insert')$q$, 1, 'admin insert own');
SELECT pg_temp.assert_error($q$INSERT INTO public.equipes (empresa_id,nome) VALUES ('f0570000-0000-0000-0000-000000000002','Cross insert')$q$, 'admin insert cross');
SELECT set_config('request.jwt.claim.sub', 'f0572000-0000-0000-0000-000000000001', true);
SELECT pg_temp.assert_error($q$INSERT INTO public.equipes (empresa_id,nome) VALUES ('f0570000-0000-0000-0000-000000000001','Viewer insert')$q$, 'viewer insert own');
RESET ROLE;

-- service_role tambem nao pode adulterar historicos append-only.
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_error($q$UPDATE public.caixa_movimentos SET descricao='adulterado' WHERE id='f0577500-0000-0000-0000-000000000001'$q$, 'service_role caixa append-only');
SELECT pg_temp.assert_error($q$DELETE FROM public.audit_logs_central WHERE id='f0578400-0000-0000-0000-000000000001'$q$, 'service_role audit append-only');
RESET ROLE;

-- Integridade cross-tenant inequívoca: todas devem falhar no trigger de banco.
SELECT pg_temp.assert_error($q$INSERT INTO public.cotas_definitivas (empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,valor_credito,prazo,parcela) VALUES ('f0570000-0000-0000-0000-000000000001','f0575000-0000-0000-0000-000000000002','f0573000-0000-0000-0000-000000000001','f0573000-0000-0000-0000-000000000002','X',1,1,1)$q$, 'cota venda cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.comissao_regras_franquia (empresa_id,programa_id) VALUES ('f0570000-0000-0000-0000-000000000001','f0576000-0000-0000-0000-000000000002')$q$, 'regra programa cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.comissao_previsoes_franquia (empresa_id,venda_id,administradora_id,competencia,base_calculo_valor,percentual_aplicado,valor_previsto) VALUES ('f0570000-0000-0000-0000-000000000001','f0575000-0000-0000-0000-000000000002','f0573000-0000-0000-0000-000000000001','2026-08',1,1,1)$q$, 'previsao venda cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.financeiro_recebimento_itens (recebimento_id,previsao_franquia_id,valor_liquidado) VALUES ('f0577000-0000-0000-0000-000000000001','f0576300-0000-0000-0000-000000000002',1)$q$, 'recebimento item cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.financeiro_pagamento_itens (pagamento_id,previsao_participante_id,valor_liquidado) VALUES ('f0577200-0000-0000-0000-000000000001','f0576400-0000-0000-0000-000000000002',1)$q$, 'pagamento item cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.financeiro_compensacoes (empresa_id,venda_id,motivo,valor_original,valor_saldo) VALUES ('f0570000-0000-0000-0000-000000000001','f0575000-0000-0000-0000-000000000002','X',1,1)$q$, 'compensacao venda cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.equipes (empresa_id,nome,gestor_id) VALUES ('f0570000-0000-0000-0000-000000000001','X','f0574000-0000-0000-0000-000000000002')$q$, 'equipe gestor cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.equipe_membros (equipe_id,participante_id) VALUES ('f0578000-0000-0000-0000-000000000001','f0574000-0000-0000-0000-000000000002')$q$, 'equipe membro cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.metas_comerciais (empresa_id,titulo,alvo_tipo,alvo_id,indicador,periodo_tipo,data_inicio,data_fim,valor_meta) VALUES ('f0570000-0000-0000-0000-000000000001','X','equipe','f0578000-0000-0000-0000-000000000002','quantidade_vendas','mensal','2026-08-01','2026-08-31',1)$q$, 'meta alvo cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.tarefas_gestao (empresa_id,titulo,responsavel_id,equipe_id) VALUES ('f0570000-0000-0000-0000-000000000001','X','f0574000-0000-0000-0000-000000000002','f0578000-0000-0000-0000-000000000002')$q$, 'tarefa cross-tenant');
SELECT pg_temp.assert_error($q$INSERT INTO public.caixa_movimentos (empresa_id,tipo_movimento,origem_tipo,origem_id,competencia,valor,descricao) VALUES ('f0570000-0000-0000-0000-000000000001','entrada','recebimento_administradora','f0577000-0000-0000-0000-000000000002','2026-08',1,'X')$q$, 'caixa origem cross-tenant');

ROLLBACK;

SELECT 'PASS' AS resultado, '18 tabelas; anon + 5 perfis; 2 tenants; append-only; cross-tenant' AS matriz;
