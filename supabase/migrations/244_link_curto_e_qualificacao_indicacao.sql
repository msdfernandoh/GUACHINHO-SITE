-- 244: código curto de compartilhamento e qualificação do cadastro por link.
-- Forward-only: não remove nem reinterpreta registros existentes.
BEGIN;

ALTER TABLE public.programa_indicadores
  ADD COLUMN IF NOT EXISTS codigo_indicacao_curto text;

CREATE OR REPLACE FUNCTION public.programa_indicadores_gerar_codigo_curto()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_codigo text;
BEGIN
  IF NEW.codigo_indicacao_curto IS NULL OR btrim(NEW.codigo_indicacao_curto) = '' THEN
    LOOP
      v_codigo := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.programa_indicadores
        WHERE empresa_id = NEW.empresa_id AND codigo_indicacao_curto = v_codigo
      );
    END LOOP;
    NEW.codigo_indicacao_curto := v_codigo;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programa_indicadores_gerar_codigo_curto ON public.programa_indicadores;
CREATE TRIGGER programa_indicadores_gerar_codigo_curto
  BEFORE INSERT OR UPDATE OF codigo_indicacao_curto ON public.programa_indicadores
  FOR EACH ROW EXECUTE FUNCTION public.programa_indicadores_gerar_codigo_curto();

UPDATE public.programa_indicadores
SET codigo_indicacao_curto = NULL
WHERE codigo_indicacao_curto IS NULL;

ALTER TABLE public.programa_indicadores
  ALTER COLUMN codigo_indicacao_curto SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS programa_indicadores_codigo_curto_empresa_uidx
  ON public.programa_indicadores (empresa_id, codigo_indicacao_curto);

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS estrategia_credito text,
  ADD COLUMN IF NOT EXISTS prazo_utilizacao_credito text;

COMMENT ON COLUMN public.programa_indicadores.codigo_indicacao_curto IS
  'Código curto aleatório de compartilhamento, resolvido somente com o tenant derivado do host.';
COMMENT ON COLUMN public.leads.estrategia_credito IS
  'Objetivo estratégico informado no formulário público de indicação.';
COMMENT ON COLUMN public.leads.prazo_utilizacao_credito IS
  'Prazo pretendido para utilização do crédito informado no formulário público de indicação.';

COMMIT;

NOTIFY pgrst, 'reload schema';
