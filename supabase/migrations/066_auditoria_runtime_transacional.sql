-- Auditoria central de fatos críticos. Os eventos são inseridos na mesma
-- transação do registro de negócio; falha de auditoria faz a operação falhar.
BEGIN;

ALTER TABLE public.audit_logs_central
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'runtime',
  ADD COLUMN IF NOT EXISTS resultado text NOT NULL DEFAULT 'SUCESSO';

CREATE OR REPLACE FUNCTION public.registrar_auditoria_runtime()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  v_row jsonb;
  v_old jsonb;
  v_empresa_id uuid;
  v_entidade_id uuid;
  v_usuario_id uuid;
  v_correlation_id text;
  v_headers jsonb;
  v_changed_fields jsonb := '[]'::jsonb;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;

  IF TG_ARGV[0] = 'id' THEN
    v_empresa_id := NULLIF(v_row ->> 'id', '')::uuid;
  ELSE
    v_empresa_id := NULLIF(v_row ->> TG_ARGV[0], '')::uuid;
  END IF;

  -- Linhas legadas sem tenant não podem bloquear o fluxo; ficam fora da
  -- tabela central, que por contrato exige empresa_id.
  IF v_empresa_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_entidade_id := NULLIF(v_row ->> 'id', '')::uuid;
  SELECT u.id INTO v_usuario_id
  FROM public.usuarios AS u
  WHERE u.auth_user_id = auth.uid()
  LIMIT 1;

  v_headers := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_correlation_id := COALESCE(
    NULLIF(v_headers ->> 'x-correlation-id', ''),
    NULLIF(v_headers ->> 'x-request-id', '')
  );

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_agg(k ORDER BY k), '[]'::jsonb)
      INTO v_changed_fields
      FROM jsonb_each(v_row) AS e(k, v)
     WHERE v IS DISTINCT FROM v_old -> k;
  END IF;

  INSERT INTO public.audit_logs_central (
    empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id,
    detalhes, correlation_id, origem, resultado
  ) VALUES (
    v_empresa_id,
    v_usuario_id,
    TG_ARGV[1],
    lower(TG_OP),
    TG_TABLE_NAME,
    v_entidade_id,
    jsonb_build_object(
      'event_type', TG_ARGV[1] || '.' || lower(TG_OP),
      'target_type', TG_TABLE_NAME,
      'target_id', v_entidade_id,
      'changed_fields', v_changed_fields
    ),
    v_correlation_id,
    'database_trigger',
    'SUCESSO'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Tabelas com empresa_id próprio: histórico comercial, comissão, financeiro,
-- gestão, auditoria de configuração comercial e ações do tenant.
DO $$
DECLARE
  v_table text;
  v_modulo text;
BEGIN
  FOR v_table, v_modulo IN
    SELECT * FROM (VALUES
      ('empresas', 'tenant'),
      ('empresa_administradoras', 'administradora'),
      ('propostas', 'proposta'),
      ('contratacoes_online', 'contratacao'),
      ('vendas', 'venda'),
      ('cotas_definitivas', 'cota_definitiva'),
      ('comissao_programas', 'comissao_programa'),
      ('comissao_regras_franquia', 'comissao_regra_franquia'),
      ('comissao_regras_participantes', 'comissao_regra_participante'),
      ('comissao_previsoes_franquia', 'comissao_previsao_franquia'),
      ('comissao_previsoes_participantes', 'comissao_previsao_participante'),
      ('financeiro_recebimentos', 'financeiro_recebimento'),
      ('financeiro_pagamentos', 'financeiro_pagamento'),
      ('financeiro_compensacoes', 'financeiro_compensacao'),
      ('financeiro_estornos', 'financeiro_estorno'),
      ('financeiro_compensacao_movimentos', 'financeiro_compensacao_movimento'),
      ('caixa_movimentos', 'caixa_movimento'),
      ('equipes', 'equipe'),
      ('metas_comerciais', 'meta_comercial'),
      ('tarefas_gestao', 'tarefa_gestao')
    ) AS x(table_name, modulo)
  LOOP
    IF to_regclass('public.' || v_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_auditoria_runtime ON public.%I', v_table);
      EXECUTE format(
        'CREATE TRIGGER trg_auditoria_runtime AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_auditoria_runtime(%L, %L)',
        v_table,
        CASE WHEN v_table = 'empresas' THEN 'id' ELSE 'empresa_id' END,
        v_modulo
      );
    END IF;
  END LOOP;
END
$$;

COMMIT;
