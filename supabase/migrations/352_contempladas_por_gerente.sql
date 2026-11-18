-- Portal contempladas multiunidade: cada gerente é dono das cotas que sobe e tem
-- WhatsApp, PIX, ágio (imóvel/veículo), sinal de bloqueio e comissão próprios.
-- contempladas_config segue como padrão da empresa (usado pelo dono e por cotas antigas).

ALTER TABLE public.contempladas_config
  ADD COLUMN IF NOT EXISTS agio_auto_tipo text NOT NULL DEFAULT 'FIXO' CHECK (agio_auto_tipo IN ('PERCENTUAL', 'FIXO')),
  ADD COLUMN IF NOT EXISTS agio_auto_valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (agio_auto_valor >= 0),
  ADD COLUMN IF NOT EXISTS sinal_imovel numeric(15,2) NOT NULL DEFAULT 0 CHECK (sinal_imovel >= 0),
  ADD COLUMN IF NOT EXISTS sinal_auto numeric(15,2) NOT NULL DEFAULT 0 CHECK (sinal_auto >= 0);

CREATE TABLE IF NOT EXISTS public.contempladas_gerente_config (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  unidade text,
  whatsapp text,
  chave_pix text,
  chave_pix_tipo text NOT NULL DEFAULT 'CELULAR' CHECK (chave_pix_tipo IN ('CELULAR', 'EMAIL', 'CPF', 'CNPJ', 'ALEATORIA')),
  favorecido_pix text,
  agio_tipo text NOT NULL DEFAULT 'FIXO' CHECK (agio_tipo IN ('PERCENTUAL', 'FIXO')),
  agio_valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (agio_valor >= 0),
  agio_auto_tipo text NOT NULL DEFAULT 'FIXO' CHECK (agio_auto_tipo IN ('PERCENTUAL', 'FIXO')),
  agio_auto_valor numeric(15,2) NOT NULL DEFAULT 0 CHECK (agio_auto_valor >= 0),
  sinal_imovel numeric(15,2) NOT NULL DEFAULT 0 CHECK (sinal_imovel >= 0),
  sinal_auto numeric(15,2) NOT NULL DEFAULT 0 CHECK (sinal_auto >= 0),
  comissao_modo text NOT NULL DEFAULT 'TABELA' CHECK (comissao_modo IN ('TABELA', 'PERCENTUAL')),
  comissao_percentual numeric(6,3) NOT NULL DEFAULT 0,
  comissao_repasse_percentual numeric(6,2) NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, auth_user_id)
);
ALTER TABLE public.contempladas_gerente_config ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.contempladas_cotas
  ADD COLUMN IF NOT EXISTS dono_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dono_nome text;
CREATE INDEX IF NOT EXISTS contempladas_cotas_dono_idx ON public.contempladas_cotas (empresa_id, dono_auth_id);

ALTER TABLE public.contempladas_reservas
  ADD COLUMN IF NOT EXISTS dono_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_pix numeric(15,2);
