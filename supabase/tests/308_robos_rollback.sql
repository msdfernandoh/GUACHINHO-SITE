-- Teste de validação e rollback da Migration 308 (Central de Robôs de Importação)
-- Executar em transação com ROLLBACK para validação de integridade.

BEGIN;

DO $$
DECLARE
  v_empresa_id uuid;
  v_admin_id uuid;
  v_robo_id uuid;
  v_exec_id uuid;
  v_map_id uuid;
  v_adquirido boolean;
  v_reivindicado record;
BEGIN
  -- 1. Verifica presença das tabelas e índices
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'robo_configuracoes') THEN
    RAISE EXCEPTION 'Tabela robo_configuracoes não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'robo_execucoes') THEN
    RAISE EXCEPTION 'Tabela robo_execucoes não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'robo_mapeamentos') THEN
    RAISE EXCEPTION 'Tabela robo_mapeamentos não encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'robo_runner_lease') THEN
    RAISE EXCEPTION 'Tabela robo_runner_lease não encontrada';
  END IF;

  -- 2. Seleciona dados canônicos para teste
  SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;
  SELECT id INTO v_admin_id FROM public.administradoras LIMIT 1;

  -- 3. Inserção de configuração de robô
  INSERT INTO public.robo_configuracoes (
    empresa_id, administradora_id, nome, portal_tipo, site_url, login_url,
    usuario_login, senha_encrypted, ativo, modo
  ) VALUES (
    v_empresa_id, v_admin_id, 'Robô Teste Validação 308', 'RACON',
    'https://portal.racon.com.br', 'https://portal.racon.com.br/login',
    'usuario_teste', '12:34:56', true, 'DRY_RUN'
  ) RETURNING id INTO v_robo_id;

  -- 4. Inserção de execução pendente
  INSERT INTO public.robo_execucoes (
    empresa_id, robo_config_id, portal_tipo, status, origem, dry_run, detalhes
  ) VALUES (
    v_empresa_id, v_robo_id, 'RACON', 'PENDENTE', 'UI_MANUAL', true,
    jsonb_build_object('agendamento_chave', '2026-10-18-04H-teste-308')
  ) RETURNING id INTO v_exec_id;

  -- 5. Teste de lease do runner
  v_adquirido := public.robo_runner_adquirir(gen_random_uuid());
  IF NOT v_adquirido THEN
    RAISE EXCEPTION 'Falha ao adquirir lease do runner';
  END IF;

  -- 6. Teste de reivindicação atômica com lock SKIP LOCKED
  SELECT * INTO v_reivindicado FROM public.reivindicar_proxima_execucao_robo('worker-teste-308', v_robo_id::text);
  IF v_reivindicado.id IS NULL OR v_reivindicado.status <> 'PROCESSANDO' THEN
    RAISE EXCEPTION 'Falha ao reivindicar execução com status PROCESSANDO';
  END IF;

  -- 7. Teste de liberação do lease
  PERFORM public.robo_runner_liberar(v_reivindicado.id);

  -- 8. Teste de mapeamento de tela
  INSERT INTO public.robo_mapeamentos (
    empresa_id, robo_config_id, status, detalhes
  ) VALUES (
    v_empresa_id, v_robo_id, 'AGUARDANDO', jsonb_build_object('url', 'https://portal.racon.com.br')
  ) RETURNING id INTO v_map_id;

  RAISE NOTICE 'Validação da Migration 308 concluída com sucesso.';
END $$;

ROLLBACK;
