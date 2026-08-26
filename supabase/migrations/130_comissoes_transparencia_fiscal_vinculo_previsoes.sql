-- 130: Integridade do vínculo participante -> previsão da franquia
-- Permite exibir a composição fiscal a partir do snapshot original, sem recálculo.

BEGIN;

-- Recupera previsões antigas geradas pela V2, cujo vínculo existia apenas no snapshot JSON.
UPDATE public.comissao_previsoes_participantes p
SET previsao_franquia_id = (p.snapshot_regra->>'fonte_previsao_franquia_id')::uuid
WHERE p.previsao_franquia_id IS NULL
  AND coalesce(p.snapshot_regra->>'fonte_previsao_franquia_id', '')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.comissao_previsoes_franquia f
    WHERE f.id = (p.snapshot_regra->>'fonte_previsao_franquia_id')::uuid
      AND f.empresa_id = p.empresa_id
      AND f.venda_id = p.venda_id
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comissao_prev_part_previsao_franquia_fkey'
      AND conrelid = 'public.comissao_previsoes_participantes'::regclass
  ) THEN
    ALTER TABLE public.comissao_previsoes_participantes
      ADD CONSTRAINT comissao_prev_part_previsao_franquia_fkey
      FOREIGN KEY (previsao_franquia_id)
      REFERENCES public.comissao_previsoes_franquia(id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS comissao_prev_part_empresa_part_competencia_idx
  ON public.comissao_previsoes_participantes
  (empresa_id, participante_comercial_id, competencia);
CREATE INDEX IF NOT EXISTS comissao_prev_part_empresa_franquia_idx
  ON public.comissao_previsoes_participantes
  (empresa_id, previsao_franquia_id)
  WHERE previsao_franquia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validar_previsao_participante_franquia_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.previsao_franquia_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.comissao_previsoes_franquia f
    WHERE f.id = NEW.previsao_franquia_id
      AND f.empresa_id = NEW.empresa_id
      AND f.venda_id = NEW.venda_id
  ) THEN
    RAISE EXCEPTION 'Previsão da franquia não pertence à mesma empresa e venda';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validar_previsao_participante_franquia_tenant()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_validar_previsao_participante_franquia_tenant
  ON public.comissao_previsoes_participantes;
CREATE TRIGGER trg_validar_previsao_participante_franquia_tenant
BEFORE INSERT OR UPDATE OF empresa_id, venda_id, previsao_franquia_id
ON public.comissao_previsoes_participantes
FOR EACH ROW
EXECUTE FUNCTION public.validar_previsao_participante_franquia_tenant();

COMMIT;

NOTIFY pgrst, 'reload schema';
