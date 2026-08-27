-- 147 — UUID do tipo é a fonte canônica; texto legado permanece sincronizado.
-- Corrige divergências como 1173: tipo_administradora_id=Imóvel e modalidade=Moto.
BEGIN;

UPDATE public.grupos_consorcio g
SET modalidade = t.nome,
    updated_at = now()
FROM public.administradora_tipos t
WHERE t.id = g.tipo_administradora_id
  AND g.modalidade IS DISTINCT FROM t.nome;

CREATE OR REPLACE FUNCTION public.sync_grupo_modalidade_tipo_canonico()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_tipo_nome text;
BEGIN
  IF NEW.tipo_administradora_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_tipo_nome
  FROM public.administradora_tipos
  WHERE id = NEW.tipo_administradora_id;

  IF v_tipo_nome IS NULL THEN
    RAISE EXCEPTION 'Tipo oficial da administradora não encontrado';
  END IF;

  NEW.modalidade := v_tipo_nome;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_grupo_modalidade_tipo_canonico
  ON public.grupos_consorcio;
CREATE TRIGGER trg_sync_grupo_modalidade_tipo_canonico
BEFORE INSERT OR UPDATE OF tipo_administradora_id, modalidade
ON public.grupos_consorcio
FOR EACH ROW
EXECUTE FUNCTION public.sync_grupo_modalidade_tipo_canonico();

CREATE OR REPLACE FUNCTION public.sync_grupos_apos_renomear_tipo_administradora()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome THEN
    UPDATE public.grupos_consorcio
    SET modalidade = NEW.nome,
        updated_at = now()
    WHERE tipo_administradora_id = NEW.id
      AND modalidade IS DISTINCT FROM NEW.nome;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_grupos_apos_renomear_tipo_administradora
  ON public.administradora_tipos;
CREATE TRIGGER trg_sync_grupos_apos_renomear_tipo_administradora
AFTER UPDATE OF nome
ON public.administradora_tipos
FOR EACH ROW
EXECUTE FUNCTION public.sync_grupos_apos_renomear_tipo_administradora();

COMMENT ON COLUMN public.grupos_consorcio.modalidade IS
  'Snapshot textual legado sincronizado a partir de tipo_administradora_id. Não usar como fonte estrutural.';

CREATE TABLE IF NOT EXISTS public.grupos_creditos_reajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  marco_meses integer NOT NULL CHECK (marco_meses >= 12 AND marco_meses % 12 = 0),
  percentual_referencia numeric(10,4),
  valores_anteriores jsonb NOT NULL,
  valores_novos jsonb NOT NULL,
  observacao text,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, marco_meses)
);

ALTER TABLE public.grupos_creditos_reajustes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS grupos_creditos_reajustes_platform_read ON public.grupos_creditos_reajustes;
CREATE POLICY grupos_creditos_reajustes_platform_read
ON public.grupos_creditos_reajustes FOR SELECT TO authenticated
USING (public.is_platform_superadmin());

CREATE OR REPLACE FUNCTION public.rpc_platform_reajustar_creditos_grupo(
  p_grupo_id uuid,
  p_marco_meses integer,
  p_percentual_referencia numeric,
  p_creditos jsonb,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_item jsonb;
  v_cota public.grupos_cotas%ROWTYPE;
  v_anteriores jsonb := '[]'::jsonb;
  v_novos jsonb := '[]'::jsonb;
  v_total integer := 0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode reajustar créditos globais';
  END IF;
  IF p_marco_meses < 12 OR p_marco_meses % 12 <> 0 THEN
    RAISE EXCEPTION 'O marco do reajuste deve ser múltiplo de 12 meses';
  END IF;
  IF jsonb_typeof(p_creditos) <> 'array' OR jsonb_array_length(p_creditos) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um crédito para reajuste';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio
  WHERE id = p_grupo_id FOR UPDATE;
  IF v_grupo.id IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;
  IF coalesce(v_grupo.credito_reajustado_ate_meses,0) >= p_marco_meses THEN
    RAISE EXCEPTION 'O marco de % meses já foi reajustado', p_marco_meses;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_creditos)
  LOOP
    IF coalesce(v_item->>'id','') !~* '^[0-9a-f-]{36}$'
       OR coalesce((v_item->>'valor_credito')::numeric,0) <= 0 THEN
      RAISE EXCEPTION 'Crédito inválido no reajuste';
    END IF;
    SELECT * INTO v_cota FROM public.grupos_cotas
    WHERE id=(v_item->>'id')::uuid AND grupo_id=p_grupo_id AND ativo
    FOR UPDATE;
    IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Crédito não pertence ao grupo ou está inativo'; END IF;

    v_anteriores := v_anteriores || jsonb_build_array(jsonb_build_object(
      'id',v_cota.id,'valor_credito',v_cota.valor_credito));
    UPDATE public.grupos_cotas
    SET valor_credito=round((v_item->>'valor_credito')::numeric,2), updated_at=now()
    WHERE id=v_cota.id;
    v_novos := v_novos || jsonb_build_array(jsonb_build_object(
      'id',v_cota.id,'valor_credito',round((v_item->>'valor_credito')::numeric,2)));
    v_total := v_total + 1;
  END LOOP;

  UPDATE public.grupos_consorcio SET
    credito_reajustado_ate_meses=p_marco_meses,
    updated_at=now()
  WHERE id=p_grupo_id;

  INSERT INTO public.grupos_creditos_reajustes(
    grupo_id,marco_meses,percentual_referencia,valores_anteriores,valores_novos,
    observacao,usuario_id
  ) VALUES (
    p_grupo_id,p_marco_meses,p_percentual_referencia,v_anteriores,v_novos,
    nullif(trim(p_observacao),''),public.current_usuario_id()
  );

  RETURN jsonb_build_object('grupo_id',p_grupo_id,'marco_meses',p_marco_meses,'creditos_atualizados',v_total);
END;
$$;

REVOKE ALL ON TABLE public.grupos_creditos_reajustes FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.grupos_creditos_reajustes TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_platform_reajustar_creditos_grupo(uuid,integer,numeric,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_reajustar_creditos_grupo(uuid,integer,numeric,jsonb,text) TO authenticated;

REVOKE ALL ON FUNCTION public.sync_grupo_modalidade_tipo_canonico() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_grupos_apos_renomear_tipo_administradora() FROM PUBLIC, anon, authenticated;

COMMIT;
