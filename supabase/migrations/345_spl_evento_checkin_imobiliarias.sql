-- 345 · Check-in SPL no evento "Chaves para o Futuro"
-- Corretor escolhe a imobiliária (pré-cadastrada), indica clientes (1 cupom por cliente),
-- responde o desafio do primeiro consórcio, as perguntas do check-in e o NPS.
-- Idempotente. Não apaga dados existentes.

BEGIN;

/* 1. Imobiliárias pré-cadastradas: só o nome; o proprietário completa depois. */
ALTER TABLE public.spl_imobiliarias ALTER COLUMN responsavel DROP NOT NULL;
ALTER TABLE public.spl_imobiliarias ALTER COLUMN telefone DROP NOT NULL;
ALTER TABLE public.spl_imobiliarias ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.spl_imobiliarias ALTER COLUMN modelo_parceria DROP NOT NULL;
ALTER TABLE public.spl_imobiliarias
  ADD COLUMN IF NOT EXISTS cadastro_completo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS origem_cadastro text NOT NULL DEFAULT 'PORTFOLIO';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spl_imobiliarias_origem_cadastro_chk') THEN
    ALTER TABLE public.spl_imobiliarias
      ADD CONSTRAINT spl_imobiliarias_origem_cadastro_chk
      CHECK (origem_cadastro IN ('PORTFOLIO', 'PRE_CADASTRO', 'EVENTO'));
  END IF;
END $$;

/* 2. Vendedor: função na imobiliária. */
ALTER TABLE public.spl_vendedores ADD COLUMN IF NOT EXISTS funcao text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spl_vendedores_funcao_chk') THEN
    ALTER TABLE public.spl_vendedores
      ADD CONSTRAINT spl_vendedores_funcao_chk CHECK (funcao IS NULL OR funcao IN ('COLABORADOR', 'PROPRIETARIO'));
  END IF;
END $$;

/* 3. Clientes indicados no evento: origem EVENTO + cupom gerado. */
ALTER TABLE public.spl_clientes
  ADD COLUMN IF NOT EXISTS evento_id uuid REFERENCES public.eventos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cupom_codigo text;
ALTER TABLE public.spl_clientes DROP CONSTRAINT IF EXISTS spl_clientes_origem_check;
ALTER TABLE public.spl_clientes
  ADD CONSTRAINT spl_clientes_origem_check CHECK (origem IN ('PAINEL', 'PLANILHA', 'PORTFOLIO', 'EVENTO'));
CREATE INDEX IF NOT EXISTS spl_clientes_evento_idx ON public.spl_clientes (evento_id) WHERE evento_id IS NOT NULL;

/* 4. Evento: qual fluxo de check-in a página pública usa. */
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS checkin_fluxo text NOT NULL DEFAULT 'padrao';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'eventos_checkin_fluxo_chk') THEN
    ALTER TABLE public.eventos
      ADD CONSTRAINT eventos_checkin_fluxo_chk CHECK (checkin_fluxo IN ('padrao', 'spl_imobiliarias'));
  END IF;
END $$;

/* 5. As 15 imobiliárias do evento (empresa gauchinho, que atende raconsinop.com.br). */
INSERT INTO public.spl_imobiliarias (
  empresa_id, nome, status, cadastro_completo, origem_cadastro, codigo_convite, token_painel
)
SELECT e.id, n.nome, 'PENDENTE', false, 'PRE_CADASTRO',
       upper(substr(md5(random()::text || clock_timestamp()::text || n.nome), 1, 8)),
       md5(random()::text || n.nome) || md5(clock_timestamp()::text || n.nome)
FROM public.empresas e
CROSS JOIN (VALUES
  ('Invista Sinop'), ('Snp Vertical'), ('Gadani Imóveis'), ('Tozi Imóveis'), ('Casa Gold'),
  ('Morar Bem'), ('Lopes'), ('X2'), ('Realizare'), ('SPL Vendas'),
  ('SYARA'), ('Top Imóveis'), ('VICTORUM'), ('Dumatto'), ('Elite')
) AS n(nome)
WHERE e.slug = 'gauchinho'
  AND NOT EXISTS (
    SELECT 1 FROM public.spl_imobiliarias i
    WHERE i.empresa_id = e.id AND lower(trim(i.nome)) = lower(trim(n.nome))
  );

/* 6. Evento "Chaves para o Futuro" — 17/11/2026 08:00 (Sinop, UTC-4), check-in já aberto para teste. */
INSERT INTO public.eventos (
  nome, slug, descricao_curta, data_evento, local, cidade, estado,
  ativo, publicado, somente_por_link, inscricao_tipo,
  checkin_interativo_ativo, checkin_modo, checkin_abertura_antecipada_minutos,
  tipo_checkin, checkin_fluxo, prefixo_codigo_sorteio, cor_primaria, cor_secundaria,
  logo_personalizado_url
)
SELECT 'Chaves para o Futuro · Encontro de Imobiliárias', 'chaves-para-o-futuro',
       'SPL Engenharia × Racon Consórcios', '2026-11-17T12:00:00+00:00', 'Encontro SPL', 'SINOP', 'MT',
       true, true, true, 'interno',
       true, 'ativo_agora', 30,
       'evento', 'spl_imobiliarias', 'SPL-', '#F59E0B', '#0A1931',
       '/spl-img/logo-racon-gauchinho.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM public.eventos WHERE slug = 'chaves-para-o-futuro');

INSERT INTO public.eventos_sorteios (evento_id, ativo, titulo, status)
SELECT ev.id, true, 'Sorteio · Chaves para o Futuro', 'aberto'
FROM public.eventos ev
WHERE ev.slug = 'chaves-para-o-futuro'
  AND NOT EXISTS (SELECT 1 FROM public.eventos_sorteios s WHERE s.evento_id = ev.id);

/* 7. Inativa os eventos que estavam respondendo ao QR fixo /qr/network. */
UPDATE public.eventos SET ativo = false
WHERE slug IN ('network-de-negocios', 'do-salario-ao-patrimonio') AND ativo = true;

NOTIFY pgrst, 'reload schema';

COMMIT;
