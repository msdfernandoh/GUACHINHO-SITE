-- Portal de cotas contempladas para franquias (contempladas.<domínio>).
-- Estoque próprio, propostas numeradas, pré-reservas (só escassez), reservas
-- com PIX (bloqueiam a cota) e autorização de envio por usuário do ERP.
-- Tabelas novas e aditivas: cartas_contempladas e demais dados não mudam.

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS contempladas_pode_enviar boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.contempladas_config (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  pre_reserva_minutos integer NOT NULL DEFAULT 120 CHECK (pre_reserva_minutos BETWEEN 5 AND 10080),
  whatsapp text,
  chave_pix text,
  favorecido_pix text,
  -- TABELA: usa a comissão de cada cota. PERCENTUAL: % do crédito.
  comissao_modo text NOT NULL DEFAULT 'TABELA' CHECK (comissao_modo IN ('TABELA', 'PERCENTUAL')),
  comissao_percentual numeric(6,3) NOT NULL DEFAULT 0,
  -- Parte da comissão da tabela repassada ao usuário logado (100 = tudo).
  comissao_repasse_percentual numeric(6,2) NOT NULL DEFAULT 100,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contempladas_lotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  acrescimo_tipo text NOT NULL CHECK (acrescimo_tipo IN ('PERCENTUAL', 'FIXO')),
  acrescimo_valor numeric(15,2) NOT NULL DEFAULT 0,
  substituiu boolean NOT NULL DEFAULT false,
  quantidade integer NOT NULL DEFAULT 0,
  texto_original text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contempladas_cotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  lote_id uuid REFERENCES public.contempladas_lotes(id) ON DELETE SET NULL,
  codigo text NOT NULL,
  administradora text NOT NULL DEFAULT 'racon',
  tipo text NOT NULL DEFAULT 'imovel' CHECK (tipo IN ('imovel', 'automovel')),
  credito numeric(15,2) NOT NULL CHECK (credito > 0),
  entrada_original numeric(15,2) NOT NULL CHECK (entrada_original >= 0),
  entrada_acrescimo numeric(15,2) NOT NULL DEFAULT 0,
  entrada numeric(15,2) NOT NULL CHECK (entrada >= 0),
  prazo integer NOT NULL CHECK (prazo > 0),
  parcela numeric(15,2) NOT NULL CHECK (parcela >= 0),
  saldo_devedor numeric(15,2) NOT NULL DEFAULT 0,
  vencimento_mes integer CHECK (vencimento_mes BETWEEN 1 AND 12),
  comissao_parceiro numeric(15,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL', 'RESERVADA', 'VENDIDA', 'INATIVA')),
  reservada_ate timestamptz,
  texto_original text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo)
);
CREATE INDEX IF NOT EXISTS contempladas_cotas_status_idx ON public.contempladas_cotas (empresa_id, status);

CREATE SEQUENCE IF NOT EXISTS public.contempladas_proposta_numero_seq START 1001;

CREATE TABLE IF NOT EXISTS public.contempladas_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  numero bigint NOT NULL DEFAULT nextval('public.contempladas_proposta_numero_seq') UNIQUE,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cliente_nome text,
  cliente_telefone text,
  cota_ids uuid[] NOT NULL,
  -- Fotografia das cotas no momento da proposta (reimpressão fiel).
  cotas_snapshot jsonb NOT NULL,
  acrescimo_tipo text CHECK (acrescimo_tipo IN ('PERCENTUAL', 'FIXO')),
  acrescimo_valor numeric(15,2) NOT NULL DEFAULT 0,
  modo_simulacao text NOT NULL DEFAULT 'COMPLETA' CHECK (modo_simulacao IN ('COMPLETA', 'MENSAL', 'SEMESTRAL', 'ANUAL', 'RESUMO')),
  credito_total numeric(15,2) NOT NULL,
  entrada_total numeric(15,2) NOT NULL,
  saldo_total numeric(15,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contempladas_reservas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  proposta_id uuid REFERENCES public.contempladas_propostas(id) ON DELETE SET NULL,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  cota_ids uuid[] NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('PRE', 'PIX')),
  status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'EXPIRADA', 'CONFIRMADA', 'CANCELADA')),
  nome text NOT NULL,
  telefone text NOT NULL,
  comprovante_path text,
  expira_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contempladas_reservas_ativas_idx ON public.contempladas_reservas (empresa_id, status, tipo);

CREATE TABLE IF NOT EXISTS public.contempladas_simulacoes (
  id bigserial PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  credito numeric(15,2),
  entrada_max numeric(15,2),
  preferencia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Acesso só pelo servidor (service role); nada exposto ao anon.
ALTER TABLE public.contempladas_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_cotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contempladas_simulacoes ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public)
VALUES ('contempladas-comprovantes', 'contempladas-comprovantes', false)
ON CONFLICT (id) DO NOTHING;
