-- Teste E2E da Fase 085: Catálogo Operacional de Grupos, Cotas em Lote e Overrides de Modalidades
BEGIN;

DO $$
DECLARE
  v_admin_id UUID;
  v_tipo_id UUID;
  v_mod_integral_id UUID;
  v_mod_red_id UUID;
  v_grupo_id UUID;
  v_cota_id UUID;
  v_resultado JSONB;
BEGIN
  -- 1. Setup Administradora, Tipo e Modalidades de teste
  INSERT INTO public.administradoras (nome, status)
  VALUES ('ADMIN E2E 085', 'ATIVA')
  RETURNING id INTO v_admin_id;

  INSERT INTO public.administradora_tipos (administradora_id, nome, codigo, ativo)
  VALUES (v_admin_id, 'Imóvel E2E', 'IMOVEL_085', true)
  RETURNING id INTO v_tipo_id;

  INSERT INTO public.administradora_modalidades_comissao (administradora_id, nome, codigo, ativo)
  VALUES (v_admin_id, 'Integral', 'INTEGRAL_085', true)
  RETURNING id INTO v_mod_integral_id;

  INSERT INTO public.administradora_modalidades_comissao (administradora_id, nome, codigo, ativo)
  VALUES (v_admin_id, 'Reduzida 70%', 'RED_70_085', true)
  RETURNING id INTO v_mod_red_id;

  -- 2. Testar RPC: Salvar Grupo
  v_resultado := public.rpc_platform_salvar_grupo(
    p_id := NULL,
    p_administradora_id := v_admin_id,
    p_tipo_administradora_id := v_tipo_id,
    p_codigo_grupo := 'GRP-085-TEST',
    p_status := 'Disponível',
    p_ativo := true,
    p_prazo_total := 200,
    p_taxa_administrativa := 17.5,
    p_fundo_reserva := 2.0,
    p_seguro_percentual := 0.045,
    p_capacidade_total := 1000,
    p_vagas_disponiveis := 120,
    p_permite_lance_embutido := true,
    p_percentual_lance_embutido := 30,
    p_observacoes := 'Grupo de teste E2E'
  );
  v_grupo_id := (v_resultado->>'id')::UUID;
  ASSERT v_grupo_id IS NOT NULL, 'Falha ao criar grupo via RPC';

  -- 3. Testar RPC: Configurar Modalidades no Grupo
  PERFORM public.rpc_platform_configurar_modalidades_grupo(
    p_grupo_id := v_grupo_id,
    p_modalidades_config := jsonb_build_array(
      jsonb_build_object('modalidade_id', v_mod_integral_id, 'ativo', true, 'configuracao', jsonb_build_object('modo_reduzido', 'fixo')),
      jsonb_build_object('modalidade_id', v_mod_red_id, 'ativo', true, 'configuracao', jsonb_build_object('modo_reduzido', 'personalizado', 'percentual_padrao', 70))
    )
  );

  -- 4. Testar RPC: Salvar Cotas em Lote
  v_resultado := public.rpc_platform_salvar_cotas_lote(
    p_grupo_id := v_grupo_id,
    p_valores_credito := ARRAY[150000.00, 100000.00, 80000.00]
  );
  ASSERT (v_resultado->>'inseridos')::INT = 3, 'Deveria ter inserido 3 cotas em lote';

  -- Obter uma cota para teste de override
  SELECT id INTO v_cota_id FROM public.grupos_cotas WHERE grupo_id = v_grupo_id AND valor_credito = 100000.00 LIMIT 1;
  ASSERT v_cota_id IS NOT NULL, 'Cota 100.000 não encontrada';

  -- 5. Testar RPC: Salvar Override de Cota
  PERFORM public.rpc_platform_salvar_cota_modalidade(
    p_grupo_cota_id := v_cota_id,
    p_modalidade_id := v_mod_red_id,
    p_valor_parcela := 750.00,
    p_habilitado := true,
    p_modo_reduzido := 'personalizado',
    p_percentual_reducao := 70.0
  );

  -- 6. Testar RPC: Salvar Estatísticas e Histórico
  PERFORM public.rpc_platform_salvar_estatisticas_grupo(
    p_grupo_id := v_grupo_id,
    p_empresa_id := NULL,
    p_fonte := 'GLOBAL',
    p_dados_estatisticos := jsonb_build_object(
      'contemplacoes_sorteio_qtd', 2,
      'lance_livre_medio', 48.5,
      'lance_embutido_25_permitido', true
    ),
    p_vagas_disponiveis := 115,
    p_usar_dados_globais := true
  );

  -- Verificar se o histórico auditado foi gravado
  ASSERT EXISTS (
    SELECT 1 FROM public.grupo_estatisticas_historico
    WHERE grupo_id = v_grupo_id AND campo = 'dados_estatisticos'
  ), 'Histórico de estatísticas não gravado';

  -- 7. Testar Exclusão/Inativação de Cota
  v_resultado := public.rpc_platform_excluir_cota_produto(p_grupo_cota_id := v_cota_id);
  ASSERT v_resultado->>'acao' IN ('EXCLUIDO', 'INATIVADO'), 'Falha ao excluir/inativar cota';

  RAISE NOTICE 'E2E Phase 085 passou com sucesso!';
END $$;

ROLLBACK;

