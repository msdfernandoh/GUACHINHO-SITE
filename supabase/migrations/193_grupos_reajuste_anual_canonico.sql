-- 193 — Regra canônica de reajuste anual dos grupos.
-- Grupos existentes permanecem sem regra até edição explícita.
BEGIN;

ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS tipo_reajuste_anual text,
  ADD COLUMN IF NOT EXISTS reajuste_anual_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS reajuste_anual_indice text;

ALTER TABLE public.grupos_consorcio
  DROP CONSTRAINT IF EXISTS grupos_consorcio_reajuste_anual_check;
ALTER TABLE public.grupos_consorcio
  ADD CONSTRAINT grupos_consorcio_reajuste_anual_check CHECK (
    (tipo_reajuste_anual IS NULL AND reajuste_anual_percentual IS NULL AND reajuste_anual_indice IS NULL)
    OR
    (tipo_reajuste_anual = 'FIXO' AND reajuste_anual_percentual > 0 AND reajuste_anual_percentual <= 100 AND reajuste_anual_indice IS NULL)
    OR
    (tipo_reajuste_anual = 'VARIAVEL' AND reajuste_anual_percentual IS NULL AND nullif(btrim(reajuste_anual_indice), '') IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.rpc_salvar_reajuste_anual_grupo(
  p_grupo_id uuid,
  p_tipo text,
  p_percentual numeric DEFAULT NULL,
  p_indice text DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL,
  p_solicitacao_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_tipo text := upper(nullif(btrim(p_tipo), ''));
  v_indice text := nullif(btrim(p_indice), '');
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_solicitacao public.catalogo_grupo_solicitacoes%ROWTYPE;
BEGIN
  IF v_tipo NOT IN ('FIXO', 'VARIAVEL') THEN
    RAISE EXCEPTION 'Informe se o reajuste anual é fixo ou variável';
  END IF;
  IF v_tipo = 'FIXO' AND (p_percentual IS NULL OR p_percentual <= 0 OR p_percentual > 100) THEN
    RAISE EXCEPTION 'Informe um percentual fixo maior que 0 e menor ou igual a 100';
  END IF;
  IF v_tipo = 'VARIAVEL' AND v_indice IS NULL THEN
    RAISE EXCEPTION 'Informe o nome do índice ou alíquota do reajuste variável';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id FOR UPDATE;
  IF v_grupo.id IS NULL THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;

  IF public.is_platform_superadmin() THEN
    UPDATE public.grupos_consorcio SET
      tipo_reajuste_anual = v_tipo,
      reajuste_anual_percentual = CASE WHEN v_tipo = 'FIXO' THEN p_percentual ELSE NULL END,
      reajuste_anual_indice = CASE WHEN v_tipo = 'VARIAVEL' THEN v_indice ELSE NULL END,
      updated_at = now()
    WHERE id = p_grupo_id;
  ELSE
    IF auth.uid() IS NULL OR p_empresa_id IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
      RAISE EXCEPTION 'Acesso negado';
    END IF;
    SELECT * INTO v_solicitacao
    FROM public.catalogo_grupo_solicitacoes
    WHERE id = p_solicitacao_id AND empresa_id = p_empresa_id AND grupo_id = p_grupo_id
    FOR UPDATE;
    IF v_solicitacao.id IS NULL THEN RAISE EXCEPTION 'Solicitação do grupo não encontrada'; END IF;

    UPDATE public.catalogo_grupo_solicitacoes SET
      payload = payload || jsonb_build_object(
        'tipo_reajuste_anual', v_tipo,
        'reajuste_anual_percentual', CASE WHEN v_tipo = 'FIXO' THEN to_jsonb(p_percentual) ELSE 'null'::jsonb END,
        'reajuste_anual_indice', CASE WHEN v_tipo = 'VARIAVEL' THEN to_jsonb(v_indice) ELSE 'null'::jsonb END
      ),
      atualizado_em = now()
    WHERE id = v_solicitacao.id;

    IF v_grupo.origem_governanca = 'LOCAL' AND v_grupo.empresa_origem_id = p_empresa_id THEN
      UPDATE public.grupos_consorcio SET
        tipo_reajuste_anual = v_tipo,
        reajuste_anual_percentual = CASE WHEN v_tipo = 'FIXO' THEN p_percentual ELSE NULL END,
        reajuste_anual_indice = CASE WHEN v_tipo = 'VARIAVEL' THEN v_indice ELSE NULL END,
        updated_at = now()
      WHERE id = p_grupo_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('grupo_id', p_grupo_id, 'tipo', v_tipo);
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_aplicar_reajuste_anual_solicitacao_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_tipo text := upper(nullif(btrim(NEW.payload->>'tipo_reajuste_anual'), ''));
BEGIN
  IF NEW.status = 'APROVADA' AND OLD.status IS DISTINCT FROM NEW.status AND v_tipo IN ('FIXO', 'VARIAVEL') THEN
    UPDATE public.grupos_consorcio SET
      tipo_reajuste_anual = v_tipo,
      reajuste_anual_percentual = CASE WHEN v_tipo = 'FIXO' THEN nullif(NEW.payload->>'reajuste_anual_percentual', '')::numeric ELSE NULL END,
      reajuste_anual_indice = CASE WHEN v_tipo = 'VARIAVEL' THEN nullif(btrim(NEW.payload->>'reajuste_anual_indice'), '') ELSE NULL END,
      updated_at = now()
    WHERE id = NEW.grupo_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aplicar_reajuste_anual_solicitacao_aprovada ON public.catalogo_grupo_solicitacoes;
CREATE TRIGGER aplicar_reajuste_anual_solicitacao_aprovada
  AFTER UPDATE OF status ON public.catalogo_grupo_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.trg_aplicar_reajuste_anual_solicitacao_aprovada();

REVOKE ALL ON FUNCTION public.rpc_salvar_reajuste_anual_grupo(uuid,text,numeric,text,uuid,uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_reajuste_anual_grupo(uuid,text,numeric,text,uuid,uuid) TO authenticated;

COMMENT ON COLUMN public.grupos_consorcio.tipo_reajuste_anual IS 'Regra anual canônica: FIXO ou VARIAVEL.';
COMMENT ON COLUMN public.grupos_consorcio.reajuste_anual_percentual IS 'Percentual anual quando a regra é FIXO.';
COMMENT ON COLUMN public.grupos_consorcio.reajuste_anual_indice IS 'Nome do índice/alíquota quando a regra é VARIAVEL.';

COMMIT;
NOTIFY pgrst, 'reload schema';
