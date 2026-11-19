-- Comissão da revenda por cota vendida: administrador paga (com comprovante), revenda confirma o recebimento.
CREATE TABLE IF NOT EXISTS public.contempladas_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cota_id uuid NOT NULL REFERENCES public.contempladas_cotas(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  credito numeric(15,2) NOT NULL,
  proposta_id uuid REFERENCES public.contempladas_propostas(id) ON DELETE SET NULL,
  proposta_numero bigint,
  revenda_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revenda_nome text,
  dono_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dono_nome text,
  valor_comissao numeric(15,2) NOT NULL DEFAULT 0,
  valor_adicional numeric(15,2) NOT NULL DEFAULT 0,
  valor_desconto numeric(15,2) NOT NULL DEFAULT 0,
  valor numeric(15,2) NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PAGO', 'RECEBIDO', 'CANCELADO')),
  comprovante_path text,
  pago_em timestamptz,
  recebido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contempladas_comissoes_cota_ativa_idx ON public.contempladas_comissoes (cota_id) WHERE status <> 'CANCELADO';
CREATE INDEX IF NOT EXISTS contempladas_comissoes_dono_idx ON public.contempladas_comissoes (empresa_id, dono_auth_id, status);
CREATE INDEX IF NOT EXISTS contempladas_comissoes_revenda_idx ON public.contempladas_comissoes (empresa_id, revenda_auth_id, status);
ALTER TABLE public.contempladas_comissoes ENABLE ROW LEVEL SECURITY;
