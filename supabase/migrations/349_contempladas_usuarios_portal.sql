-- Portal contempladas: usuários próprios do portal (gerente e vendedor) sem acesso
-- ao ERP, convites de cadastro, ágio fixo na subida e rentabilidade por proposta.
-- Usuários do portal NÃO recebem linha em public.usuarios nem em empresa_usuarios,
-- por isso o layout do ERP (/admin, /erp) continua negando o acesso deles.

CREATE TABLE IF NOT EXISTS public.contempladas_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  telefone text,
  papel text NOT NULL CHECK (papel IN ('GERENTE', 'VENDEDOR')),
  ativo boolean NOT NULL DEFAULT true,
  adicional_tipo text NOT NULL DEFAULT 'FIXO' CHECK (adicional_tipo IN ('PERCENTUAL', 'FIXO')),
  adicional_valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (adicional_valor >= 0),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, auth_user_id)
);

CREATE TABLE IF NOT EXISTS public.contempladas_convites (
  token text PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'VENDEDOR' CHECK (papel IN ('GERENTE', 'VENDEDOR')),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expira_em timestamptz NOT NULL,
  usos integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contempladas_config
  ADD COLUMN IF NOT EXISTS agio_tipo text NOT NULL DEFAULT 'FIXO' CHECK (agio_tipo IN ('PERCENTUAL', 'FIXO')),
  ADD COLUMN IF NOT EXISTS agio_valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (agio_valor >= 0);

ALTER TABLE public.contempladas_propostas
  ADD COLUMN IF NOT EXISTS vendedor_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vendedor_nome text,
  ADD COLUMN IF NOT EXISTS adicional_valor numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_valor numeric(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_valor numeric(15,2) NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS contempladas_propostas_vendedor_idx ON public.contempladas_propostas (empresa_id, vendedor_auth_id);

ALTER TABLE public.contempladas_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_convites ENABLE ROW LEVEL SECURITY;
