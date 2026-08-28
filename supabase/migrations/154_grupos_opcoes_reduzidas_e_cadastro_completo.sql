-- 154 — Cadastro completo de grupos: múltiplas opções fixas de parcela reduzida.
-- Seguro, fundo de reserva, observações e tabela comercial reutilizam estruturas existentes.
BEGIN;

ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS percentuais_parcela_reduzida numeric(8,4)[];

ALTER TABLE public.grupos_consorcio
  DROP CONSTRAINT IF EXISTS grupos_consorcio_percentuais_reduzida_check;
ALTER TABLE public.grupos_consorcio
  ADD CONSTRAINT grupos_consorcio_percentuais_reduzida_check
  CHECK (
    percentuais_parcela_reduzida IS NULL
    OR (
      cardinality(percentuais_parcela_reduzida) > 0
      AND 0 < ALL (percentuais_parcela_reduzida)
      AND 100 > ALL (percentuais_parcela_reduzida)
    )
  );

COMMENT ON COLUMN public.grupos_consorcio.percentuais_parcela_reduzida IS
  'Opções comerciais fixas da parcela reduzida. A primeira é o padrão; a faixa de comissão permanece independente.';

CREATE OR REPLACE FUNCTION public.rpc_salvar_percentuais_parcela_reduzida_grupo(
  p_grupo_id uuid,
  p_percentuais numeric[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_empresa_id uuid;
  v_origem text;
  v_empresa_origem_id uuid;
  v_percentuais numeric[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  SELECT g.origem_governanca, g.empresa_origem_id
    INTO v_origem, v_empresa_origem_id
  FROM public.grupos_consorcio g
  WHERE g.id = p_grupo_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Grupo não encontrado'; END IF;

  IF NOT public.is_platform_superadmin() THEN
    SELECT eu.empresa_id INTO v_empresa_id
    FROM public.empresa_usuarios eu
    JOIN public.usuarios u ON u.id = eu.usuario_id
    WHERE u.auth_user_id = auth.uid()
      AND eu.empresa_id = v_empresa_origem_id
      AND eu.status = 'ATIVO'
      AND public.can_write_tenant_internal(eu.empresa_id)
    LIMIT 1;

    -- Catálogo global é alterado somente pela Platform. No ERP, a solicitação
    -- permanece válida, mas a coleção global não é antecipada.
    IF v_origem IS DISTINCT FROM 'LOCAL' OR v_empresa_id IS NULL THEN
      RETURN jsonb_build_object('grupo_id', p_grupo_id, 'aplicado', false, 'motivo', 'AGUARDANDO_PLATFORM');
    END IF;
  END IF;

  IF p_percentuais IS NOT NULL THEN
    SELECT array_agg(valor ORDER BY ordem)
      INTO v_percentuais
    FROM (
      SELECT valor, min(ordem) AS ordem
      FROM unnest(p_percentuais) WITH ORDINALITY AS itens(valor, ordem)
      GROUP BY valor
    ) normalizados;
    IF EXISTS (SELECT 1 FROM unnest(v_percentuais) valor WHERE valor <= 0 OR valor >= 100) THEN
      RAISE EXCEPTION 'Cada parcela reduzida deve estar entre 0 e 100';
    END IF;
  END IF;

  UPDATE public.grupos_consorcio
  SET percentuais_parcela_reduzida = v_percentuais,
      percentual_parcela_reduzida = v_percentuais[1],
      tem_parcela_reduzida = cardinality(coalesce(v_percentuais, ARRAY[]::numeric[])) > 0,
      updated_at = now()
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object(
    'grupo_id', p_grupo_id,
    'aplicado', true,
    'percentuais', coalesce(to_jsonb(v_percentuais), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_salvar_percentuais_parcela_reduzida_grupo(uuid,numeric[])
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_percentuais_parcela_reduzida_grupo(uuid,numeric[])
  TO authenticated;

COMMIT;
