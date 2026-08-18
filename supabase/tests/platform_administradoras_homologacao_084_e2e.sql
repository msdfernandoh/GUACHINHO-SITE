-- E2E da migration 084: Homologação e Versionamento de Programas da Franqueadora.
-- Executar em ambiente isolado. Não altera dados de produção.
BEGIN;

DO $$
DECLARE
  v_auth uuid;
  v_empresa uuid;
  v_admin uuid;
  v_tipo_auto uuid;
  v_tipo_imovel uuid;
  v_modal_integral uuid;
  v_modal_60 uuid;
  v_modal_59 uuid;
  v_programa_v1 uuid;
  v_programa_v2 uuid;
  v_programa_invalido uuid;
  v_regra_integral uuid;
  v_regra_60 uuid;
  v_regra_59 uuid;
  v_regra_inv uuid;
  v_curva uuid;
  v_count integer;
BEGIN
  -- 1. Autenticação como Platform Superadmin
  SELECT u.auth_user_id INTO v_auth
  FROM public.usuarios u
  JOIN public.empresa_usuarios eu ON eu.usuario_id=u.id AND eu.ativo
  JOIN public.papeis p ON p.id=eu.papel_id
  WHERE p.codigo='super_admin' AND p.escopo='PLATFORM' AND p.empresa_id IS NULL
  LIMIT 1;
  IF v_auth IS NULL THEN RAISE EXCEPTION 'E2E 084 exige Platform Superadmin existente'; END IF;
  PERFORM set_config('request.jwt.claim.sub', v_auth::text, true);

  -- 2. Tenant Gauchinho
  SELECT id INTO v_empresa FROM public.empresas WHERE slug='gauchinho' LIMIT 1;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'E2E 084 exige tenant Gauchinho'; END IF;

  -- 3. Catálogo sintético para testes isolados
  SELECT (public.rpc_platform_salvar_administradora(NULL, 'Administradora E2E 084', 'E2E 084', 'ATIVA', 'Catálogo de validação 084')->>'id')::uuid INTO v_admin;
  
  PERFORM public.rpc_salvar_tipo_administradora(v_admin, 'Automóveis E2E 084', true, NULL);
  PERFORM public.rpc_salvar_tipo_administradora(v_admin, 'Imóvel E2E 084', true, NULL);
  SELECT id INTO v_tipo_auto FROM public.administradora_tipos WHERE administradora_id=v_admin AND nome='Automóveis E2E 084';
  SELECT id INTO v_tipo_imovel FROM public.administradora_tipos WHERE administradora_id=v_admin AND nome='Imóvel E2E 084';

  PERFORM public.rpc_salvar_modalidade_administradora(v_admin, 'Integral E2E 084', 'Integral 084', true, NULL);
  PERFORM public.rpc_salvar_modalidade_administradora(v_admin, 'Reduzida 60 a 99 E2E 084', 'Reduzida 60 a 99', true, NULL);
  PERFORM public.rpc_salvar_modalidade_administradora(v_admin, 'Reduzida abaixo de 59 E2E 084', 'Reduzida < 59', true, NULL);
  SELECT id INTO v_modal_integral FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Integral E2E 084';
  SELECT id INTO v_modal_60 FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Reduzida 60 a 99 E2E 084';
  SELECT id INTO v_modal_59 FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin AND nome='Reduzida abaixo de 59 E2E 084';

  SELECT (public.rpc_platform_salvar_curva_estorno(v_admin, 'Curva E2E 084', 'Curva 084', 'HOMOLOGADA', current_date, NULL,
    '[{"mes":1,"percentual":80},{"mes":2,"percentual":50}]', true, '{}', true, '{}', NULL, false)->>'id')::uuid INTO v_curva;

  -- 4. Criar Programa v1 em Rascunho com 3 modalidades canônicas
  INSERT INTO public.comissao_programas(empresa_id, nome, descricao, administradora_id, ativo, versao, status)
  VALUES(v_empresa, 'Programa Automóveis E2E 084', 'Validação 084', v_admin, false, 1, 'RASCUNHO')
  RETURNING id INTO v_programa_v1;

  -- A) Automóveis Integral: 3,5% com 9 parcelas de repasse somando 3,50%
  INSERT INTO public.comissao_regras_franquia(empresa_id, programa_id, versao, percentual_total_comissao, base_calculo, vigencia_inicio, ativa, configuracao_homologada, origem_configuracao, tipo_administradora_id, modalidade_comissao_id)
  VALUES(v_empresa, v_programa_v1, 1, 3.5, 'credito', current_date, false, false, 'E2E_084', v_tipo_auto, v_modal_integral)
  RETURNING id INTO v_regra_integral;

  INSERT INTO public.comissao_regra_etapas(regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda) VALUES
    (v_regra_integral, 1, 'PARCELA', 1, '1ª Parcela', 0.50),
    (v_regra_integral, 2, 'PARCELA', 2, '2ª Parcela', 0.25),
    (v_regra_integral, 3, 'PARCELA', 3, '3ª Parcela', 0.50),
    (v_regra_integral, 4, 'PARCELA', 4, '4ª Parcela', 0.50),
    (v_regra_integral, 5, 'PARCELA', 5, '5ª Parcela', 0.25),
    (v_regra_integral, 6, 'PARCELA', 6, '6ª Parcela', 0.25),
    (v_regra_integral, 7, 'PARCELA', 7, '7ª Parcela', 0.50),
    (v_regra_integral, 8, 'PARCELA', 8, '8ª Parcela', 0.25),
    (v_regra_integral, 9, 'PARCELA', 9, '9ª Parcela', 0.50);

  -- B) Automóveis Reduzida 60 a 99: 3,5% com 2 parcelas (2,0% + 1,5% = 3,50%)
  INSERT INTO public.comissao_regras_franquia(empresa_id, programa_id, versao, percentual_total_comissao, base_calculo, vigencia_inicio, ativa, configuracao_homologada, origem_configuracao, tipo_administradora_id, modalidade_comissao_id)
  VALUES(v_empresa, v_programa_v1, 1, 3.5, 'credito', current_date, false, false, 'E2E_084', v_tipo_auto, v_modal_60)
  RETURNING id INTO v_regra_60;

  INSERT INTO public.comissao_regra_etapas(regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda) VALUES
    (v_regra_60, 1, 'PARCELA', 1, 'Parcela 1', 2.00),
    (v_regra_60, 2, 'PARCELA', 2, 'Parcela 2', 1.50);

  -- C) Automóveis Reduzida abaixo de 59: 3,5% (2,25% parcelas + 1,25% contemplação = 3,50%)
  INSERT INTO public.comissao_regras_franquia(empresa_id, programa_id, versao, percentual_total_comissao, base_calculo, vigencia_inicio, ativa, configuracao_homologada, origem_configuracao, tipo_administradora_id, modalidade_comissao_id, curva_estorno_id)
  VALUES(v_empresa, v_programa_v1, 1, 3.5, 'credito', current_date, false, false, 'E2E_084', v_tipo_auto, v_modal_59, v_curva)
  RETURNING id INTO v_regra_59;

  INSERT INTO public.comissao_regra_etapas(regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda) VALUES
    (v_regra_59, 1, 'PARCELA', 1, 'Mensal 1', 1.25),
    (v_regra_59, 2, 'PARCELA', 2, 'Mensal 2', 1.00),
    (v_regra_59, 3, 'CONTEMPLACAO', NULL, 'Contemplação', 1.25);

  -- 5. HOMOLOGAÇÃO COM SUCESSO DO PROGRAMA V1 (validação fecha em 3,50%, não em 100%)
  PERFORM public.rpc_platform_status_programa(v_programa_v1, 'ATIVO');

  -- Validar que o programa e todas as suas regras foram homologados
  SELECT count(*) INTO v_count FROM public.comissao_programas WHERE id=v_programa_v1 AND status='ATIVO' AND ativo=true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FALHA_TESTE: Programa v1 não foi ativado após homologação'; END IF;

  SELECT count(*) INTO v_count FROM public.comissao_regras_franquia WHERE programa_id=v_programa_v1 AND configuracao_homologada=true AND ativa=true;
  IF v_count <> 3 THEN RAISE EXCEPTION 'FALHA_TESTE: Regras do Programa v1 não foram marcadas como homologadas'; END IF;

  -- 6. TESTE DE BLOQUEIO PARA CRONOGRAMA INCOMPLETO (3,5% com cronograma somando 3,25%)
  INSERT INTO public.comissao_programas(empresa_id, nome, descricao, administradora_id, ativo, versao, status)
  VALUES(v_empresa, 'Programa Inválido E2E 084', 'Teste de bloqueio', v_admin, false, 1, 'RASCUNHO')
  RETURNING id INTO v_programa_invalido;

  INSERT INTO public.comissao_regras_franquia(empresa_id, programa_id, versao, percentual_total_comissao, base_calculo, vigencia_inicio, ativa, configuracao_homologada, origem_configuracao, tipo_administradora_id, modalidade_comissao_id)
  VALUES(v_empresa, v_programa_invalido, 1, 3.5, 'credito', current_date, false, false, 'E2E_084', v_tipo_imovel, v_modal_integral)
  RETURNING id INTO v_regra_inv;

  INSERT INTO public.comissao_regra_etapas(regra_franquia_id, ordem, tipo_gatilho, mes_relativo, nome, percentual_venda) VALUES
    (v_regra_inv, 1, 'PARCELA', 1, 'Etapa 1', 2.00),
    (v_regra_inv, 2, 'PARCELA', 2, 'Etapa 2', 1.25); -- Soma 3,25 != 3,50

  BEGIN
    PERFORM public.rpc_platform_status_programa(v_programa_invalido, 'ATIVO');
    RAISE EXCEPTION 'FALHA_TESTE: Homologação aceitou cronograma incompleto (3,25%% de 3,50%%)';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('cronograma soma' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- Limpar programa inválido de teste
  DELETE FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_regra_inv;
  DELETE FROM public.comissao_regras_franquia WHERE id=v_regra_inv;
  DELETE FROM public.comissao_programas WHERE id=v_programa_invalido;

  -- 7. TESTE DE VERSIONAMENTO
  -- A) Criar nova versão a partir do v1 homologado
  SELECT (public.rpc_platform_nova_versao_programa(v_programa_v1)->>'id')::uuid INTO v_programa_v2;

  -- Validar que v1 virou SUBSTITUIDO
  SELECT count(*) INTO v_count FROM public.comissao_programas WHERE id=v_programa_v1 AND status='SUBSTITUIDO' AND ativo=false;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FALHA_TESTE: Programa v1 não foi marcado como SUBSTITUIDO'; END IF;

  -- Validar que v2 foi criado em RASCUNHO com versão 2 e apontando para v1
  SELECT count(*) INTO v_count FROM public.comissao_programas WHERE id=v_programa_v2 AND versao=2 AND status='RASCUNHO' AND programa_origem_id=v_programa_v1;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FALHA_TESTE: Programa v2 não foi criado corretamente em Rascunho'; END IF;

  -- Validar que v2 copiou as 3 regras e todas as etapas
  SELECT count(*) INTO v_count FROM public.comissao_regras_franquia WHERE programa_id=v_programa_v2 AND versao=2 AND configuracao_homologada=false;
  IF v_count <> 3 THEN RAISE EXCEPTION 'FALHA_TESTE: Regras não foram copiadas para v2 em rascunho'; END IF;

  SELECT count(*) INTO v_count FROM public.comissao_regra_etapas WHERE regra_franquia_id IN (SELECT id FROM public.comissao_regras_franquia WHERE programa_id=v_programa_v2);
  IF v_count <> (9 + 2 + 3) THEN RAISE EXCEPTION 'FALHA_TESTE: Etapas do cronograma não foram copiadas integralmente para v2'; END IF;

  -- B) Tentar criar nova versão a partir de um RASCUNHO (deve ser bloqueado)
  BEGIN
    PERFORM public.rpc_platform_nova_versao_programa(v_programa_v2);
    RAISE EXCEPTION 'FALHA_TESTE: RPC permitiu criar nova versão a partir de RASCUNHO';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('rascunho pode ser editada' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- C) Tentar criar nova versão a partir de um SUBSTITUIDO (deve ser bloqueado)
  BEGIN
    PERFORM public.rpc_platform_nova_versao_programa(v_programa_v1);
    RAISE EXCEPTION 'FALHA_TESTE: RPC permitiu criar nova versão a partir de SUBSTITUIDO';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE 'FALHA_TESTE:%' OR position('já substituída' IN SQLERRM)=0 THEN RAISE; END IF;
  END;

  -- D) Homologar v2
  PERFORM public.rpc_platform_status_programa(v_programa_v2, 'ATIVO');
  SELECT count(*) INTO v_count FROM public.comissao_programas WHERE id=v_programa_v2 AND status='ATIVO' AND ativo=true;
  IF v_count <> 1 THEN RAISE EXCEPTION 'FALHA_TESTE: Programa v2 não foi ativado após homologação'; END IF;

END $$;

COMMIT;
