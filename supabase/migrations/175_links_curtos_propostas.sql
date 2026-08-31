-- 175 — Links curtos de propostas em rascunho, isolados por tenant e expirados.
CREATE TABLE IF NOT EXISTS public.proposta_links_curtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[A-Za-z0-9_-]{12}$'),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposta_links_curtos_empresa_expira_idx
  ON public.proposta_links_curtos(empresa_id, expires_at);

ALTER TABLE public.proposta_links_curtos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.proposta_links_curtos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.proposta_links_curtos TO service_role;

COMMENT ON TABLE public.proposta_links_curtos
IS 'Payload temporário de proposta, acessado no servidor por código curto e tenant resolvido pelo host.';
