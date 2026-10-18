-- Teste de validação e rollback (Dry-Run) da Migration 310 (WhatsApp Cloud API Multiempresa)
-- Executar em transação com ROLLBACK para comprovar que a migração é aplicada sem erro e sem efeitos colaterais.

BEGIN;

-- 1. Executa o DDL da migration 310 dentro da transação
CREATE TABLE IF NOT EXISTS public.empresa_whatsapp_conexoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  numero_exibicao TEXT,
  verified_name TEXT,
  token_cifrado TEXT NOT NULL,
  token_tipo TEXT NOT NULL DEFAULT 'system_user',
  token_expira_em TIMESTAMPTZ,
  coexistencia BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'conectado'
    CHECK (status IN ('conectado', 'pausado', 'erro', 'desconectado')),
  ultimo_erro TEXT,
  conectado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT empresa_whatsapp_conexoes_phone_unico UNIQUE (phone_number_id),
  CONSTRAINT empresa_whatsapp_conexoes_empresa_unico UNIQUE (empresa_id)
);

CREATE INDEX IF NOT EXISTS empresa_whatsapp_conexoes_empresa_idx
  ON public.empresa_whatsapp_conexoes (empresa_id);
CREATE INDEX IF NOT EXISTS empresa_whatsapp_conexoes_phone_idx
  ON public.empresa_whatsapp_conexoes (phone_number_id);

ALTER TABLE public.empresa_whatsapp_conexoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresa_whatsapp_conexoes_select"
  ON public.empresa_whatsapp_conexoes
  FOR SELECT
  USING (public.can_read_tenant_internal(empresa_id) OR auth.role() = 'service_role');

CREATE POLICY "empresa_whatsapp_conexoes_write"
  ON public.empresa_whatsapp_conexoes
  FOR ALL
  USING (public.can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role')
  WITH CHECK (public.can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.whatsapp_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  conexao_id UUID REFERENCES public.empresa_whatsapp_conexoes(id) ON DELETE SET NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('enviada', 'recebida')),
  wa_message_id TEXT,
  contato_numero TEXT NOT NULL,
  contato_nome TEXT,
  tipo TEXT NOT NULL DEFAULT 'text',
  conteudo TEXT,
  template_nome TEXT,
  status TEXT,
  erro TEXT,
  payload JSONB,
  criada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_mensagens_empresa_data_idx
  ON public.whatsapp_mensagens (empresa_id, criada_em DESC);
CREATE INDEX IF NOT EXISTS whatsapp_mensagens_contato_idx
  ON public.whatsapp_mensagens (empresa_id, contato_numero);
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_mensagens_wamid_unico
  ON public.whatsapp_mensagens (wa_message_id) WHERE wa_message_id IS NOT NULL;

ALTER TABLE public.whatsapp_mensagens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_mensagens_select"
  ON public.whatsapp_mensagens
  FOR SELECT
  USING (public.can_read_tenant_internal(empresa_id) OR auth.role() = 'service_role');

CREATE POLICY "whatsapp_mensagens_write"
  ON public.whatsapp_mensagens
  FOR ALL
  USING (public.can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role')
  WITH CHECK (public.can_write_tenant_internal(empresa_id) OR auth.role() = 'service_role');

-- 2. Bloco de validação de estrutura, RLS, policies e funcionamento
DO $$
DECLARE
  v_empresa_id uuid;
  v_conexao_id uuid;
  v_msg_id uuid;
  v_count int;
  v_rls boolean;
BEGIN
  -- Validar tabelas
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'empresa_whatsapp_conexoes') THEN
    RAISE EXCEPTION 'Tabela empresa_whatsapp_conexoes não foi criada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'whatsapp_mensagens') THEN
    RAISE EXCEPTION 'Tabela whatsapp_mensagens não foi criada';
  END IF;

  -- Validar RLS
  SELECT rowsecurity INTO v_rls FROM pg_tables WHERE schemaname = 'public' AND tablename = 'empresa_whatsapp_conexoes';
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS não habilitado em empresa_whatsapp_conexoes'; END IF;

  SELECT rowsecurity INTO v_rls FROM pg_tables WHERE schemaname = 'public' AND tablename = 'whatsapp_mensagens';
  IF NOT v_rls THEN RAISE EXCEPTION 'RLS não habilitado em whatsapp_mensagens'; END IF;

  -- Validar Policies
  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'empresa_whatsapp_conexoes';
  IF v_count < 2 THEN RAISE EXCEPTION 'Policies ausentes em empresa_whatsapp_conexoes (encontradas %)', v_count; END IF;

  SELECT count(*) INTO v_count FROM pg_policies WHERE schemaname = 'public' AND tablename = 'whatsapp_mensagens';
  IF v_count < 2 THEN RAISE EXCEPTION 'Policies ausentes em whatsapp_mensagens (encontradas %)', v_count; END IF;

  -- Validar gen_random_uuid()
  IF gen_random_uuid() IS NULL THEN
    RAISE EXCEPTION 'gen_random_uuid() falhou';
  END IF;

  -- Selecionar empresa canônica
  SELECT id INTO v_empresa_id FROM public.empresas WHERE slug = 'gauchinho' LIMIT 1;
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id FROM public.empresas LIMIT 1;
  END IF;

  -- Inserir conexão de teste
  INSERT INTO public.empresa_whatsapp_conexoes (
    empresa_id, waba_id, phone_number_id, numero_exibicao, verified_name, token_cifrado, status
  ) VALUES (
    v_empresa_id, 'waba_dryrun_test', 'phone_dryrun_test', '+556699999999', 'Teste Dryrun', 'cifrado_dryrun', 'conectado'
  ) RETURNING id INTO v_conexao_id;

  IF v_conexao_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao inserir conexão teste';
  END IF;

  -- Inserir mensagem de teste
  INSERT INTO public.whatsapp_mensagens (
    empresa_id, conexao_id, direcao, wa_message_id, contato_numero, contato_nome, tipo, conteudo, status
  ) VALUES (
    v_empresa_id, v_conexao_id, 'enviada', 'wamid.HBgL_dryrun_test', '556699999999', 'Contato Teste', 'text', 'Olá dry run', 'sent'
  ) RETURNING id INTO v_msg_id;

  IF v_msg_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao inserir mensagem teste';
  END IF;

  -- Teste de unicidade de número na mesma empresa / sistema
  BEGIN
    INSERT INTO public.empresa_whatsapp_conexoes (
      empresa_id, waba_id, phone_number_id, token_cifrado
    ) VALUES (
      v_empresa_id, 'waba_dryrun_duplicado', 'phone_dryrun_test', 'cifrado_dryrun'
    );
    RAISE EXCEPTION 'Unicidade de phone_number_id falhou';
  EXCEPTION WHEN unique_violation THEN
    -- Esperado
    NULL;
  END;

  RAISE NOTICE 'Dry-Run da Migration 310 validado com sucesso.';
END $$;

ROLLBACK;
