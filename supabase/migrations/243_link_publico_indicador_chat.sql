-- 243: Link público não enumerável para indicação, isolado por tenant.
-- A coluna é aditiva: indicadores e indicações históricas permanecem intactos.
BEGIN;

ALTER TABLE public.programa_indicadores
  ADD COLUMN IF NOT EXISTS codigo_indicacao uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS programa_indicadores_codigo_indicacao_empresa_uidx
  ON public.programa_indicadores (empresa_id, codigo_indicacao);

COMMENT ON COLUMN public.programa_indicadores.codigo_indicacao IS
  'Token público não enumerável do link de indicação. Só é resolvido junto ao empresa_id derivado do host.';

COMMIT;

NOTIFY pgrst, 'reload schema';
