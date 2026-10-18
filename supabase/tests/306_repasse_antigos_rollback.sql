-- Executar após o DDL da migration, na mesma transação; este arquivo termina em ROLLBACK.
SELECT set_config('request.jwt.claim.sub', '5dfd1ca3-ee2c-43a1-b294-8d11c698a434', true);
DO $$
DECLARE
  e uuid := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'; a uuid; p uuid;
  r jsonb; r2 jsonb; doc jsonb; c uuid; v uuid; n bigint; n2 bigint; financeiro bigint; catalogo text;
BEGIN
  SELECT administradora_id INTO a FROM public.empresa_administradoras WHERE empresa_id = e AND status = 'ATIVA' LIMIT 1;
  SELECT id INTO p FROM public.participantes_comerciais WHERE empresa_id = e AND status = 'ATIVO' LIMIT 1;
  SELECT count(*) INTO n FROM public.comissao_previsoes_franquia;
  SELECT count(*) INTO n2 FROM public.comissao_previsoes_participantes;
  SELECT count(*) INTO financeiro FROM public.financeiro_recebimentos;
  SELECT md5(jsonb_agg(to_jsonb(g) ORDER BY id)::text) INTO catalogo FROM public.grupos_consorcio g;
  doc := jsonb_build_object('itens', jsonb_build_array(
    jsonb_build_object('grupo','001463','cota','9999','cliente_nome','TESTE ROLLBACK ANTIGOS 306','data_alocacao','2020-03-10','versao','00','valor_base',100000),
    jsonb_build_object('grupo','1463','cota','9999','cliente_nome','TESTE ROLLBACK ANTIGOS 306','data_alocacao','2020-02-10','versao','00','valor_base',100000)));
  r := public.rpc_importar_repasse_antigo(e,a,p,'2020-03','teste.pdf',e::text || '/antigos/teste.pdf',repeat('a',64),doc);
  IF (r->>'novos')::integer <> 1 THEN RAISE EXCEPTION 'Falhou: agrupamento por cota'; END IF;
  c := (r#>>'{vinculos,0,cota_id}')::uuid;
  SELECT venda_id INTO v FROM public.cotas_definitivas WHERE id = c;
  IF NOT EXISTS (SELECT 1 FROM public.vendas WHERE id = v AND somente_controle AND NOT afeta_faturamento
    AND data_venda::date = '2020-02-10' AND valor_credito = 0 AND participante_comercial_id = p) THEN
    RAISE EXCEPTION 'Falhou: data, consultor ou flags';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes cl JOIN public.vendas ve ON ve.cliente_id=cl.id
    WHERE ve.id=v AND cl.cadastro_antigo AND cardinality(cl.pendencias_cadastro)>0) THEN
    RAISE EXCEPTION 'Falhou: cadastro antigo incompleto';
  END IF;
  r2 := public.rpc_importar_repasse_antigo(e,a,p,'2020-03','teste.pdf',e::text || '/antigos/teste.pdf',repeat('a',64),doc);
  IF r2->>'idempotente' <> 'true' THEN RAISE EXCEPTION 'Falhou: idempotência'; END IF;
  r2 := public.rpc_importar_repasse_antigo(e,a,p,'2020-03','outro.pdf',e::text || '/antigos/outro.pdf',repeat('b',64),doc);
  IF (r2->>'novos')::integer <> 0 OR (r2->>'reutilizados')::integer <> 1 THEN RAISE EXCEPTION 'Falhou: cota em PDFs diferentes'; END IF;
  doc := jsonb_set(doc, '{itens,0,data_alocacao}', '"2020-01-10"');
  r2 := public.rpc_importar_repasse_antigo(e,a,p,'2020-01','anterior.pdf',e::text || '/antigos/anterior.pdf',repeat('c',64),doc);
  IF NOT EXISTS (SELECT 1 FROM public.vendas WHERE id=v AND data_venda::date='2020-01-10') THEN
    RAISE EXCEPTION 'Falhou: primeira data entre relatórios';
  END IF;
  BEGIN
    PERFORM public.rpc_importar_repasse_antigo(e,a,gen_random_uuid(),'2020-03','teste.pdf',e::text || '/antigos/teste.pdf',repeat('d',64),doc);
    RAISE EXCEPTION 'TESTE: deveria bloquear consultor de fora';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Selecione um consultor ativo%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.vendas SET somente_controle=false,afeta_faturamento=true WHERE id=v;
    RAISE EXCEPTION 'TESTE: deveria bloquear conversão';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'TESTE:%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.comissao_previsoes_franquia(empresa_id,venda_id,administradora_id,competencia) VALUES(e,v,a,'2020-03');
    RAISE EXCEPTION 'TESTE: deveria bloquear comissão franquia';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Cadastro antigo somente para controle:%' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,competencia) VALUES(e,v,'2020-03');
    RAISE EXCEPTION 'TESTE: deveria bloquear comissão participante';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Cadastro antigo somente para controle:%' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claim.sub','',true);
  BEGIN
    PERFORM public.rpc_importar_repasse_antigo(e,a,p,'2020-03','teste.pdf',e::text || '/antigos/teste.pdf',repeat('c',64),doc);
    RAISE EXCEPTION 'TESTE: deveria bloquear anônimo';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Sem permissão%' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.comissao_previsoes_franquia) <> n
    OR (SELECT count(*) FROM public.comissao_previsoes_participantes) <> n2
    OR (SELECT count(*) FROM public.financeiro_recebimentos) <> financeiro THEN
    RAISE EXCEPTION 'Falhou: alterou financeiro/comissões';
  END IF;
  IF (SELECT md5(jsonb_agg(to_jsonb(g) ORDER BY id)::text) FROM public.grupos_consorcio g) <> catalogo THEN
    RAISE EXCEPTION 'Falhou: alterou catálogo de grupos';
  END IF;
  PERFORM set_config('request.jwt.claim.sub','5dfd1ca3-ee2c-43a1-b294-8d11c698a434',true);
  doc := jsonb_set(doc,'{itens,0,grupo}','"999306"');
  doc := jsonb_set(doc,'{itens,1,grupo}','"999306"');
  r2 := public.rpc_importar_repasse_antigo(e,a,p,'2020-03','grupo.pdf',e::text || '/antigos/grupo.pdf',repeat('e',64),doc);
  IF (r2->>'grupos_criados')::integer <> 1 OR NOT EXISTS (SELECT 1 FROM public.grupos_consorcio
    WHERE empresa_origem_id=e AND codigo_grupo='999306' AND NOT ativo AND cadastro_antigo
      AND origem_governanca='LOCAL' AND prazo_total IS NULL AND data_primeira_assembleia IS NULL) THEN
    RAISE EXCEPTION 'Falhou: novo grupo deve ser inativo e sem dados inventados';
  END IF;
END $$;
ROLLBACK;

