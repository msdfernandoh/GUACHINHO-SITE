-- Fase 214: exclusao operacional completa, reabertura pesquisavel do repasse
-- e recriacao explicita dos valores da empresa e do participante.
BEGIN;

ALTER TABLE public.erp_repasse_importacao_itens
  ADD COLUMN IF NOT EXISTS venda_excluida_id uuid,
  ADD COLUMN IF NOT EXISTS valor_participante_referencia numeric(14,2);

ALTER TABLE public.erp_repasse_importacao_itens
  DROP CONSTRAINT IF EXISTS erp_repasse_item_valor_participante_referencia_check;
ALTER TABLE public.erp_repasse_importacao_itens
  ADD CONSTRAINT erp_repasse_item_valor_participante_referencia_check
  CHECK (valor_participante_referencia IS NULL OR valor_participante_referencia >= 0);

CREATE OR REPLACE FUNCTION public.erp_repasse_preservar_referencia_exclusao_214()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_venda_id uuid;
  v_valor_participante numeric(14,2);
BEGIN
  IF NEW.status_conciliacao = 'NAO_ENCONTRADO'
     AND NEW.previsao_franquia_id IS NULL
     AND OLD.previsao_franquia_id IS NOT NULL THEN
    SELECT pf.venda_id,
           round(COALESCE(sum(pp.valor_previsto), 0), 2)
      INTO v_venda_id, v_valor_participante
    FROM public.comissao_previsoes_franquia pf
    LEFT JOIN public.comissao_previsoes_participantes pp
      ON pp.empresa_id = pf.empresa_id
     AND pp.previsao_franquia_id = pf.id
    WHERE pf.empresa_id = OLD.empresa_id
      AND pf.id = OLD.previsao_franquia_id
    GROUP BY pf.venda_id;

    NEW.venda_excluida_id := COALESCE(NEW.venda_excluida_id, v_venda_id, OLD.venda_id);
    NEW.valor_participante_referencia := COALESCE(
      NEW.valor_participante_referencia,
      NULLIF(v_valor_participante, 0),
      OLD.valor_comissao
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repasse_preservar_referencia_exclusao_214
  ON public.erp_repasse_importacao_itens;
CREATE TRIGGER trg_repasse_preservar_referencia_exclusao_214
BEFORE UPDATE OF status_conciliacao, previsao_franquia_id
ON public.erp_repasse_importacao_itens
FOR EACH ROW
EXECUTE FUNCTION public.erp_repasse_preservar_referencia_exclusao_214();

-- Recupera a referencia para linhas ja reabertas pela Fase 208.
WITH referencias AS (
  SELECT DISTINCT ON (i.id)
    i.id AS item_id,
    pf.venda_id,
    COALESCE((
      SELECT round(sum(pp.valor_previsto), 2)
      FROM public.comissao_previsoes_participantes pp
      WHERE pp.empresa_id = pf.empresa_id
        AND pp.previsao_franquia_id = pf.id
    ), i.valor_comissao) AS valor_participante
  FROM public.erp_repasse_importacao_itens i
  JOIN public.erp_repasse_item_baixas b
    ON b.empresa_id = i.empresa_id AND b.item_importacao_id = i.id
  JOIN public.comissao_previsoes_franquia pf
    ON pf.id = b.previsao_franquia_id AND pf.empresa_id = b.empresa_id
  WHERE i.status_conciliacao = 'NAO_ENCONTRADO'
    AND i.previsao_franquia_id IS NULL
    AND (i.venda_excluida_id IS NULL OR i.valor_participante_referencia IS NULL)
  ORDER BY i.id, b.criado_em DESC
)
UPDATE public.erp_repasse_importacao_itens i
SET venda_excluida_id = referencias.venda_id,
    valor_participante_referencia = referencias.valor_participante,
    updated_at = now()
FROM referencias
WHERE i.id = referencias.item_id;

CREATE OR REPLACE FUNCTION public.rpc_lancar_item_repasse_corrigido_214(
  p_empresa_id uuid,
  p_item_id uuid,
  p_participante_id uuid,
  p_cliente_nome text,
  p_grupo_id uuid,
  p_numero_grupo text,
  p_numero_cota text,
  p_valor_participante numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_resultado jsonb;
  v_venda_id uuid;
  v_percentual numeric(9,4);
BEGIN
  SELECT * INTO v_item
  FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha do relatório não encontrada'; END IF;
  IF p_valor_participante IS NULL OR p_valor_participante < 0
     OR p_valor_participante > v_item.valor_comissao THEN
    RAISE EXCEPTION 'A comissão do vendedor deve ficar entre zero e o valor recebido no relatório';
  END IF;

  v_resultado := public.rpc_lancar_item_repasse_legado(
    p_empresa_id, p_item_id, p_participante_id, NULL, true,
    p_cliente_nome, p_grupo_id, p_numero_grupo, p_numero_cota
  );
  v_venda_id := (v_resultado->>'venda_id')::uuid;
  v_percentual := CASE WHEN v_item.valor_comissao > 0
    THEN round(p_valor_participante * 100 / v_item.valor_comissao, 4)
    ELSE 0 END;

  UPDATE public.comissao_previsoes_participantes
  SET valor_previsto = round(p_valor_participante, 2),
      percentual_aplicado = v_percentual,
      snapshot_regra = COALESCE(snapshot_regra, '{}'::jsonb) || jsonb_build_object(
        'ajuste_recriacao_214', jsonb_build_object(
          'valor_relatorio_empresa', v_item.valor_comissao,
          'valor_comissao_participante', round(p_valor_participante, 2),
          'usuario_id', public.current_usuario_id(),
          'em', now()
        )
      ),
      updated_at = now()
  WHERE empresa_id = p_empresa_id AND venda_id = v_venda_id;

  UPDATE public.erp_repasse_importacao_itens
  SET valor_participante_referencia = round(p_valor_participante, 2), updated_at = now()
  WHERE id = p_item_id AND empresa_id = p_empresa_id;

  RETURN v_resultado || jsonb_build_object(
    'valor_relatorio_empresa', v_item.valor_comissao,
    'valor_comissao_participante', round(p_valor_participante, 2)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_corrigido_214(uuid,uuid,uuid,text,uuid,text,text,numeric)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_item_repasse_corrigido_214(uuid,uuid,uuid,text,uuid,text,text,numeric)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
