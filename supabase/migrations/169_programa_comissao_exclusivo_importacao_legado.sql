BEGIN;

ALTER TABLE public.comissao_programas
  ADD COLUMN IF NOT EXISTS uso_exclusivo_importacao_legado boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.comissao_programas.uso_exclusivo_importacao_legado IS
  'Quando verdadeiro, o programa fica disponível somente na importação histórica e não participa do motor canônico de novas vendas.';

CREATE INDEX IF NOT EXISTS comissao_programas_importacao_legado_idx
  ON public.comissao_programas (empresa_id, administradora_id, uso_exclusivo_importacao_legado)
  WHERE uso_exclusivo_importacao_legado;

CREATE OR REPLACE FUNCTION public.rpc_platform_definir_programa_importacao_legado(
  p_programa_id uuid,
  p_exclusivo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_programa public.comissao_programas%ROWTYPE;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin';
  END IF;

  SELECT * INTO v_programa
  FROM public.comissao_programas
  WHERE id = p_programa_id
  FOR UPDATE;

  IF v_programa.id IS NULL THEN
    RAISE EXCEPTION 'Programa de comissão não encontrado';
  END IF;

  IF coalesce(p_exclusivo, false) AND v_programa.status NOT IN ('RASCUNHO', 'INATIVO') THEN
    RAISE EXCEPTION 'Somente programas em rascunho ou inativos podem ser reservados para importação histórica';
  END IF;

  UPDATE public.comissao_programas
  SET uso_exclusivo_importacao_legado = coalesce(p_exclusivo, false),
      status = CASE
        WHEN coalesce(p_exclusivo, false) THEN 'INATIVO'
        WHEN v_programa.status = 'INATIVO' THEN 'RASCUNHO'
        ELSE status
      END,
      ativo = CASE WHEN coalesce(p_exclusivo, false) THEN false ELSE ativo END,
      updated_at = now()
  WHERE id = p_programa_id
  RETURNING * INTO v_programa;

  IF coalesce(p_exclusivo, false) THEN
    UPDATE public.comissao_regras_franquia
    SET ativa = false,
        configuracao_homologada = false,
        updated_at = now()
    WHERE programa_id = p_programa_id;
  END IF;

  PERFORM public.platform_catalogo_auditar(
    CASE WHEN coalesce(p_exclusivo, false) THEN 'reservar_importacao_legado' ELSE 'liberar_importacao_legado' END,
    'comissao_programas',
    p_programa_id,
    '["uso_exclusivo_importacao_legado","status","ativo"]'::jsonb
  );

  RETURN jsonb_build_object(
    'programa_id', v_programa.id,
    'uso_exclusivo_importacao_legado', v_programa.uso_exclusivo_importacao_legado,
    'status', v_programa.status,
    'ativo', v_programa.ativo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_platform_definir_programa_importacao_legado(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_definir_programa_importacao_legado(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.proteger_programa_exclusivo_importacao_legado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.uso_exclusivo_importacao_legado AND (NEW.ativo OR NEW.status = 'ATIVO') THEN
    RAISE EXCEPTION 'Programa exclusivo de importação histórica não pode ser ativado para novas vendas';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_programa_exclusivo_importacao_legado ON public.comissao_programas;
CREATE TRIGGER trg_proteger_programa_exclusivo_importacao_legado
BEFORE INSERT OR UPDATE OF ativo, status, uso_exclusivo_importacao_legado
ON public.comissao_programas
FOR EACH ROW
EXECUTE FUNCTION public.proteger_programa_exclusivo_importacao_legado();

COMMIT;
NOTIFY pgrst, 'reload schema';
