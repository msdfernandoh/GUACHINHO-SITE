-- 310: WhatsApp Cloud API multiempresa (coexistência por franquia)
-- Cada empresa (franquia) conecta o PRÓPRIO número via Embedded Signup.
-- Token armazenado cifrado (AES-256-GCM, mesmo cryptoService dos robôs).
-- Isolamento por empresa via RLS (can_read_tenant_internal / can_write_tenant_internal).

-- =========================================================
-- Conexões (1 número por franquia)
-- =========================================================
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

-- =========================================================
-- Mensagens (histórico 1:1 + campanhas)
-- =========================================================
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
