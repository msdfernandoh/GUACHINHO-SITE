-- 216 — Operacionalização do reajuste anual de grupos
-- Adiciona colunas para controle do ano do último reajuste e RPCs operacionais
BEGIN;

ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS ano_ultimo_reajuste integer,
  ADD COLUMN IF NOT EXISTS data_ultimo_reajuste timestamptz;

COMMENT ON COLUMN public.grupos_consorcio.ano_ultimo_reajuste IS 'Ano em que o reajuste anual do grupo foi realizado ou dispensado no ciclo.';
COMMENT ON COLUMN public.grupos_consorcio.data_ultimo_reajuste IS 'Data e hora do último reajuste anual ou dispensa da tag.';

-- RPC para marcar grupo como já reajustado (dispensar a tag de atenção)
CREATE OR REPLACE FUNCTION public.rpc_marcar_grupo_reajustado(
  p_grupo_id uuid,
  p_ano integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_ano integer := coalesce(p_ano, extract(year from now())::integer);
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode marcar grupos como reajustados';
  END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio
  WHERE id = p_grupo_id FOR UPDATE;

  IF v_grupo.id IS NULL THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;

  UPDATE public.grupos_consorcio SET
    ano_ultimo_reajuste = v_ano,
    data_ultimo_reajuste = now(),
    updated_at = now()
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object(
    'ok', true,
    'grupo_id', p_grupo_id,
    'ano_ultimo_reajuste', v_ano
  );
END;
$$;

-- Atualização da RPC de reajuste de créditos para também persistir ano_ultimo_reajuste e data_ultimo_reajuste
CREATE OR REPLACE FUNCTION public.rpc_platform_reajustar_creditos_grupo(
  p_grupo_id uuid,
  p_marco_meses integer,
  p_percentual_referencia numeric,
  p_creditos jsonb,
  p_observacao text DEFAULT NULL,
  p_ano integer DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_item jsonb;
  v_cota public.grupos_cotas%ROWTYPE;
  v_anteriores jsonb := '[]'::jsonb;
  v_novos jsonb := '[]'::jsonb;
  v_total integer := 0;
  v_ano integer := coalesce(p_ano, extract(year from now())::integer);
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
    ano_ultimo_reajuste=v_ano,
    data_ultimo_reajuste=now(),
    updated_at=now()
  WHERE id=p_grupo_id;

  INSERT INTO public.grupos_creditos_reajustes(
    grupo_id,marco_meses,percentual_referencia,valores_anteriores,valores_novos,
    observacao,usuario_id
  ) VALUES (
    p_grupo_id,p_marco_meses,p_percentual_referencia,v_anteriores,v_novos,
    nullif(trim(p_observacao),''),public.current_usuario_id()
  )
  ON CONFLICT (grupo_id, marco_meses) DO UPDATE SET
    percentual_referencia = EXCLUDED.percentual_referencia,
    valores_anteriores = EXCLUDED.valores_anteriores,
    valores_novos = EXCLUDED.valores_novos,
    observacao = EXCLUDED.observacao,
    usuario_id = EXCLUDED.usuario_id,
    created_at = now();

  RETURN jsonb_build_object(
    'grupo_id', p_grupo_id,
    'creditos_atualizados', v_total,
    'marco_meses', p_marco_meses,
    'ano_ultimo_reajuste', v_ano
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_marcar_grupo_reajustado(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_marcar_grupo_reajustado(uuid,integer) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_platform_reajustar_creditos_grupo(uuid,integer,numeric,jsonb,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_platform_reajustar_creditos_grupo(uuid,integer,numeric,jsonb,text,integer) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
