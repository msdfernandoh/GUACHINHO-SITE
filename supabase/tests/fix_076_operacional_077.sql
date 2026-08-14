BEGIN;

DO $$
DECLARE v_admin uuid;v_names text[];
BEGIN
 SELECT id INTO v_admin FROM public.administradoras WHERE slug='racon';
 SELECT array_agg(nome ORDER BY nome) INTO v_names FROM public.administradora_tipos WHERE administradora_id=v_admin AND ativo;
 IF v_names IS DISTINCT FROM ARRAY['Automóveis','Imóvel']::text[] THEN RAISE EXCEPTION 'Tipos Racon ativos inesperados: %',v_names;END IF;
 IF EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=v_admin AND ativo AND nome='Automóvel') THEN RAISE EXCEPTION 'Duplicidade Automóvel permaneceu ativa';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='comissao_regra_participante_cronograma_array_check') THEN RAISE EXCEPTION 'Constraint de cronograma ausente';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='rpc_registrar_recebimento_manual') OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE proname='rpc_conciliar_recebimento_manual') THEN RAISE EXCEPTION 'RPCs financeiros ausentes';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_class WHERE relname='cota_estrategias_lance_historico') THEN RAISE EXCEPTION 'Histórico de lance ausente';END IF;
END $$;

DO $$
DECLARE
 v_empresa uuid; v_admin uuid; v_tipo uuid; v_mod_sem uuid; v_mod_com uuid; v_auth uuid;
 v_programa uuid := 'f0770000-0000-0000-0000-000000000001';
 v_regra_sem uuid := 'f0771000-0000-0000-0000-000000000001';
 v_regra_com uuid := 'f0771000-0000-0000-0000-000000000002';
 v_grupo_sem uuid := 'f0772000-0000-0000-0000-000000000001';
 v_grupo_com uuid := 'f0772000-0000-0000-0000-000000000002';
 v_venda_sem uuid := 'f0773000-0000-0000-0000-000000000001';
 v_venda_com uuid := 'f0773000-0000-0000-0000-000000000002';
 v_cota_sem uuid := 'f0774000-0000-0000-0000-000000000001';
 v_cota_com uuid := 'f0774000-0000-0000-0000-000000000002';
 v_primeira jsonb; v_repetida jsonb;
BEGIN
 SELECT id INTO v_empresa FROM public.empresas WHERE slug='gauchinho';
 SELECT u.auth_user_id INTO v_auth FROM public.usuarios u
  JOIN public.empresa_usuarios eu ON eu.usuario_id=u.id
  JOIN public.papeis p ON p.id=eu.papel_id
  WHERE eu.empresa_id=v_empresa AND eu.ativo AND p.codigo='admin_empresa' LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',v_auth::text,true);
 SELECT id INTO v_admin FROM public.administradoras WHERE slug='racon';
 SELECT t.id INTO v_tipo FROM public.administradora_tipos t
  WHERE t.administradora_id=v_admin AND t.codigo='IMOVEL' AND t.ativo;
 SELECT m.id INTO v_mod_sem FROM public.administradora_modalidades_comissao m
  WHERE m.administradora_id=v_admin AND m.codigo='INTEGRAL' AND m.ativo;
 SELECT m.id INTO v_mod_com FROM public.administradora_modalidades_comissao m
  WHERE m.administradora_id=v_admin AND m.codigo='REDUZIDA_ABAIXO_59' AND m.ativo;
 IF v_empresa IS NULL OR v_admin IS NULL OR v_tipo IS NULL OR v_mod_sem IS NULL OR v_mod_com IS NULL THEN
  RAISE EXCEPTION 'Catálogo canônico necessário ao teste 077 não encontrado';
 END IF;

 INSERT INTO public.comissao_programas(id,empresa_id,nome,administradora_id,ativo,status)
 VALUES(v_programa,v_empresa,'Teste transacional 077',v_admin,true,'ATIVO');
 INSERT INTO public.comissao_regras_franquia(id,empresa_id,programa_id,percentual_total_comissao,base_calculo,vigencia_inicio,ativa,etapas_cronograma,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id)
 VALUES
 (v_regra_sem,v_empresa,v_programa,4,'credito','2026-01-01',true,'[{"ordem":1,"nome":"Total","mes_relativo":1,"percentual_etapa":100}]',true,'TESTE_077',v_tipo,v_mod_sem),
 (v_regra_com,v_empresa,v_programa,4,'credito','2026-01-01',true,'[{"ordem":1,"nome":"Total","mes_relativo":1,"percentual_etapa":100}]',true,'TESTE_077',v_tipo,v_mod_com);
 INSERT INTO public.comissao_regra_etapas(regra_franquia_id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda) VALUES
 (v_regra_sem,1,'MES_RELATIVO',1,'Mensal',4),
 (v_regra_com,1,'MES_RELATIVO',1,'Mensal',2.75),
 (v_regra_com,99,'CONTEMPLACAO',NULL,'CONTEMPLAÇÃO',1.25);

 INSERT INTO public.grupos_consorcio(id,codigo_grupo,modalidade,administradora,administradora_id,empresa_origem_id,tipo_administradora_id,modalidade_comissao_id,origem_governanca,status_governanca)
 VALUES
 (v_grupo_sem,'TESTE-077-SEM','Imóvel','Racon',v_admin,v_empresa,v_tipo,v_mod_sem,'LOCAL','LOCAL'),
 (v_grupo_com,'TESTE-077-COM','Imóvel','Racon',v_admin,v_empresa,v_tipo,v_mod_com,'LOCAL','LOCAL');
 INSERT INTO public.vendas(id,empresa_id,cliente_nome,administradora_id,grupo_id,valor_credito,prazo,parcela,status,data_venda,snapshot_venda)
 VALUES
 (v_venda_sem,v_empresa,'Teste 077 sem contemplação',v_admin,v_grupo_sem,100000,120,1000,'confirmada','2026-08-01','{}'),
 (v_venda_com,v_empresa,'Teste 077 com contemplação',v_admin,v_grupo_com,100000,120,1000,'confirmada','2026-08-01','{}');
 INSERT INTO public.cotas_definitivas(id,empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,numero_cota,valor_credito,prazo,parcela)
 VALUES
 (v_cota_sem,v_empresa,v_venda_sem,v_admin,v_grupo_sem,'TESTE-077-SEM','1',100000,120,1000),
 (v_cota_com,v_empresa,v_venda_com,v_admin,v_grupo_com,'TESTE-077-COM','2',100000,120,1000);

 PERFORM public.rpc_gerar_previsoes_comissao_v2(v_empresa,v_venda_sem,'teste-077-gerar-sem');
 PERFORM public.rpc_gerar_previsoes_comissao_v2(v_empresa,v_venda_com,'teste-077-gerar-com');
 v_primeira:=public.rpc_marcar_cota_contemplada(v_empresa,v_cota_sem,'2026-08-10','SORTEIO',130000,'histórico sem comissão','teste-077-sem-001');
 v_repetida:=public.rpc_marcar_cota_contemplada(v_empresa,v_cota_sem,'2026-08-11','LANCE',140000,'não deve sobrescrever','teste-077-sem-002');
 IF COALESCE((v_primeira->>'reused')::boolean,true) OR NOT COALESCE((v_repetida->>'reused')::boolean,false) THEN
  RAISE EXCEPTION 'Contemplação sem etapa não foi idempotente';
 END IF;
 IF (SELECT count(*) FROM public.cota_contemplacoes WHERE cota_definitiva_id=v_cota_sem)<>1
    OR EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda_sem AND tipo_gatilho='CONTEMPLACAO') THEN
  RAISE EXCEPTION 'Modalidade sem contemplação gerou comissão adicional';
 END IF;

 v_primeira:=public.rpc_marcar_cota_contemplada(v_empresa,v_cota_com,'2026-08-10','LANCE',140000,'crédito apenas histórico','teste-077-com-001');
 v_repetida:=public.rpc_marcar_cota_contemplada(v_empresa,v_cota_com,'2026-08-10','LANCE',140000,'crédito apenas histórico','teste-077-com-001');
 IF COALESCE((v_primeira->>'reused')::boolean,true) OR NOT COALESCE((v_repetida->>'reused')::boolean,false) THEN
  RAISE EXCEPTION 'Contemplação com etapa não foi idempotente';
 END IF;
 IF (SELECT count(*) FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda_com AND tipo_gatilho='CONTEMPLACAO')<>1 THEN
  RAISE EXCEPTION 'Etapa de contemplação não foi gerada exatamente uma vez';
 END IF;
 IF (SELECT valor_previsto FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda_com AND tipo_gatilho='CONTEMPLACAO')<>1250 THEN
  RAISE EXCEPTION 'Contemplação usou crédito atualizado em vez da base original';
 END IF;
 IF (SELECT sum(valor_previsto) FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda_com)<>4000 THEN
  RAISE EXCEPTION 'Total abaixo de 59 não fechou em 4%%';
 END IF;
END $$;

ROLLBACK;
