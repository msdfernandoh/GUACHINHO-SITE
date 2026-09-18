-- A proposta assinada é a fonte dos valores comerciais. A tabela
-- grupo_cota_modalidade_valores é catálogo auxiliar e não pode bloquear a
-- formalização quando a modalidade está habilitada no grupo.
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
    RAISE EXCEPTION 'Fase 231 requer rpc_preparar_formalizacao_contratacao';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');

  v_old := E'  v_modalidade_codigo text;\n  v_valor_parcela numeric(15,2);';
  v_new := E'  v_modalidade_codigo text;\n  v_valor_parcela_aceita numeric(15,2);\n  v_valor_credito_aceito numeric(15,2);';
  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Declarações legadas da preparação não encontradas';
  END IF;
  v_def := replace(v_def, v_old, v_new);

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
  SELECT m.codigo
    INTO v_modalidade_codigo
  FROM public.grupos_modalidades_disponiveis gm
  JOIN public.administradora_modalidades_comissao m
    ON m.id = gm.administradora_modalidade_id
   AND m.administradora_id = v_grupo.administradora_id
   AND m.ativo
  WHERE gm.grupo_id = p_grupo_id
    AND gm.administradora_modalidade_id = p_modalidade_comissao_id
    AND gm.ativo;
  IF v_modalidade_codigo IS NULL THEN
    RAISE EXCEPTION 'Modalidade de comissão não está habilitada para o grupo escolhido';
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
$new$;

  IF strpos(v_def, v_old) = 0 THEN
    RAISE EXCEPTION 'Validação legada por produto/modalidade não encontrada';
  END IF;
  v_def := replace(v_def, v_old, v_new);
  v_def := replace(
    v_def,
    E'''valor_credito'', v_cota.valor_credito,\n      ''valor_parcela'', v_valor_parcela,',
    E'''valor_credito'', v_valor_credito_aceito,\n      ''valor_parcela'', v_valor_parcela_aceita,'
  );

  IF strpos(v_def, '''valor_parcela'', v_valor_parcela,') > 0 THEN
    RAISE EXCEPTION 'Persistência legada do valor da parcela permaneceu na preparação';
  END IF;

  EXECUTE v_def;
END
$migration$;

COMMENT ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date)
IS 'Valida grupo, produto, modalidade habilitada e regras canônicas, preservando crédito e parcela aceitos na contratação assinada.';

COMMIT;
NOTIFY pgrst, 'reload schema';
