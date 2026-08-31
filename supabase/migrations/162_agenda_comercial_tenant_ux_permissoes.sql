-- Fase 162 - Agenda comercial tenant-aware, autorizacao granular e conclusao atomica.

BEGIN;

ALTER TABLE public.agenda_compromissos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concluido_at timestamptz;

UPDATE public.agenda_compromissos a
SET empresa_id = l.empresa_id
FROM public.leads l
WHERE a.empresa_id IS NULL
  AND a.lead_id = l.id
  AND l.empresa_id IS NOT NULL;

WITH vinculo_unico AS (
  SELECT eu.usuario_id, min(eu.empresa_id::text)::uuid AS empresa_id
  FROM public.empresa_usuarios eu
  WHERE eu.ativo = true
  GROUP BY eu.usuario_id
  HAVING count(DISTINCT eu.empresa_id) = 1
)
UPDATE public.agenda_compromissos a
SET empresa_id = vu.empresa_id
FROM vinculo_unico vu
WHERE a.empresa_id IS NULL
  AND a.consultor_id = vu.usuario_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.agenda_compromissos WHERE empresa_id IS NULL) THEN
    RAISE EXCEPTION 'Agenda possui compromissos sem tenant deterministico; classifique-os antes da migration 162.';
  END IF;
END $$;

ALTER TABLE public.agenda_compromissos ALTER COLUMN empresa_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS agenda_compromissos_empresa_inicio_idx
  ON public.agenda_compromissos (empresa_id, data_inicio);
CREATE INDEX IF NOT EXISTS agenda_compromissos_empresa_consultor_inicio_idx
  ON public.agenda_compromissos (empresa_id, consultor_id, data_inicio);
CREATE INDEX IF NOT EXISTS agenda_compromissos_empresa_status_inicio_idx
  ON public.agenda_compromissos (empresa_id, status, data_inicio);

ALTER TABLE public.agenda_disponibilidade
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.agenda_disponibilidade_meta
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.agenda_bloqueios
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

WITH vinculo_unico AS (
  SELECT usuario_id, min(empresa_id::text)::uuid empresa_id
  FROM public.empresa_usuarios WHERE ativo = true
  GROUP BY usuario_id HAVING count(DISTINCT empresa_id) = 1
)
UPDATE public.agenda_disponibilidade d SET empresa_id = v.empresa_id
FROM vinculo_unico v WHERE d.usuario_id = v.usuario_id AND d.empresa_id IS NULL;
WITH vinculo_unico AS (
  SELECT usuario_id, min(empresa_id::text)::uuid empresa_id
  FROM public.empresa_usuarios WHERE ativo = true
  GROUP BY usuario_id HAVING count(DISTINCT empresa_id) = 1
)
UPDATE public.agenda_disponibilidade_meta d SET empresa_id = v.empresa_id
FROM vinculo_unico v WHERE d.usuario_id = v.usuario_id AND d.empresa_id IS NULL;
WITH vinculo_unico AS (
  SELECT usuario_id, min(empresa_id::text)::uuid empresa_id
  FROM public.empresa_usuarios WHERE ativo = true
  GROUP BY usuario_id HAVING count(DISTINCT empresa_id) = 1
)
UPDATE public.agenda_bloqueios d SET empresa_id = v.empresa_id
FROM vinculo_unico v WHERE d.usuario_id = v.usuario_id AND d.empresa_id IS NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.agenda_disponibilidade WHERE empresa_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.agenda_disponibilidade_meta WHERE empresa_id IS NULL)
    OR EXISTS (SELECT 1 FROM public.agenda_bloqueios WHERE empresa_id IS NULL) THEN
    RAISE EXCEPTION 'Disponibilidade da agenda possui tenant ambiguo; classifique antes da migration 162.';
  END IF;
END $$;

ALTER TABLE public.agenda_disponibilidade ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.agenda_disponibilidade_meta ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.agenda_bloqueios ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.agenda_disponibilidade_meta DROP CONSTRAINT IF EXISTS agenda_disponibilidade_meta_pkey;
ALTER TABLE public.agenda_disponibilidade_meta ADD CONSTRAINT agenda_disponibilidade_meta_pkey PRIMARY KEY (empresa_id, usuario_id);
CREATE INDEX IF NOT EXISTS agenda_disponibilidade_empresa_usuario_idx ON public.agenda_disponibilidade(empresa_id, usuario_id);
CREATE INDEX IF NOT EXISTS agenda_bloqueios_empresa_usuario_idx ON public.agenda_bloqueios(empresa_id, usuario_id, data_inicio);

CREATE OR REPLACE FUNCTION public.agenda_pode_ver_todos(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.is_platform_superadmin() OR EXISTS (
    SELECT 1
    FROM public.empresa_usuarios eu
    JOIN public.papeis p ON p.id = eu.papel_id
    WHERE eu.empresa_id = p_empresa_id
      AND eu.usuario_id = public.current_usuario_id()
      AND eu.ativo = true
      AND p.escopo = 'COMPANY'
      AND p.ativo = true
      AND (p.empresa_id IS NULL OR p.empresa_id = p_empresa_id)
      AND (p.codigo IN ('admin_empresa', 'gestor') OR coalesce(eu.agenda_acesso_todos, false))
  )
$$;

CREATE OR REPLACE FUNCTION public.agenda_pode_operar_compromisso(
  p_empresa_id uuid,
  p_consultor_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT public.has_company_permission(p_empresa_id, 'acessar_agenda')
    AND (
      public.agenda_pode_ver_todos(p_empresa_id)
      OR p_consultor_id = public.current_usuario_id()
    )
$$;

REVOKE ALL ON FUNCTION public.agenda_pode_ver_todos(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.agenda_pode_operar_compromisso(uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_pode_ver_todos(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.agenda_pode_operar_compromisso(uuid,uuid) TO authenticated;

DROP POLICY IF EXISTS agenda_disp_select ON public.agenda_disponibilidade;
DROP POLICY IF EXISTS agenda_disp_write_own ON public.agenda_disponibilidade;
CREATE POLICY agenda_disp_select ON public.agenda_disponibilidade FOR SELECT TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda'));
CREATE POLICY agenda_disp_write_own ON public.agenda_disponibilidade FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id())
  WITH CHECK (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id());

DROP POLICY IF EXISTS agenda_disp_meta_select ON public.agenda_disponibilidade_meta;
DROP POLICY IF EXISTS agenda_disp_meta_write_own ON public.agenda_disponibilidade_meta;
CREATE POLICY agenda_disp_meta_select ON public.agenda_disponibilidade_meta FOR SELECT TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda'));
CREATE POLICY agenda_disp_meta_write_own ON public.agenda_disponibilidade_meta FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id())
  WITH CHECK (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id());

DROP POLICY IF EXISTS agenda_bloqueios_select ON public.agenda_bloqueios;
DROP POLICY IF EXISTS agenda_bloqueios_write_own ON public.agenda_bloqueios;
CREATE POLICY agenda_bloqueios_select ON public.agenda_bloqueios FOR SELECT TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda'));
CREATE POLICY agenda_bloqueios_write_own ON public.agenda_bloqueios FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id())
  WITH CHECK (public.has_company_permission(empresa_id, 'acessar_agenda') AND usuario_id = public.current_usuario_id());

CREATE OR REPLACE FUNCTION public.validar_agenda_compromisso_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.leads l
    WHERE l.id = NEW.lead_id AND l.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Lead nao pertence a empresa da agenda.';
  END IF;

  IF NEW.consultor_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = NEW.empresa_id
      AND eu.usuario_id = NEW.consultor_id
      AND eu.ativo = true
  ) THEN
    RAISE EXCEPTION 'Responsavel nao possui vinculo ativo com a empresa da agenda.';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.criado_por_usuario_id IS NULL THEN
    NEW.criado_por_usuario_id := public.current_usuario_id();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_agenda_compromisso_tenant ON public.agenda_compromissos;
CREATE TRIGGER trg_validar_agenda_compromisso_tenant
BEFORE INSERT OR UPDATE OF empresa_id, lead_id, consultor_id
ON public.agenda_compromissos
FOR EACH ROW EXECUTE FUNCTION public.validar_agenda_compromisso_tenant();

DROP POLICY IF EXISTS agenda_staff ON public.agenda_compromissos;
DROP POLICY IF EXISTS agenda_compromissos_select_tenant ON public.agenda_compromissos;
DROP POLICY IF EXISTS agenda_compromissos_insert_tenant ON public.agenda_compromissos;
DROP POLICY IF EXISTS agenda_compromissos_update_tenant ON public.agenda_compromissos;
DROP POLICY IF EXISTS agenda_compromissos_delete_tenant ON public.agenda_compromissos;

CREATE POLICY agenda_compromissos_select_tenant ON public.agenda_compromissos
FOR SELECT TO authenticated
USING (public.agenda_pode_operar_compromisso(empresa_id, consultor_id));

CREATE POLICY agenda_compromissos_insert_tenant ON public.agenda_compromissos
FOR INSERT TO authenticated
WITH CHECK (public.agenda_pode_operar_compromisso(empresa_id, consultor_id));

CREATE POLICY agenda_compromissos_update_tenant ON public.agenda_compromissos
FOR UPDATE TO authenticated
USING (public.agenda_pode_operar_compromisso(empresa_id, consultor_id))
WITH CHECK (public.agenda_pode_operar_compromisso(empresa_id, consultor_id));

CREATE OR REPLACE FUNCTION public.rpc_concluir_compromisso_agenda(
  p_empresa_id uuid,
  p_compromisso_id uuid,
  p_outcome text,
  p_resultado text,
  p_observacao text DEFAULT NULL,
  p_motivo_perda text DEFAULT NULL,
  p_produto_fechado text DEFAULT NULL,
  p_valor_credito numeric DEFAULT NULL,
  p_tipo_parcela text DEFAULT NULL,
  p_percentual_parcela numeric DEFAULT NULL,
  p_valor_parcela numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_comp public.agenda_compromissos%ROWTYPE;
  v_usuario_id uuid := public.current_usuario_id();
  v_agora timestamptz := now();
BEGIN
  IF v_usuario_id IS NULL THEN RAISE EXCEPTION 'Usuario nao autenticado.'; END IF;

  SELECT * INTO v_comp
  FROM public.agenda_compromissos
  WHERE id = p_compromisso_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_comp.id IS NULL THEN RAISE EXCEPTION 'Compromisso nao encontrado nesta empresa.'; END IF;
  IF NOT public.agenda_pode_operar_compromisso(p_empresa_id, v_comp.consultor_id) THEN
    RAISE EXCEPTION 'Sem permissao para concluir este compromisso.';
  END IF;
  IF v_comp.status <> 'agendado' THEN RAISE EXCEPTION 'Somente compromissos agendados podem ser concluidos.'; END IF;
  IF p_outcome NOT IN ('ganho', 'perda') THEN RAISE EXCEPTION 'Resultado de atendimento invalido.'; END IF;

  IF p_outcome = 'ganho' THEN
    IF nullif(btrim(p_produto_fechado), '') IS NULL THEN RAISE EXCEPTION 'Informe o produto fechado.'; END IF;
    IF p_valor_credito IS NULL OR p_valor_credito <= 0 THEN RAISE EXCEPTION 'Informe o valor do credito vendido.'; END IF;
    IF p_tipo_parcela NOT IN ('integral', 'reduzida') THEN RAISE EXCEPTION 'Tipo de parcela invalido.'; END IF;
    IF p_tipo_parcela = 'reduzida' AND (p_percentual_parcela IS NULL OR p_percentual_parcela <= 0 OR p_percentual_parcela > 100) THEN
      RAISE EXCEPTION 'Percentual da parcela reduzida invalido.';
    END IF;
  END IF;

  IF v_comp.lead_id IS NOT NULL THEN
    IF p_outcome = 'ganho' THEN
      UPDATE public.leads SET
        status = 'Fechado', fechado = true, fechado_at = v_agora,
        data_fechamento = v_agora::date, valor_fechado = p_valor_credito,
        produto_fechado = btrim(p_produto_fechado), observacao_fechamento = p_observacao,
        motivo_perda = NULL, observacao_perda = NULL, perdido_at = NULL,
        fechamento_tipo_parcela = p_tipo_parcela,
        fechamento_percentual_parcela = CASE WHEN p_tipo_parcela = 'reduzida' THEN p_percentual_parcela ELSE NULL END,
        valor_parcela_fechamento = p_valor_parcela
      WHERE id = v_comp.lead_id AND empresa_id = p_empresa_id;
    ELSIF coalesce(p_motivo_perda, '') = 'Em negociacao' OR coalesce(p_motivo_perda, '') = 'Em negociação' THEN
      UPDATE public.leads SET status = 'Negociação' WHERE id = v_comp.lead_id AND empresa_id = p_empresa_id;
    ELSE
      UPDATE public.leads SET
        status = 'Perdido', perdido_at = v_agora,
        motivo_perda = coalesce(nullif(btrim(p_motivo_perda), ''), 'Sem interesse'),
        observacao_perda = p_observacao
      WHERE id = v_comp.lead_id AND empresa_id = p_empresa_id;
    END IF;
  END IF;

  UPDATE public.agenda_compromissos SET
    status = 'concluido', resultado = p_resultado,
    observacao_resultado = p_observacao, proxima_data = NULL,
    concluido_por_usuario_id = v_usuario_id, concluido_at = v_agora
  WHERE id = v_comp.id;

  INSERT INTO public.audit_logs_central (
    empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id, detalhes
  ) VALUES (
    p_empresa_id, v_usuario_id, 'agenda', 'CONCLUIR_COMPROMISSO',
    'agenda_compromissos', v_comp.id,
    jsonb_build_object('consultor_id', v_comp.consultor_id, 'lead_id', v_comp.lead_id,
      'outcome', p_outcome, 'resultado', p_resultado)
  );

  RETURN jsonb_build_object('id', v_comp.id, 'lead_id', v_comp.lead_id, 'status', 'concluido');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_concluir_compromisso_agenda(uuid,uuid,text,text,text,text,text,numeric,text,numeric,numeric)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_compromisso_agenda(uuid,uuid,text,text,text,text,text,numeric,text,numeric,numeric)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
