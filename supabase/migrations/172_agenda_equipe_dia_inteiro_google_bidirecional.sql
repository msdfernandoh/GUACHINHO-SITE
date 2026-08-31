-- Fase 175 - compromissos de equipe, dia inteiro e Google bidirecional.

BEGIN;

ALTER TABLE public.agenda_compromissos
  ADD COLUMN IF NOT EXISTS escopo text NOT NULL DEFAULT 'INDIVIDUAL',
  ADD COLUMN IF NOT EXISTS dia_inteiro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'SISTEMA',
  ADD COLUMN IF NOT EXISTS google_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS google_conta_email text;

ALTER TABLE public.agenda_compromissos
  DROP CONSTRAINT IF EXISTS agenda_compromissos_escopo_check,
  ADD CONSTRAINT agenda_compromissos_escopo_check CHECK (escopo IN ('INDIVIDUAL', 'EQUIPE')),
  DROP CONSTRAINT IF EXISTS agenda_compromissos_origem_check,
  ADD CONSTRAINT agenda_compromissos_origem_check CHECK (origem IN ('SISTEMA', 'GOOGLE'));

ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS google_agenda_bidirecional boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.agenda_compromisso_participantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  compromisso_id uuid NOT NULL REFERENCES public.agenda_compromissos(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  google_calendar_event_id text,
  google_conta_email text,
  google_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (compromisso_id, usuario_id),
  UNIQUE (empresa_id, usuario_id, google_conta_email, google_calendar_event_id)
);

CREATE INDEX IF NOT EXISTS agenda_participantes_usuario_idx
  ON public.agenda_compromisso_participantes(empresa_id, usuario_id, compromisso_id);

INSERT INTO public.agenda_compromisso_participantes (
  empresa_id, compromisso_id, usuario_id, google_calendar_event_id
)
SELECT a.empresa_id, a.id, a.consultor_id, a.google_calendar_event_id
FROM public.agenda_compromissos a
WHERE a.consultor_id IS NOT NULL
ON CONFLICT (compromisso_id, usuario_id) DO UPDATE SET
  google_calendar_event_id = coalesce(
    public.agenda_compromisso_participantes.google_calendar_event_id,
    excluded.google_calendar_event_id
  );

UPDATE public.agenda_compromisso_participantes ap SET google_conta_email = lower(u.google_calendar_email)
FROM public.usuarios u WHERE u.id = ap.usuario_id AND ap.google_calendar_event_id IS NOT NULL AND ap.google_conta_email IS NULL;

CREATE TABLE IF NOT EXISTS public.agenda_google_sync_estado (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  google_email text NOT NULL,
  sync_token text,
  ultima_sincronizacao timestamptz,
  ultimo_erro text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, usuario_id)
);

ALTER TABLE public.agenda_compromisso_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_google_sync_estado ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.agenda_usuario_participa(p_compromisso_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agenda_compromisso_participantes ap
    WHERE ap.compromisso_id = p_compromisso_id
      AND ap.usuario_id = public.current_usuario_id()
      AND public.has_company_permission(ap.empresa_id, 'acessar_agenda')
      AND public.is_company_member(ap.empresa_id)
  )
$$;
REVOKE ALL ON FUNCTION public.agenda_usuario_participa(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.agenda_usuario_participa(uuid) TO authenticated;

DROP POLICY IF EXISTS agenda_compromissos_select_tenant ON public.agenda_compromissos;
CREATE POLICY agenda_compromissos_select_tenant ON public.agenda_compromissos
FOR SELECT TO authenticated USING (
  public.agenda_pode_operar_compromisso(empresa_id, consultor_id)
  OR public.agenda_usuario_participa(id)
);

DROP POLICY IF EXISTS agenda_participantes_select ON public.agenda_compromisso_participantes;
CREATE POLICY agenda_participantes_select ON public.agenda_compromisso_participantes
FOR SELECT TO authenticated USING (
  public.has_company_permission(empresa_id, 'acessar_agenda')
  AND (public.agenda_usuario_participa(compromisso_id) OR public.agenda_pode_ver_todos(empresa_id))
);
DROP POLICY IF EXISTS agenda_participantes_insert ON public.agenda_compromisso_participantes;
DROP POLICY IF EXISTS agenda_participantes_update ON public.agenda_compromisso_participantes;
REVOKE ALL ON public.agenda_compromisso_participantes, public.agenda_google_sync_estado FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.agenda_compromisso_participantes, public.agenda_google_sync_estado TO authenticated;
GRANT ALL ON public.agenda_compromisso_participantes, public.agenda_google_sync_estado TO service_role;

DROP POLICY IF EXISTS agenda_google_sync_estado_select ON public.agenda_google_sync_estado;
CREATE POLICY agenda_google_sync_estado_select ON public.agenda_google_sync_estado
FOR SELECT TO authenticated USING (
  public.has_company_permission(empresa_id, 'acessar_agenda')
  AND usuario_id = public.current_usuario_id()
);

CREATE OR REPLACE FUNCTION public.validar_agenda_participante_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.agenda_compromissos a
    WHERE a.id = NEW.compromisso_id AND a.empresa_id = NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Compromisso nao pertence a empresa do participante.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    WHERE eu.empresa_id = NEW.empresa_id AND eu.usuario_id = NEW.usuario_id AND eu.ativo = true
  ) THEN RAISE EXCEPTION 'Participante nao possui vinculo ativo com a empresa.'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_agenda_participante_tenant ON public.agenda_compromisso_participantes;
CREATE TRIGGER trg_validar_agenda_participante_tenant
BEFORE INSERT OR UPDATE OF empresa_id, compromisso_id, usuario_id
ON public.agenda_compromisso_participantes
FOR EACH ROW EXECUTE FUNCTION public.validar_agenda_participante_tenant();

DROP TRIGGER IF EXISTS agenda_compromisso_participantes_updated_at ON public.agenda_compromisso_participantes;
CREATE TRIGGER agenda_compromisso_participantes_updated_at
BEFORE UPDATE ON public.agenda_compromisso_participantes
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A equipe é o conjunto de membros ativos com acesso à agenda no instante do cadastro.
CREATE OR REPLACE FUNCTION public.agenda_membros_elegiveis(p_empresa_id uuid)
RETURNS TABLE(usuario_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT DISTINCT eu.usuario_id FROM public.empresa_usuarios eu
  JOIN public.usuarios u ON u.id = eu.usuario_id AND u.ativo
  JOIN public.papeis p ON p.id = eu.papel_id AND p.ativo AND p.escopo = 'COMPANY'
    AND (p.empresa_id IS NULL OR p.empresa_id = eu.empresa_id)
  JOIN public.papel_permissoes pp ON pp.papel_id = p.id
  JOIN public.permissoes pe ON pe.id = pp.permissao_id AND pe.codigo = 'acessar_agenda'
  WHERE eu.empresa_id = p_empresa_id AND eu.ativo
$$;
REVOKE ALL ON FUNCTION public.agenda_membros_elegiveis(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.agenda_validar_coletivo_horario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_alvos uuid[];
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.empresa_id, NEW.consultor_id, NEW.escopo, NEW.origem)
    IS DISTINCT FROM (OLD.empresa_id, OLD.consultor_id, OLD.escopo, OLD.origem) THEN
    RAISE EXCEPTION 'Empresa, responsável, origem e participantes não podem ser trocados. Cancele e cadastre outro compromisso.';
  END IF;
  IF auth.role() = 'authenticated' THEN
    IF NEW.origem = 'GOOGLE' THEN RAISE EXCEPTION 'Edite este compromisso na Google Agenda de origem.'; END IF;
    IF NEW.escopo = 'EQUIPE' AND NOT public.agenda_pode_ver_todos(NEW.empresa_id) THEN
      RAISE EXCEPTION 'Sem permissão para alterar a agenda da equipe.';
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.data_inicio, NEW.data_fim, NEW.dia_inteiro, NEW.status)
    IS NOT DISTINCT FROM (OLD.data_inicio, OLD.data_fim, OLD.dia_inteiro, OLD.status) THEN RETURN NEW; END IF;
  IF NEW.status <> 'agendado' THEN RETURN NEW; END IF;
  IF NEW.data_fim IS NULL OR NEW.data_fim <= NEW.data_inicio THEN RAISE EXCEPTION 'Informe início e término válidos.'; END IF;
  IF NEW.dia_inteiro AND ((NEW.data_inicio AT TIME ZONE 'America/Cuiaba')::time <> '00:00'::time
    OR (NEW.data_fim AT TIME ZONE 'America/Cuiaba')::time <> '00:00'::time) THEN
    RAISE EXCEPTION 'Dia todo deve iniciar e terminar à meia-noite no fuso da agenda.';
  END IF;
  NEW.duracao_minutos := ceil(extract(epoch FROM NEW.data_fim - NEW.data_inicio) / 60)::integer;
  -- Serializa mudanças de horário da empresa, inclusive inserções concorrentes.
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:' || NEW.empresa_id::text, 0));
  IF NEW.status <> 'agendado' OR NEW.origem = 'GOOGLE' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(ap.usuario_id) INTO v_alvos FROM public.agenda_compromisso_participantes ap WHERE ap.compromisso_id = NEW.id;
  ELSIF NEW.escopo = 'EQUIPE' THEN
    SELECT array_agg(m.usuario_id) INTO v_alvos FROM public.agenda_membros_elegiveis(NEW.empresa_id) m;
  END IF;
  v_alvos := coalesce(v_alvos, ARRAY[NEW.consultor_id]);
  IF EXISTS (
    SELECT 1 FROM public.agenda_compromissos a
    WHERE a.empresa_id = NEW.empresa_id AND a.id <> NEW.id AND a.status = 'agendado'
      AND a.data_inicio < NEW.data_fim AND coalesce(a.data_fim, a.data_inicio + interval '1 hour') > NEW.data_inicio
      AND (a.consultor_id = ANY(v_alvos) OR EXISTS (
        SELECT 1 FROM public.agenda_compromisso_participantes ap WHERE ap.compromisso_id = a.id AND ap.usuario_id = ANY(v_alvos)
      ))
  ) THEN RAISE EXCEPTION 'Conflito de horário na agenda de um dos participantes. Escolha outro horário.'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agenda_validar_coletivo_horario BEFORE INSERT OR UPDATE ON public.agenda_compromissos
FOR EACH ROW EXECUTE FUNCTION public.agenda_validar_coletivo_horario();

CREATE OR REPLACE FUNCTION public.agenda_gravar_participantes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  INSERT INTO public.agenda_compromisso_participantes(empresa_id, compromisso_id, usuario_id, google_calendar_event_id, google_conta_email)
  VALUES(NEW.empresa_id, NEW.id, NEW.consultor_id, NEW.google_calendar_event_id, NEW.google_conta_email);
  IF NEW.escopo = 'EQUIPE' THEN
    INSERT INTO public.agenda_compromisso_participantes(empresa_id, compromisso_id, usuario_id)
    SELECT NEW.empresa_id, NEW.id, m.usuario_id FROM public.agenda_membros_elegiveis(NEW.empresa_id) m
    ON CONFLICT(compromisso_id, usuario_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agenda_gravar_participantes AFTER INSERT ON public.agenda_compromissos
FOR EACH ROW EXECUTE FUNCTION public.agenda_gravar_participantes();
REVOKE ALL ON FUNCTION public.agenda_validar_coletivo_horario(), public.agenda_gravar_participantes(),
  public.validar_agenda_participante_tenant() FROM PUBLIC, anon, authenticated, service_role;

-- Consentimento explícito: a mesma agenda principal só pode alimentar uma empresa.
CREATE OR REPLACE FUNCTION public.agenda_google_validar_consentimento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.google_agenda_bidirecional AND (TG_OP = 'INSERT' OR NOT OLD.google_agenda_bidirecional) THEN
    IF auth.uid() IS NULL OR NEW.usuario_id IS DISTINCT FROM public.current_usuario_id()
      OR NOT public.has_company_permission(NEW.empresa_id, 'acessar_agenda') THEN
      RAISE EXCEPTION 'Somente o próprio usuário pode autorizar a importação de sua agenda.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_agenda_google_validar_consentimento BEFORE INSERT OR UPDATE OF google_agenda_bidirecional ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.agenda_google_validar_consentimento();
REVOKE ALL ON FUNCTION public.agenda_google_validar_consentimento() FROM PUBLIC, anon, authenticated, service_role;

CREATE UNIQUE INDEX agenda_google_importacao_usuario_unico ON public.empresa_usuarios(usuario_id)
WHERE google_agenda_bidirecional;

CREATE OR REPLACE FUNCTION public.rpc_agenda_google_consentimento(p_empresa_id uuid, p_habilitar boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_usuario uuid := public.current_usuario_id(); v_email text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'acessar_agenda')
    OR NOT public.is_company_member(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT google_calendar_email INTO v_email FROM public.usuarios WHERE id = v_usuario AND google_calendar_connected_at IS NOT NULL;
  IF p_habilitar AND (v_email IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios WHERE empresa_id = p_empresa_id AND usuario_id = v_usuario AND ativo AND google_agenda_sync
  )) THEN RAISE EXCEPTION 'Conecte sua conta Google e habilite a integração nesta empresa antes de importar.'; END IF;
  IF p_habilitar AND EXISTS (
    SELECT 1 FROM public.empresa_usuarios WHERE usuario_id = v_usuario AND empresa_id <> p_empresa_id AND google_agenda_bidirecional
  ) THEN RAISE EXCEPTION 'Desative a importação na outra empresa antes de ativar aqui.'; END IF;
  UPDATE public.empresa_usuarios SET google_agenda_bidirecional = p_habilitar WHERE empresa_id = p_empresa_id AND usuario_id = v_usuario AND ativo;
  IF p_habilitar THEN
    INSERT INTO public.agenda_google_sync_estado(empresa_id, usuario_id, google_email)
    VALUES(p_empresa_id, v_usuario, lower(v_email))
    ON CONFLICT(empresa_id, usuario_id) DO UPDATE SET google_email = excluded.google_email, ultimo_erro = NULL;
  END IF;
  INSERT INTO public.audit_logs_central(empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id, detalhes)
  VALUES(p_empresa_id, v_usuario, 'agenda', 'GOOGLE_CONSENTIMENTO', 'usuarios', v_usuario,
    jsonb_build_object('habilitado', p_habilitar));
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_agenda_google_consentimento(uuid,boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_agenda_google_consentimento(uuid,boolean) TO authenticated;

-- Importação idempotente, transacional, restrita ao job servidor e ao consentimento vigente.
CREATE UNIQUE INDEX agenda_google_origem_unica ON public.agenda_compromissos
  (empresa_id, consultor_id, google_conta_email, google_calendar_event_id) WHERE origem = 'GOOGLE';
CREATE OR REPLACE FUNCTION public.rpc_agenda_importar_google(p_empresa_id uuid, p_usuario_id uuid, p_email text, p_eventos jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE e jsonb; a public.agenda_compromissos%ROWTYPE; v_importados int := 0; v_atualizados int := 0; v_cancelados int := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Rotina exclusiva de integração.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_usuarios eu
    JOIN public.empresas em ON em.id = eu.empresa_id AND em.ativo
    JOIN public.usuarios u ON u.id = eu.usuario_id AND lower(u.google_calendar_email) = lower(p_email)
    JOIN public.agenda_google_sync_estado s ON s.empresa_id = eu.empresa_id AND s.usuario_id = eu.usuario_id AND s.google_email = lower(p_email)
    WHERE eu.empresa_id = p_empresa_id AND eu.usuario_id = p_usuario_id AND eu.ativo AND eu.google_agenda_sync AND eu.google_agenda_bidirecional
  ) OR NOT EXISTS (SELECT 1 FROM public.agenda_membros_elegiveis(p_empresa_id) m WHERE m.usuario_id = p_usuario_id)
  THEN RAISE EXCEPTION 'Importação não autorizada para esta empresa e conta Google.'; END IF;
  IF jsonb_typeof(p_eventos) <> 'array' OR jsonb_array_length(p_eventos) > 100 THEN RAISE EXCEPTION 'Lote inválido.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('agenda:' || p_empresa_id::text, 0));
  FOR e IN SELECT value FROM jsonb_array_elements(p_eventos) LOOP
    IF coalesce(e->>'id', '') = '' OR length(e->>'id') > 1024 THEN RAISE EXCEPTION 'Identificador Google inválido.'; END IF;
    -- Também reconhece vínculos exportados antes da introdução de extendedProperties.
    IF EXISTS (SELECT 1 FROM public.agenda_compromisso_participantes ap
      JOIN public.agenda_compromissos c ON c.id = ap.compromisso_id
      WHERE ap.empresa_id = p_empresa_id AND ap.usuario_id = p_usuario_id AND ap.google_calendar_event_id = e->>'id' AND c.origem = 'SISTEMA')
    THEN CONTINUE; END IF;
    SELECT * INTO a FROM public.agenda_compromissos WHERE empresa_id = p_empresa_id AND consultor_id = p_usuario_id
      AND google_conta_email = lower(p_email) AND google_calendar_event_id = e->>'id' AND origem = 'GOOGLE' FOR UPDATE;
    IF a.id IS NOT NULL AND a.google_updated_at >= (e->>'updated')::timestamptz THEN CONTINUE; END IF;
    IF e->>'status' = 'cancelled' OR coalesce((e->>'privado')::boolean, false) THEN
      IF a.id IS NOT NULL THEN
        UPDATE public.agenda_compromissos SET status = 'cancelado', google_updated_at = (e->>'updated')::timestamptz,
          titulo = CASE WHEN coalesce((e->>'privado')::boolean, false) THEN 'Evento privado' ELSE titulo END,
          descricao = CASE WHEN coalesce((e->>'privado')::boolean, false) THEN NULL ELSE descricao END,
          local = CASE WHEN coalesce((e->>'privado')::boolean, false) THEN NULL ELSE local END
        WHERE id = a.id AND empresa_id = p_empresa_id;
        v_cancelados := v_cancelados + 1;
      END IF;
      CONTINUE;
    END IF;
    IF a.id IS NULL THEN
      INSERT INTO public.agenda_compromissos(empresa_id, consultor_id, titulo, descricao, local, tipo, data_inicio, data_fim,
        dia_inteiro, origem, google_conta_email, google_calendar_event_id, google_updated_at)
      VALUES(p_empresa_id, p_usuario_id, left(coalesce(e->>'titulo', 'Compromisso Google'), 500), left(e->>'descricao', 10000), left(e->>'local', 1000),
        'Outro', (e->>'inicio')::timestamptz, (e->>'fim')::timestamptz, (e->>'diaInteiro')::boolean, 'GOOGLE', lower(p_email), e->>'id', (e->>'updated')::timestamptz);
      v_importados := v_importados + 1;
    ELSIF a.status IN ('agendado', 'cancelado') THEN
      UPDATE public.agenda_compromissos SET titulo = left(e->>'titulo', 500), descricao = left(e->>'descricao', 10000), local = left(e->>'local', 1000),
        data_inicio = (e->>'inicio')::timestamptz, data_fim = (e->>'fim')::timestamptz, dia_inteiro = (e->>'diaInteiro')::boolean,
        status = 'agendado', google_updated_at = (e->>'updated')::timestamptz WHERE id = a.id AND empresa_id = p_empresa_id;
      v_atualizados := v_atualizados + 1;
    END IF;
  END LOOP;
  IF v_importados + v_atualizados + v_cancelados > 0 THEN
    INSERT INTO public.audit_logs_central(empresa_id, usuario_id, modulo, acao, entidade_tipo, entidade_id, detalhes, correlation_id)
    VALUES(p_empresa_id, NULL, 'agenda', 'GOOGLE_IMPORTACAO', 'usuarios', p_usuario_id,
      jsonb_build_object('ator_tipo', 'SYSTEM', 'ator_id', 'agenda-google', 'importados', v_importados, 'atualizados', v_atualizados, 'cancelados', v_cancelados), gen_random_uuid()::text);
  END IF;
  RETURN jsonb_build_object('imported', v_importados, 'updated', v_atualizados, 'cancelled', v_cancelados);
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_agenda_importar_google(uuid,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_agenda_importar_google(uuid,uuid,text,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_agenda_marcar_realizado(p_empresa_id uuid, p_compromisso_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE a public.agenda_compromissos%ROWTYPE; v_usuario uuid := public.current_usuario_id();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória.'; END IF;
  SELECT * INTO a FROM public.agenda_compromissos WHERE empresa_id=p_empresa_id AND id=p_compromisso_id FOR UPDATE;
  IF a.id IS NULL OR NOT public.agenda_pode_operar_compromisso(p_empresa_id,a.consultor_id) THEN RAISE EXCEPTION 'Sem permissão para concluir.'; END IF;
  IF a.lead_id IS NOT NULL OR a.origem <> 'SISTEMA' THEN RAISE EXCEPTION 'Use o fluxo de conclusão do atendimento ou a agenda de origem.'; END IF;
  IF a.status = 'concluido' THEN RETURN; END IF;
  IF a.status <> 'agendado' THEN RAISE EXCEPTION 'O compromisso não está agendado.'; END IF;
  UPDATE public.agenda_compromissos SET status='concluido',resultado='Realizado',concluido_por_usuario_id=v_usuario,concluido_at=now()
    WHERE empresa_id=p_empresa_id AND id=a.id;
  INSERT INTO public.audit_logs_central(empresa_id,usuario_id,modulo,acao,entidade_tipo,entidade_id,detalhes)
    VALUES(p_empresa_id,v_usuario,'agenda','MARCAR_REALIZADO','agenda_compromissos',a.id,'{}');
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_agenda_marcar_realizado(uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_agenda_marcar_realizado(uuid,uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
