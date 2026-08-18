-- E2E da migration 083. Executar somente em Supabase isolado descartável.
BEGIN;

DO $$
DECLARE
  v_auth uuid;
  v_admin uuid;
  v_tipo uuid;
  v_tipo_livre uuid;
  v_modal_integral uuid;
  v_modal_60 uuid;
  v_modal_59 uuid;
  v_modal_livre uuid;
  v_curva uuid;
  v_curva_livre uuid;
  v_empresa uuid;
  v_programa uuid;
  v_regra_integral uuid;
  v_regra_60 uuid;
  v_regra_59 uuid;
  v_modelo uuid;
  v_grupo uuid := md5('e2e-083-grupo')::uuid;
  v_produto uuid := md5('e2e-083-produto')::uuid;
  v_count integer;
BEGIN
  SELECT u.auth_user_id INTO v_auth
  FROM public.usuarios u
  JOIN public.empresa_usuarios eu ON eu.usuario_id=u.id AND eu.ativo
  JOIN public.papeis p ON p.id=eu.papel_id
  WHERE p.codigo='super_admin' AND p.escopo='PLATFORM' AND p.empresa_id IS NULL
  LIMIT 1;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'E2E 083 exige Platform Superadmin existente';END IF;
  PERFORM set_config('request.jwt.claim.sub',v_auth::text,true);

  SELECT id INTO v_empresa FROM public.empresas WHERE slug='gauchinho' LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'E2E 083 exige tenant Gauchinho no clone isolado';END IF;

  SELECT (public.rpc_platform_salvar_administradora(NULL,'Administradora E2E 083','E2E 083','ATIVA','Catálogo sintético isolado')->>'id')::uuid INTO v_admin;
  PERFORM public.rpc_salvar_tipo_administradora(v_admin,'Automóveis E2E',true,NULL);
  PERFORM public.rpc_salvar_tipo_administradora(v_admin,'Tipo livre para exclusão',true,NULL);
  SELECT id INTO v_tipo FROM public.administradora_tipos WHERE administradora_id=v_admin AND nome='Automóveis E2E';
  SELECT id INTO v_tipo_livre FROM public.administradora_tipos WHERE administradora_id=v_admin AND nome='Tipo livre para exclusão';

  PERFORM public.rpc_salvar_modalidade_administradora(v_admin,'Integral E2E','Integral',true,NULL);
  PERFORM public.rpc_salvar_modalidade_administradora(v_admin,'Reduzida 60 a 99 E2E','Reduzida intermediária',true,NULL);
  PERFORM public.rpc_salvar_modalidade_administradora(v_admin,'Reduzida abaixo de 59 E2E','Reduzida mínima',true,NULL);
  PERFORM public.rpc_salvar_modalidade_administradora(v_admin,'Modalidade livre para exclusão','Descartável',true,NULL);
  SELECT id INTO v_modal_integral FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Integral E2E';
  SELECT id INTO v_modal_60 FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Reduzida 60 a 99 E2E';
  SELECT id INTO v_modal_59 FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Reduzida abaixo de 59 E2E';
  SELECT id INTO v_modal_livre FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Modalidade livre para exclusão';
  PERFORM public.rpc_platform_configurar_modalidade_tipos(v_modal_integral,false,ARRAY[v_tipo]);
  PERFORM public.rpc_platform_configurar_modalidade_tipos(v_modal_60,false,ARRAY[v_tipo]);
  PERFORM public.rpc_platform_configurar_modalidade_tipos(v_modal_59,false,ARRAY[v_tipo]);

  SELECT (public.rpc_platform_salvar_curva_estorno(v_admin,'Curva E2E 083','Curva homologada sintética','HOMOLOGADA',current_date,NULL,
    '[{"mes":1,"percentual":80},{"mes":2,"percentual":60},{"mes":3,"percentual":40}]',false,ARRAY[v_tipo],false,ARRAY[v_modal_integral,v_modal_60,v_modal_59],NULL,false)->>'id')::uuid INTO v_curva;
  SELECT (public.rpc_platform_salvar_curva_estorno(v_admin,'Curva livre E2E','Descartável','RASCUNHO',current_date,NULL,
    '[{"mes":1,"percentual":100}]',true,'{}',true,'{}',NULL,false)->>'id')::uuid INTO v_curva_livre;

  INSERT INTO public.comissao_programas(empresa_id,nome,descricao,administradora_id,ativo,versao,status)
  VALUES(v_empresa,'Programa E2E 083','Programa sintético do isolado',v_admin,false,1,'RASCUNHO') RETURNING id INTO v_programa;
  INSERT INTO public.comissao_regras_franquia(empresa_id,programa_id,versao,percentual_total_comissao,base_calculo,vigencia_inicio,ativa,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id)
  VALUES
    (v_empresa,v_programa,1,3.5,'credito',current_date,true,false,'E2E_083',v_tipo,v_modal_integral),
    (v_empresa,v_programa,1,3.5,'credito',current_date,true,false,'E2E_083',v_tipo,v_modal_60),
    (v_empresa,v_programa,1,3.5,'credito',current_date,true,false,'E2E_083',v_tipo,v_modal_59);
  SELECT id INTO v_regra_integral FROM public.comissao_regras_franquia WHERE programa_id=v_programa AND modalidade_comissao_id=v_modal_integral;
  SELECT id INTO v_regra_60 FROM public.comissao_regras_franquia WHERE programa_id=v_programa AND modalidade_comissao_id=v_modal_60;
  SELECT id INTO v_regra_59 FROM public.comissao_regras_franquia WHERE programa_id=v_programa AND modalidade_comissao_id=v_modal_59;
  INSERT INTO public.comissao_regra_etapas(regra_franquia_id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda) VALUES
    (v_regra_integral,1,'MES_RELATIVO',1,'Integral 1',100),
    (v_regra_60,1,'MES_RELATIVO',1,'Reduzida 60–99 1',60),(v_regra_60,2,'MES_RELATIVO',2,'Reduzida 60–99 2',40),
    (v_regra_59,1,'MES_RELATIVO',1,'Abaixo 59 1',50),(v_regra_59,2,'CONTEMPLACAO',NULL,'Abaixo 59 contemplação',50);
  PERFORM public.rpc_platform_configurar_curva_regra(v_regra_integral,v_curva);
  PERFORM public.rpc_platform_configurar_curva_regra(v_regra_59,v_curva);
  -- v_regra_60 permanece propositalmente sem curva para comprovar opcionalidade.
  PERFORM public.rpc_platform_status_programa(v_programa,'ATIVO');

  SELECT (public.rpc_platform_salvar_modelo_comissao(v_admin,v_tipo,'Automóveis E2E 3,5%','Referência por modalidade',3.5,
    jsonb_build_array(
      jsonb_build_object('modalidade_id',v_modal_integral,'regra_id',v_regra_integral),
      jsonb_build_object('modalidade_id',v_modal_60,'regra_id',v_regra_60),
      jsonb_build_object('modalidade_id',v_modal_59,'regra_id',v_regra_59)
    ),NULL,false)->>'id')::uuid INTO v_modelo;
  PERFORM public.rpc_platform_status_modelo_comissao(v_modelo,'HOMOLOGADO');

  INSERT INTO public.grupos_consorcio(id,codigo_grupo,modalidade,administradora,administradora_id,tipo_administradora_id,origem_governanca,status_governanca,ativo)
  VALUES(v_grupo,'E2E-083','Catálogo E2E','Administradora E2E 083',v_admin,v_tipo,'GLOBAL','GLOBAL',true);
  INSERT INTO public.grupos_modalidades_disponiveis(grupo_id,administradora_modalidade_id,ativo,ordem,configuracao)
  VALUES(v_grupo,v_modal_integral,true,1,'{"origem":"E2E_083"}'),(v_grupo,v_modal_60,true,2,'{"origem":"E2E_083"}'),(v_grupo,v_modal_59,true,3,'{"origem":"E2E_083"}');
  INSERT INTO public.grupos_cotas(id,grupo_id,valor_credito,status,ativo,ordem) VALUES(v_produto,v_grupo,100000,'Disponível',true,1);
  INSERT INTO public.grupo_cota_modalidade_valores(grupo_cota_id,administradora_modalidade_id,valor_parcela,ativo,configuracao)
  VALUES(v_produto,v_modal_integral,2500,true,'{"origem":"E2E_083"}'),(v_produto,v_modal_60,1750,true,'{"origem":"E2E_083"}'),(v_produto,v_modal_59,1250,true,'{"origem":"E2E_083"}');

  -- Exclusões sem uso são permitidas.
  PERFORM public.rpc_platform_excluir_tipo_administradora(v_tipo_livre);
  PERFORM public.rpc_platform_excluir_modalidade_administradora(v_modal_livre);
  PERFORM public.rpc_platform_excluir_curva_estorno(v_curva_livre);

  -- Exclusões de itens utilizados são bloqueadas.
  BEGIN PERFORM public.rpc_platform_excluir_tipo_administradora(v_tipo);RAISE EXCEPTION 'FALHA_TESTE: Tipo usado excluído';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('dependências' IN SQLERRM)=0 THEN RAISE;END IF;END;
  BEGIN PERFORM public.rpc_platform_excluir_modalidade_administradora(v_modal_integral);RAISE EXCEPTION 'FALHA_TESTE: Modalidade usada excluída';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('dependências' IN SQLERRM)=0 THEN RAISE;END IF;END;
  BEGIN PERFORM public.rpc_platform_excluir_curva_estorno(v_curva);RAISE EXCEPTION 'FALHA_TESTE: Curva usada excluída';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('dependências' IN SQLERRM)=0 THEN RAISE;END IF;END;
  BEGIN PERFORM public.rpc_platform_excluir_programa(v_programa);RAISE EXCEPTION 'FALHA_TESTE: Programa homologado excluído';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('dependências' IN SQLERRM)=0 THEN RAISE;END IF;END;

  SELECT count(*) INTO v_count FROM public.administradora_modalidade_tipos WHERE tipo_id=v_tipo;
  IF v_count<>3 THEN RAISE EXCEPTION 'E2E 083 não persistiu três vínculos Modalidade→Tipo';END IF;
  SELECT count(*) INTO v_count FROM public.administradora_modelo_modalidades WHERE modelo_id=v_modelo AND regra_franquia_origem_id IS NOT NULL;
  IF v_count<>3 THEN RAISE EXCEPTION 'E2E 083 não persistiu três referências canônicas do Modelo Master';END IF;
  IF NOT EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE id=v_regra_60 AND curva_estorno_id IS NULL)
     OR NOT EXISTS(SELECT 1 FROM public.comissao_regras_franquia WHERE id=v_regra_integral AND curva_estorno_id=v_curva)
  THEN RAISE EXCEPTION 'E2E 083 não preservou Curva opcional por Regra';END IF;
END $$;

COMMIT;

-- Evidência de reload/persistência e Racon no clone isolado.
SELECT a.nome,t.nome AS tipo,m.nome AS modalidade,mm.nome AS modelo,mm.percentual_total_referencia,mm.status
FROM public.administradoras a
JOIN public.administradora_tipos t ON t.administradora_id=a.id
JOIN public.administradora_modelos_comissao mm ON mm.tipo_id=t.id
JOIN public.administradora_modelo_modalidades mmm ON mmm.modelo_id=mm.id
JOIN public.administradora_modalidades_comissao m ON m.id=mmm.modalidade_id
WHERE a.nome='Administradora E2E 083' ORDER BY m.nome;

DO $$ DECLARE v_racon uuid;v_count integer;BEGIN
  SELECT id INTO v_racon FROM public.administradoras WHERE slug='racon';
  IF v_racon IS NULL THEN RAISE EXCEPTION 'Racon ausente no clone isolado';END IF;
  SELECT count(*) INTO v_count FROM public.administradora_tipos WHERE administradora_id=v_racon AND ativo AND codigo IN('IMOVEL','AUTOMOVEIS');
  IF v_count<>2 THEN RAISE EXCEPTION 'Racon não possui exatamente Imóvel e Automóveis canônicos ativos esperados';END IF;
  SELECT count(*) INTO v_count FROM public.administradora_modalidades_comissao WHERE administradora_id=v_racon AND ativo AND codigo IN('INTEGRAL','REDUZIDA_60_99','REDUZIDA_ABAIXO_59');
  IF v_count<>3 THEN RAISE EXCEPTION 'Racon não possui as três Modalidades canônicas esperadas';END IF;

  -- RBAC real: identidade sem papel Platform não pode mutar o catálogo.
  PERFORM set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  BEGIN
    PERFORM public.rpc_platform_salvar_administradora(NULL,'E2E RBAC NÃO DEVE PERSISTIR',NULL,'ATIVA',NULL);
    RAISE EXCEPTION 'FALHA_TESTE: RPC aceitou identidade sem papel Platform';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('Somente Platform Superadmin' IN SQLERRM)=0 THEN RAISE;END IF;
  END;
END $$;
