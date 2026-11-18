-- WhatsApp: templates por WABA, contatos sincronizados da coexistência, descadastro (opt-out),
-- campanhas/automações e fila de envios processada por cron. Forward-only; não altera 310/332.
-- Escrita somente via service_role (rotas do servidor); leitura isolada por empresa.
BEGIN;

CREATE TABLE public.whatsapp_templates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 waba_id text NOT NULL,
 meta_id text,
 nome text NOT NULL CHECK (nome ~ '^[a-z0-9_]{1,512}$'),
 idioma text NOT NULL DEFAULT 'pt_BR',
 categoria text NOT NULL,
 status text NOT NULL DEFAULT 'PENDING',
 motivo text,
 componentes jsonb NOT NULL DEFAULT '[]'::jsonb,
 header_midia_url text,
 criado_por_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
 sincronizado_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (empresa_id, waba_id, nome, idioma)
);
CREATE INDEX whatsapp_templates_waba_idx ON public.whatsapp_templates (waba_id, nome);

CREATE TABLE public.whatsapp_contatos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL,
 instancia_id uuid NOT NULL,
 numero text NOT NULL CHECK (numero ~ '^[1-9][0-9]{7,14}$'),
 nome text,
 ativo boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (instancia_id, numero),
 FOREIGN KEY (empresa_id, instancia_id) REFERENCES public.whatsapp_instancias(empresa_id, id) ON DELETE CASCADE
);
CREATE INDEX whatsapp_contatos_empresa_idx ON public.whatsapp_contatos (empresa_id, instancia_id);

-- Quem pediu para não receber mais mensagens (SAIR/PARAR). Vale para todas as instâncias da empresa.
CREATE TABLE public.whatsapp_descadastros (
 empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
 numero text NOT NULL,
 motivo text,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (empresa_id, numero)
);

CREATE TABLE public.whatsapp_campanhas (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL,
 instancia_id uuid NOT NULL,
 nome text NOT NULL CHECK (length(nome) BETWEEN 2 AND 120),
 tipo text NOT NULL CHECK (tipo IN ('disparo','automacao')),
 gatilho text CHECK (gatilho IN ('novo_lead')),
 template_nome text NOT NULL,
 template_idioma text NOT NULL DEFAULT 'pt_BR',
 variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
 header_midia_url text,
 publico jsonb NOT NULL DEFAULT '{}'::jsonb,
 agendada_para timestamptz,
 atraso_minutos integer NOT NULL DEFAULT 0 CHECK (atraso_minutos BETWEEN 0 AND 43200),
 ritmo_por_minuto integer NOT NULL DEFAULT 20 CHECK (ritmo_por_minuto BETWEEN 1 AND 60),
 hora_inicio smallint NOT NULL DEFAULT 8 CHECK (hora_inicio BETWEEN 0 AND 23),
 hora_fim smallint NOT NULL DEFAULT 20 CHECK (hora_fim BETWEEN 1 AND 24),
 status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendada','enviando','ativa','pausada','concluida','cancelada')),
 automacao_desde timestamptz,
 ultimo_erro text,
 criado_por_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (empresa_id, id),
 CHECK ((tipo = 'automacao') = (gatilho IS NOT NULL)),
 FOREIGN KEY (empresa_id, instancia_id) REFERENCES public.whatsapp_instancias(empresa_id, id) ON DELETE RESTRICT
);
CREATE INDEX whatsapp_campanhas_empresa_idx ON public.whatsapp_campanhas (empresa_id, created_at DESC);
CREATE INDEX whatsapp_campanhas_ativas_idx ON public.whatsapp_campanhas (status) WHERE status IN ('agendada','enviando','ativa');

-- Um destinatário por campanha (não repete). O id é também o id da mensagem em whatsapp_mensagens.
CREATE TABLE public.whatsapp_campanha_envios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 empresa_id uuid NOT NULL,
 campanha_id uuid NOT NULL,
 numero text NOT NULL CHECK (numero ~ '^[1-9][0-9]{7,14}$'),
 nome text,
 lead_id uuid,
 parametros jsonb NOT NULL DEFAULT '[]'::jsonb,
 status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','enviando','enviado','falhou','ignorado')),
 motivo text,
 enviar_apos timestamptz NOT NULL DEFAULT now(),
 tentativas integer NOT NULL DEFAULT 0,
 processado_em timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (campanha_id, numero),
 FOREIGN KEY (empresa_id, campanha_id) REFERENCES public.whatsapp_campanhas(empresa_id, id) ON DELETE CASCADE
);
CREATE INDEX whatsapp_campanha_envios_fila_idx ON public.whatsapp_campanha_envios (campanha_id, enviar_apos) WHERE status = 'pendente';
CREATE INDEX whatsapp_campanha_envios_empresa_idx ON public.whatsapp_campanha_envios (empresa_id, campanha_id, status);

-- Reivindica um lote da fila sem concorrência entre execuções do cron (SKIP LOCKED).
-- Itens presos em 'enviando' há mais de 10 minutos voltam; o envio é idempotente pelo id.
CREATE FUNCTION public.whatsapp_fila_reivindicar(p_campanha uuid, p_limite integer)
RETURNS SETOF public.whatsapp_campanha_envios LANGUAGE sql SECURITY INVOKER SET search_path = pg_catalog AS $$
 UPDATE public.whatsapp_campanha_envios e SET status = 'enviando', tentativas = e.tentativas + 1, processado_em = now()
 WHERE e.id IN (
  SELECT f.id FROM public.whatsapp_campanha_envios f
  WHERE f.campanha_id = p_campanha AND f.enviar_apos <= now() AND f.tentativas < 3
   AND (f.status = 'pendente' OR (f.status = 'enviando' AND f.processado_em < now() - interval '10 minutes'))
  ORDER BY f.enviar_apos, f.created_at LIMIT greatest(1, least(p_limite, 60)) FOR UPDATE SKIP LOCKED)
 RETURNING e.*;
$$;

CREATE FUNCTION public.whatsapp_campanha_resumo(p_empresa uuid)
RETURNS TABLE (campanha_id uuid, total bigint, pendentes bigint, enviados bigint, entregues bigint, lidos bigint, falhas bigint, ignorados bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog AS $$
 SELECT e.campanha_id, count(*),
  count(*) FILTER (WHERE e.status IN ('pendente','enviando')),
  count(*) FILTER (WHERE e.status = 'enviado'),
  count(*) FILTER (WHERE m.status IN ('delivered','read')),
  count(*) FILTER (WHERE m.status = 'read'),
  count(*) FILTER (WHERE e.status = 'falhou' OR m.status = 'failed'),
  count(*) FILTER (WHERE e.status = 'ignorado')
 FROM public.whatsapp_campanha_envios e LEFT JOIN public.whatsapp_mensagens m ON m.id = e.id
 WHERE e.empresa_id = p_empresa GROUP BY e.campanha_id;
$$;

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_descadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campanha_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_templates, public.whatsapp_contatos, public.whatsapp_descadastros, public.whatsapp_campanhas, public.whatsapp_campanha_envios FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_templates, public.whatsapp_contatos, public.whatsapp_descadastros, public.whatsapp_campanhas, public.whatsapp_campanha_envios TO service_role;
GRANT SELECT ON public.whatsapp_templates, public.whatsapp_contatos, public.whatsapp_descadastros, public.whatsapp_campanhas, public.whatsapp_campanha_envios TO authenticated;
CREATE POLICY whatsapp_templates_select ON public.whatsapp_templates FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY whatsapp_contatos_select ON public.whatsapp_contatos FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY whatsapp_descadastros_select ON public.whatsapp_descadastros FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY whatsapp_campanhas_select ON public.whatsapp_campanhas FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY whatsapp_campanha_envios_select ON public.whatsapp_campanha_envios FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
REVOKE ALL ON FUNCTION public.whatsapp_fila_reivindicar(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_campanha_resumo(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_fila_reivindicar(uuid, integer), public.whatsapp_campanha_resumo(uuid) TO service_role;

-- Imagens de cabeçalho dos templates (a Meta precisa de link público no envio).
INSERT INTO storage.buckets (id, name, public) VALUES ('whatsapp-midia', 'whatsapp-midia', true) ON CONFLICT (id) DO NOTHING;
COMMIT;
