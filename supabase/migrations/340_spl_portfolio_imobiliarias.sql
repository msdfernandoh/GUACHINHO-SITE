-- Portfólio SPL (spl.<domínio>): imobiliárias parceiras, vendedores, clientes da
-- carteira SPL e empreendimentos. Tabelas novas e aditivas; nada existente muda.

CREATE TABLE IF NOT EXISTS public.spl_empreendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9-]{2,40}$'),
  nome text NOT NULL CHECK (char_length(trim(nome)) > 0),
  cidade text NOT NULL,
  entrega_texto text NOT NULL,
  entrega_data date,
  vendidas integer NOT NULL DEFAULT 0 CHECK (vendidas >= 0),
  disponiveis integer NOT NULL DEFAULT 0 CHECK (disponiveis >= 0),
  foto_url text,
  solucoes_recomendadas text[] NOT NULL DEFAULT '{}',
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, slug)
);

CREATE TABLE IF NOT EXISTS public.spl_imobiliarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  organizacao_parceira_id uuid REFERENCES public.organizacoes_parceiras(id) ON DELETE SET NULL,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 160),
  logo_url text,
  responsavel text NOT NULL CHECK (char_length(trim(responsavel)) BETWEEN 3 AND 160),
  telefone text NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  email text NOT NULL,
  cnpj text CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$'),
  chave_pix text,
  modelo_parceria text NOT NULL CHECK (modelo_parceria IN (
    'MICROFRANQUIA', 'GERADOR_NEGOCIOS', 'GERADOR_OPORTUNIDADES', 'SOMENTE_LIBERAR_CARTEIRA'
  )),
  quantidade_vendedores integer NOT NULL DEFAULT 0 CHECK (quantidade_vendedores BETWEEN 0 AND 1000),
  modelo_vendedores text NOT NULL DEFAULT 'PROPRIO' CHECK (modelo_vendedores IN (
    'PROPRIO', 'GERADOR_NEGOCIOS', 'GERADOR_OPORTUNIDADES'
  )),
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADA', 'RECUSADA', 'INATIVA')),
  exibir_logo boolean NOT NULL DEFAULT false,
  codigo_convite text NOT NULL CHECK (codigo_convite ~ '^[A-Z0-9]{6,20}$'),
  token_painel text NOT NULL CHECK (char_length(token_painel) >= 32),
  aprovado_em timestamptz,
  aprovado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT spl_imobiliarias_pix_chk CHECK (
    modelo_parceria = 'SOMENTE_LIBERAR_CARTEIRA' OR char_length(trim(coalesce(chave_pix, ''))) BETWEEN 3 AND 140
  ),
  UNIQUE (empresa_id, codigo_convite),
  UNIQUE (token_painel),
  UNIQUE (empresa_id, telefone)
);

CREATE TABLE IF NOT EXISTS public.spl_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  imobiliaria_id uuid NOT NULL REFERENCES public.spl_imobiliarias(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 3 AND 160),
  telefone text NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  email text,
  cpf text CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  chave_pix text,
  modelo text NOT NULL DEFAULT 'PROPRIO' CHECK (modelo IN ('PROPRIO', 'GERADOR_NEGOCIOS', 'GERADOR_OPORTUNIDADES')),
  codigo text NOT NULL CHECK (codigo ~ '^[A-Z0-9]{6,20}$'),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo),
  UNIQUE (imobiliaria_id, telefone)
);

CREATE TABLE IF NOT EXISTS public.spl_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  imobiliaria_id uuid NOT NULL REFERENCES public.spl_imobiliarias(id) ON DELETE CASCADE,
  vendedor_id uuid REFERENCES public.spl_vendedores(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  nome text NOT NULL CHECK (char_length(trim(nome)) BETWEEN 2 AND 160),
  telefone text NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  email text,
  empreendimento_slug text,
  unidade text,
  situacao text CHECK (situacao IS NULL OR situacao IN ('JA_COMPROU', 'VAI_COMPRAR')),
  valor_chaves numeric(15, 2) CHECK (valor_chaves IS NULL OR valor_chaves >= 0),
  solucao text CHECK (solucao IS NULL OR solucao IN (
    'CONSORCIO_SPL', 'CONSORCIO_ECONOMICO', 'CARTA_CONTEMPLADA', 'FINANCIAMENTO', 'HOME_EQUITY'
  )),
  status text NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO', 'EM_ATENDIMENTO', 'PROPOSTA', 'FECHADO', 'PERDIDO')),
  origem text NOT NULL DEFAULT 'PAINEL' CHECK (origem IN ('PAINEL', 'PLANILHA', 'PORTFOLIO')),
  proposta_expira_em timestamptz,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (imobiliaria_id, telefone)
);

CREATE INDEX IF NOT EXISTS spl_imobiliarias_empresa_status_idx ON public.spl_imobiliarias (empresa_id, status);
CREATE INDEX IF NOT EXISTS spl_vendedores_imobiliaria_idx ON public.spl_vendedores (imobiliaria_id);
CREATE INDEX IF NOT EXISTS spl_clientes_imobiliaria_idx ON public.spl_clientes (imobiliaria_id, status);
CREATE INDEX IF NOT EXISTS spl_clientes_empresa_idx ON public.spl_clientes (empresa_id, created_at DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['spl_empreendimentos', 'spl_imobiliarias', 'spl_vendedores', 'spl_clientes'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER %I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_select ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I_write ON public.%I', t, t);
    EXECUTE format('CREATE POLICY %I_write ON public.%I FOR ALL TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id))', t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', t);
  END LOOP;
END $$;

-- Empreendimentos SPL (dados da apresentação de nov/2026) para as empresas que
-- atendem raconsinop.com.br e raconsorriso.com.br: Gauchinho (site parceiro de
-- raconsinop.com.br), Racon Sinop e Racon Sorriso.
INSERT INTO public.spl_empreendimentos
  (empresa_id, slug, nome, cidade, entrega_texto, entrega_data, vendidas, disponiveis, foto_url, solucoes_recomendadas, ordem)
SELECT d.empresa_id, e.slug, e.nome, e.cidade, e.entrega_texto, e.entrega_data, e.vendidas, e.disponiveis, e.foto_url, e.solucoes, e.ordem
FROM (
  SELECT id AS empresa_id FROM public.empresas WHERE slug IN ('gauchinho', 'racon-sinop', 'sorriso')
) d
CROSS JOIN (VALUES
  ('acqua',  'Acqua',  'Sinop',   'Entregue',       NULL::date,   392, 62,  '/spl-img/acqua.jpg',  ARRAY['CARTA_CONTEMPLADA','HOME_EQUITY','FINANCIAMENTO'], 1),
  ('ares',   'Ares',   'Sinop',   'Julho/2027',     '2027-07-01', 309, 72,  '/spl-img/ares.webp',  ARRAY['CARTA_CONTEMPLADA','HOME_EQUITY','FINANCIAMENTO','CONSORCIO_SPL'], 2),
  ('gaia',   'Gaia',   'Sinop',   'Setembro/2028',  '2028-09-01', 246, 138, '/spl-img/gaia.jpg',   ARRAY['CONSORCIO_SPL','CARTA_CONTEMPLADA'], 3),
  ('etna',   'Etna',   'Sinop',   'Setembro/2029',  '2029-09-01', 129, 235, '/spl-img/etna.jpg',   ARRAY['CONSORCIO_SPL'], 4),
  ('prisma', 'Prisma', 'Sorriso', 'Abril/2027',     '2027-04-01', 212, 172, '/spl-img/prisma.jpg', ARRAY['CONSORCIO_SPL','CARTA_CONTEMPLADA','HOME_EQUITY'], 5),
  ('serena', 'Serena', 'Sorriso', 'Abril/2028',     '2028-04-01', 279, 232, '/spl-img/serena.jpg', ARRAY['CONSORCIO_SPL','CARTA_CONTEMPLADA','FINANCIAMENTO','HOME_EQUITY'], 6)
) AS e(slug, nome, cidade, entrega_texto, entrega_data, vendidas, disponiveis, foto_url, solucoes, ordem)
ON CONFLICT (empresa_id, slug) DO NOTHING;

-- Parâmetros do portfólio (margem das cartas, taxas de referência, grupos dos planos).
INSERT INTO public.configuracoes_sistema (chave, valor)
VALUES ('spl_portfolio', jsonb_build_object(
  'margemEntradaCarta', 10000,
  'taxaHomeEquityMensal', 1.85,
  'grupoSpl', '1553', 'reduzidaSpl', 70, 'embutidoSpl', 25,
  'grupoEconomico', '1563', 'reduzidaEconomico', 60, 'embutidoEconomico', 25,
  'validadePropostaHoras', 48
))
ON CONFLICT (chave) DO NOTHING;
