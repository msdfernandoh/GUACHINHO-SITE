-- Migration: 308_central_robos_importacao.sql
-- Implantação do Modelo de Robô de Importação Multiportal (Playwright + Daemon + Mapeamento de Tarefas)
-- Compatível com o SAAS Gauchinho Consórcios (https://admin.gauchinhoconsorcios.com.br/)

BEGIN;

-- 1. Tabela de Configurações dos Robôs
CREATE TABLE IF NOT EXISTS public.robo_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  administradora_id uuid REFERENCES public.administradoras(id) ON DELETE SET NULL,
  nome text NOT NULL,
  portal_tipo text NOT NULL DEFAULT 'RACON',
  site_url text NOT NULL,
  login_url text NOT NULL,
  usuario_login text NOT NULL,
  senha_encrypted text,
  senha_updated_at timestamptz,
  senha_secundaria_encrypted text,
  senha_secundaria_updated_at timestamptz,
  ativo boolean NOT NULL DEFAULT false,
  modo text NOT NULL DEFAULT 'DRY_RUN' CHECK (modo IN ('DRY_RUN', 'PRODUCAO')),
  configuracao_tarefas jsonb DEFAULT '{}'::jsonb,
  unidades_config jsonb DEFAULT '[]'::jsonb,
  ultima_execucao_em timestamptz,
  ultimo_sucesso_em timestamptz,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.robo_configuracoes IS
  'Configurações dos robôs Playwright de importação de dados e relatórios das administradoras (credenciais cifradas server-side AES-256-GCM)';

CREATE INDEX IF NOT EXISTS idx_robo_config_empresa ON public.robo_configuracoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_robo_config_admin ON public.robo_configuracoes(administradora_id);
CREATE INDEX IF NOT EXISTS idx_robo_config_portal_tipo ON public.robo_configuracoes(portal_tipo);
CREATE INDEX IF NOT EXISTS idx_robo_config_ativo ON public.robo_configuracoes(ativo);

-- 2. Tabela de Histórico e Fila de Execuções dos Robôs
CREATE TABLE IF NOT EXISTS public.robo_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  robo_id text,
  robo_config_id uuid NOT NULL REFERENCES public.robo_configuracoes(id) ON DELETE CASCADE,
  portal_tipo text NOT NULL DEFAULT 'RACON',
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PROCESSANDO', 'SUCESSO', 'JA_IMPORTADO', 'ERRO', 'CANCELADO')),
  origem text NOT NULL DEFAULT 'UI_MANUAL' CHECK (origem IN ('UI_MANUAL', 'CRON_TERMINAL', 'GITHUB_ACTIONS', 'CLI_DIRETO')),
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  resultado jsonb,
  erro_mensagem text,
  erro_sanitizado text,
  logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  worker_id text,
  heartbeat_em timestamptz,
  iniciado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  dry_run boolean NOT NULL DEFAULT true,
  arquivo_nome text,
  arquivo_hash text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.robo_execucoes IS
  'Histórico de execuções automatizadas, filas e auditoria de tarefas do Robô de Importação';

CREATE INDEX IF NOT EXISTS idx_robo_exec_config_id ON public.robo_execucoes(robo_config_id);
CREATE INDEX IF NOT EXISTS idx_robo_exec_empresa ON public.robo_execucoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_robo_exec_status_criado ON public.robo_execucoes(status, criado_em);
CREATE INDEX IF NOT EXISTS idx_robo_exec_iniciado_em ON public.robo_execucoes(iniciado_em DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_robo_exec_agendamento_unico
  ON public.robo_execucoes ((detalhes->>'agendamento_chave'))
  WHERE detalhes->>'agendamento_chave' IS NOT NULL;

-- 3. Tabela de Sessões de Mapeamento Guiado (Traces, Vídeos e Screenshots de Descoberta)
CREATE TABLE IF NOT EXISTS public.robo_mapeamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  robo_config_id uuid NOT NULL REFERENCES public.robo_configuracoes(id) ON DELETE CASCADE,
  iniciado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  status text NOT NULL DEFAULT 'AGUARDANDO' CHECK (status IN ('AGUARDANDO', 'AUTENTICANDO', 'MAPEANDO', 'CONCLUIDO', 'ERRO', 'INTERVENCAO_HUMANA')),
  trace_storage_path text,
  video_storage_path text,
  screenshots jsonb DEFAULT '[]'::jsonb,
  detalhes jsonb DEFAULT '{}'::jsonb,
  erro_sanitizado text
);

COMMENT ON TABLE public.robo_mapeamentos IS
  'Sessões de mapeamento guiado de portais externos com armazenamento de trace e vídeo pós-login';

CREATE INDEX IF NOT EXISTS idx_robo_map_config_id ON public.robo_mapeamentos(robo_config_id);

-- 4. Tabela de Lease para Coordenação Atômica de Runners / Workers
CREATE TABLE IF NOT EXISTS public.robo_runner_lease (
  chave text PRIMARY KEY,
  dono uuid NOT NULL,
  expira_em timestamptz NOT NULL
);

-- 5. Funções RPC de Coordenação e Fila com FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.robo_runner_adquirir(p_dono uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_dono uuid;
BEGIN
  INSERT INTO public.robo_runner_lease(chave, dono, expira_em)
  VALUES ('principal', p_dono, now() + interval '90 seconds')
  ON CONFLICT (chave) DO UPDATE
    SET dono = excluded.dono, expira_em = excluded.expira_em
    WHERE robo_runner_lease.expira_em < now() OR robo_runner_lease.dono = p_dono
  RETURNING dono INTO v_dono;
  RETURN v_dono IS NOT NULL;
END $$;

CREATE OR REPLACE FUNCTION public.robo_runner_liberar(p_dono uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public AS $$
  DELETE FROM public.robo_runner_lease WHERE chave = 'principal' AND dono = p_dono;
$$;

CREATE OR REPLACE FUNCTION public.reivindicar_proxima_execucao_robo(
  p_worker_id text,
  p_robo_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  empresa_id uuid,
  robo_id text,
  robo_config_id uuid,
  portal_tipo text,
  status text,
  origem text,
  parametros jsonb,
  resultado jsonb,
  erro_mensagem text,
  logs jsonb,
  worker_id text,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  criado_em timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT r.id INTO v_id
  FROM public.robo_execucoes r
  WHERE r.status = 'PENDENTE'
    AND (p_robo_id IS NULL OR r.robo_id = p_robo_id OR r.robo_config_id::text = p_robo_id)
  ORDER BY r.criado_em ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NOT NULL THEN
    UPDATE public.robo_execucoes
    SET status = 'PROCESSANDO',
        worker_id = p_worker_id,
        iniciado_em = coalesce(public.robo_execucoes.iniciado_em, now()),
        heartbeat_em = now(),
        updated_at = now()
    WHERE public.robo_execucoes.id = v_id;

    RETURN QUERY
    SELECT r.id, r.empresa_id, r.robo_id, r.robo_config_id, r.portal_tipo, r.status, r.origem,
           r.parametros, r.resultado, r.erro_mensagem, r.logs, r.worker_id,
           r.iniciado_em, r.finalizado_em, r.criado_em
    FROM public.robo_execucoes r
    WHERE r.id = v_id;
  END IF;

  RETURN;
END;
$$;

-- Permissões de execução para RPC
REVOKE ALL ON FUNCTION public.robo_runner_adquirir(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.robo_runner_liberar(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.reivindicar_proxima_execucao_robo(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.robo_runner_adquirir(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.robo_runner_liberar(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reivindicar_proxima_execucao_robo(text, text) TO authenticated, service_role;

-- 6. Row Level Security (RLS)
ALTER TABLE public.robo_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robo_execucoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robo_mapeamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.robo_runner_lease ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso livre robo_configuracoes authenticated e service_role"
  ON public.robo_configuracoes FOR ALL TO authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Acesso livre robo_execucoes authenticated e service_role"
  ON public.robo_execucoes FOR ALL TO authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Acesso livre robo_mapeamentos authenticated e service_role"
  ON public.robo_mapeamentos FOR ALL TO authenticated, service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Acesso service_role robo_runner_lease"
  ON public.robo_runner_lease FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Registro no controle de versões Supabase
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('308', 'central_robos_importacao', ARRAY['308_central_robos_importacao.sql'])
ON CONFLICT (version) DO UPDATE
  SET name = EXCLUDED.name, statements = EXCLUDED.statements;

COMMIT;
