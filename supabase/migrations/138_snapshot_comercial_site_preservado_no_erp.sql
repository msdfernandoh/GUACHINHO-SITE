-- 138 — O site calcula; proposta congela; ERP formaliza sem recalcular a parcela.
--
-- Compatibilidade: as RPCs mantêm as assinaturas públicas da fase 127. Esta
-- migration transforma de forma defensiva as versões reconciliadas em 126/127
-- e aborta se o banco estiver em uma versão inesperada.
BEGIN;

DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure(
    'public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date)'
  );
  v_def text;
  v_old text;
  v_new text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fase 138 requer rpc_preparar_formalizacao_contratacao da fase 126';
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_new := E'  v_modalidade_codigo text;\n  v_valor_parcela_aceita numeric(15,2);\n  v_valor_credito_aceito numeric(15,2);\n  v_expected_grupo text;\n  v_expected_cota text;';
  IF v_def !~ 'v_modalidade_codigo text;[[:space:]]+v_valor_parcela numeric\(15,[[:space:]]*2\);' THEN
    RAISE EXCEPTION 'Declarações inesperadas na RPC de preparação; migration 138 não aplicada';
  END IF;
  v_def := regexp_replace(
    v_def,
    '  v_modalidade_codigo text;[[:space:]]+v_valor_parcela numeric\(15,[[:space:]]*2\);',
    v_new
  );

  v_old := $old$
  SELECT m.codigo, mv.valor_parcela
    INTO v_modalidade_codigo, v_valor_parcela
    FROM public.grupo_cota_modalidade_valores mv
    JOIN public.grupos_modalidades_disponiveis gm
      ON gm.grupo_id = p_grupo_id
     AND gm.administradora_modalidade_id = mv.administradora_modalidade_id
     AND gm.ativo
    JOIN public.administradora_modalidades_comissao m
      ON m.id = mv.administradora_modalidade_id
     AND m.administradora_id = v_grupo.administradora_id
     AND m.ativo
    WHERE mv.grupo_cota_id = p_opcao_cota_id
      AND mv.administradora_modalidade_id = p_modalidade_comissao_id
      AND mv.ativo
      AND mv.habilitado;
  IF v_valor_parcela IS NULL OR v_valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Modalidade sem valor homologado para o produto escolhido';
  END IF;
$old$;
  v_new := $new$
  SELECT m.codigo INTO v_modalidade_codigo
  FROM public.administradora_modalidades_comissao m
  WHERE m.id = p_modalidade_comissao_id
    AND m.administradora_id = v_grupo.administradora_id
    AND m.ativo;
  IF v_modalidade_codigo IS NULL THEN
    RAISE EXCEPTION 'Modalidade de comissão não pertence à administradora do grupo';
  END IF;

  v_valor_credito_aceito := COALESCE(
    v_contratacao.credito_selecionado,
    CASE WHEN v_contratacao.dados_simulacao->>'valor_credito' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao->>'valor_credito')::numeric END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{totais,somaCotas}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao#>>'{totais,somaCotas}')::numeric END
  );
  v_valor_parcela_aceita := COALESCE(
    v_contratacao.parcela_estimada,
    CASE WHEN v_contratacao.dados_simulacao->>'valor_parcela' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao->>'valor_parcela')::numeric END,
    CASE WHEN v_contratacao.dados_simulacao#>>'{totais,primeiraParcela}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_contratacao.dados_simulacao#>>'{totais,primeiraParcela}')::numeric END
  );
  IF v_valor_credito_aceito IS NULL OR v_valor_credito_aceito <= 0
     OR v_valor_parcela_aceita IS NULL OR v_valor_parcela_aceita <= 0 THEN
    RAISE EXCEPTION 'Proposta sem valores comerciais aceitos e preservados';
  END IF;

  -- Propostas assinadas pelo motor novo não permitem troca do produto aceito.
  IF NULLIF(v_contratacao.dados_simulacao#>>'{snapshot_calculo,hash_sha256}', '') IS NOT NULL THEN
    v_expected_grupo := v_contratacao.dados_simulacao#>>'{selecoes,0,grupoId}';
    v_expected_cota := v_contratacao.dados_simulacao#>>'{selecoes,0,cotaId}';
    IF v_expected_grupo IS DISTINCT FROM p_grupo_id::text
       OR v_expected_cota IS DISTINCT FROM p_opcao_cota_id::text THEN
      RAISE EXCEPTION 'Grupo/produto diverge da proposta aceita; gere uma nova proposta';
    END IF;
  END IF;
$new$;
  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Validação antiga de parcela não encontrada na RPC de preparação';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  v_def := replace(v_def, E'''valor_credito'', v_cota.valor_credito,\n      ''valor_parcela'', v_valor_parcela,', E'''valor_credito'', v_valor_credito_aceito,\n      ''valor_parcela'', v_valor_parcela_aceita,');
  EXECUTE v_def;
END
$migration$;

DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)');
  v_def text;
  v_old text;
  v_new text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fase 138 requer rpc_converter_contratacao_venda da fase 127';
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_old := E'  v_prazo_restante integer;';
  v_new := E'  v_prazo_restante integer;\n  v_valor_parcela_aceita numeric(15,2);\n  v_valor_credito_aceito numeric(15,2);';
  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Declarações inesperadas na RPC de conversão; migration 138 não aplicada';
  END IF;
  v_def := replace(v_def, v_old, v_new);

  v_old := $old$
  SELECT mv.*, m.codigo, m.nome
    INTO v_valor_modalidade
  FROM public.grupo_cota_modalidade_valores mv
  JOIN public.grupos_modalidades_disponiveis gm
    ON gm.grupo_id = v_grupo.id
   AND gm.administradora_modalidade_id = mv.administradora_modalidade_id
   AND gm.ativo
  JOIN public.administradora_modalidades_comissao m
    ON m.id = mv.administradora_modalidade_id
   AND m.administradora_id = v_grupo.administradora_id
   AND m.ativo
  WHERE mv.grupo_cota_id = v_opcao.id
    AND mv.administradora_modalidade_id = v_modalidade_id
    AND mv.ativo
    AND mv.habilitado;
  IF v_valor_modalidade.id IS NULL OR v_valor_modalidade.valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Modalidade sem valor homologado para o produto escolhido';
  END IF;
$old$;
  v_new := $new$
  SELECT m.* INTO v_valor_modalidade
  FROM public.administradora_modalidades_comissao m
  WHERE m.id = v_modalidade_id
    AND m.administradora_id = v_grupo.administradora_id
    AND m.ativo;
  IF v_valor_modalidade.id IS NULL THEN
    RAISE EXCEPTION 'Modalidade de comissão não pertence à administradora do grupo';
  END IF;

  v_valor_credito_aceito := COALESCE(
    v_contratacao.credito_selecionado,
    CASE WHEN v_dados->>'valor_credito' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_dados->>'valor_credito')::numeric END,
    CASE WHEN v_dados#>>'{totais,somaCotas}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_dados#>>'{totais,somaCotas}')::numeric END
  );
  v_valor_parcela_aceita := COALESCE(
    v_contratacao.parcela_estimada,
    CASE WHEN v_dados->>'valor_parcela' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_dados->>'valor_parcela')::numeric END,
    CASE WHEN v_dados#>>'{totais,primeiraParcela}' ~ '^[0-9]+([.][0-9]+)?$'
      THEN (v_dados#>>'{totais,primeiraParcela}')::numeric END
  );
  IF v_valor_credito_aceito IS NULL OR v_valor_credito_aceito <= 0
     OR v_valor_parcela_aceita IS NULL OR v_valor_parcela_aceita <= 0 THEN
    RAISE EXCEPTION 'Proposta sem valores comerciais aceitos e preservados';
  END IF;
$new$;
  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Validação antiga de parcela não encontrada na RPC de conversão';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  v_def := replace(v_def, 'v_valor_modalidade.valor_parcela', 'v_valor_parcela_aceita');
  v_def := replace(v_def, 'v_opcao.valor_credito', 'v_valor_credito_aceito');
  -- A existência/saúde do produto atual continua sendo validada antes de a
  -- proposta aceita ser lida; portanto esta condição não usa a variável ainda nula.
  v_def := replace(
    v_def,
    'IF NOT FOUND OR v_valor_credito_aceito IS NULL OR v_valor_credito_aceito <= 0 THEN',
    'IF NOT FOUND OR v_opcao.valor_credito IS NULL OR v_opcao.valor_credito <= 0 THEN'
  );
  EXECUTE v_def;
END
$migration$;

-- A venda não publica parcelas específicas de uma proposta no catálogo global.
-- Mantém a resolução de UUIDs/tipo da trigger histórica e elimina apenas seus
-- dois dual-writes globais (grupo x modalidade e produto x valor de parcela).
DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure('public.comissao_v2_enriquecer_venda()');
  v_def text;
  v_old text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Trigger de enriquecimento de venda não encontrada';
  END IF;
  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_old := $old$
  -- 4. Garante vínculo em grupos_modalidades_disponiveis
  IF NEW.grupo_id IS NOT NULL AND v_modalidade_id IS NOT NULL THEN
    INSERT INTO public.grupos_modalidades_disponiveis (grupo_id, administradora_modalidade_id, ativo, ordem)
    VALUES (NEW.grupo_id, v_modalidade_id, true, 0)
    ON CONFLICT (grupo_id, administradora_modalidade_id) DO UPDATE SET ativo = true;
  END IF;

  -- 5. Garante valor em grupo_cota_modalidade_valores
  IF NEW.opcao_cota_id IS NOT NULL AND v_modalidade_id IS NOT NULL THEN
    INSERT INTO public.grupo_cota_modalidade_valores (grupo_cota_id, administradora_modalidade_id, valor_parcela, percentual_reducao, ativo)
    VALUES (NEW.opcao_cota_id, v_modalidade_id, COALESCE(NEW.parcela, 0), NULL, true)
    ON CONFLICT (grupo_cota_id, administradora_modalidade_id) DO UPDATE SET valor_parcela = EXCLUDED.valor_parcela, ativo = true;
  END IF;
$old$;
  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Dual-write antigo de parcelas não encontrado na trigger de vendas';
  END IF;
  v_def := replace(v_def, v_old, E'  -- Catálogo global é alterado somente pela governança SaaS.\n');
  EXECUTE v_def;
END
$migration$;

COMMENT ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date)
IS 'Valida UUIDs, participantes e comissão preservando crédito/parcela aceitos e assinados pelo site.';
COMMENT ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
IS 'Formaliza venda/cota/comissões usando o snapshot comercial aceito; não recalcula parcela no ERP.';

REVOKE ALL ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
