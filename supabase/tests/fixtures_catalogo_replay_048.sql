-- Fixture sintética e determinística para replay da migration histórica 048.
-- Uso exclusivo em branch Supabase descartável sem dados de Production.
-- Distribuição: grupos 1–7 com 10 produtos; grupos 8–19 com 9 produtos.
-- Total: 19 grupos e 178 produtos comerciais relacionados por FK.

BEGIN;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.grupos_consorcio) <> 0
     OR (SELECT count(*) FROM public.grupos_cotas) <> 0 THEN
    RAISE EXCEPTION 'Fixture 048 exige catálogo vazio';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.administradoras
    WHERE id = 'c5f8ecb4-cb5a-5014-b567-50484719b404'::uuid
      AND slug = 'racon'
      AND status = 'ATIVA'
  ) THEN
    RAISE EXCEPTION 'Racon canônica da migration 047 ausente';
  END IF;
END $$;

INSERT INTO public.grupos_consorcio (
  id,
  codigo_grupo,
  modalidade,
  administradora,
  administradora_id,
  ativo
)
SELECT
  md5('catalogo-080-grupo-' || lpad(numero::text, 3, '0'))::uuid,
  CASE WHEN numero = 8 THEN '5488' ELSE 'TESTE-' || lpad(numero::text, 3, '0') END,
  'Integral',
  CASE WHEN numero <= 16 THEN 'RACON' ELSE 'Racon' END,
  NULL,
  true
FROM generate_series(1, 19) AS numero;

INSERT INTO public.grupos_cotas (
  id,
  grupo_id,
  valor_credito,
  valor_parcela,
  parcela_integral,
  status,
  ativo,
  ordem
)
SELECT
  md5(
    'catalogo-080-produto-'
    || lpad(grupo_numero::text, 3, '0')
    || '-'
    || lpad(produto_numero::text, 2, '0')
  )::uuid,
  md5('catalogo-080-grupo-' || lpad(grupo_numero::text, 3, '0'))::uuid,
  50000 + (produto_numero * 10000) + (grupo_numero * 100),
  500 + (produto_numero * 100) + grupo_numero,
  500 + (produto_numero * 100) + grupo_numero,
  'Disponível',
  true,
  produto_numero
FROM generate_series(1, 19) AS grupo_numero
CROSS JOIN LATERAL generate_series(
  1,
  CASE WHEN grupo_numero <= 7 THEN 10 ELSE 9 END
) AS produto_numero;

DO $$
BEGIN
  IF (SELECT count(*) FROM public.grupos_consorcio) <> 19 THEN
    RAISE EXCEPTION 'Fixture inválida: esperado 19 grupos';
  END IF;
  IF (SELECT count(*) FROM public.grupos_cotas) <> 178 THEN
    RAISE EXCEPTION 'Fixture inválida: esperado 178 produtos';
  END IF;
  IF (SELECT count(*) FROM public.grupos_consorcio WHERE administradora = 'RACON') <> 16
     OR (SELECT count(*) FROM public.grupos_consorcio WHERE administradora = 'Racon') <> 3 THEN
    RAISE EXCEPTION 'Fixture inválida: aliases Racon não preservam 16/3';
  END IF;
END $$;

COMMIT;
