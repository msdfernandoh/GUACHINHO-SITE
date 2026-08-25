-- 114: Registro de Contemplação de Cota com Opção de Antecipação Integral de Comissões
BEGIN;

-- 1. Relaxar ou garantir suporte a tipos de contemplação em cotas_definitivas
ALTER TABLE public.cotas_definitivas DROP CONSTRAINT IF EXISTS cotas_contemplacao_v2_check;
ALTER TABLE public.cotas_definitivas ADD CONSTRAINT cotas_contemplacao_v2_check CHECK (
  (NOT contemplada AND data_contemplacao IS NULL AND valor_credito_contemplacao IS NULL AND tipo_contemplacao IS NULL)
  OR
  (contemplada AND data_contemplacao IS NOT NULL AND valor_credito_contemplacao > 0 AND tipo_contemplacao IN ('SORTEIO','LANCE','LANCE_LIVRE','LANCE_FIXO','LANCE_EMBUTIDO','OUTRO'))
);

-- 2. Relaxar tipo de contemplação em cota_contemplacoes
ALTER TABLE public.cota_contemplacoes DROP CONSTRAINT IF EXISTS cota_contemplacoes_tipo_contemplacao_check;
ALTER TABLE public.cota_contemplacoes ADD CONSTRAINT cota_contemplacoes_tipo_contemplacao_check CHECK (
  tipo_contemplacao IN ('SORTEIO','LANCE','LANCE_LIVRE','LANCE_FIXO','LANCE_EMBUTIDO','OUTRO')
);

-- 3. RPC para Registrar Contemplação e Antecipar / Liberar Comissões Restantes
CREATE OR REPLACE FUNCTION public.rpc_registrar_contemplacao_comissoes(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_tipo_contemplacao text, -- 'SORTEIO', 'LANCE', 'LANCE_LIVRE', 'LANCE_FIXO', 'LANCE_EMBUTIDO', 'OUTRO'
  p_data_contemplacao date,
  p_antecipar_comissoes boolean DEFAULT true,
  p_competencia_antecipada text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cota record;
  v_venda record;
  v_contemplacao_id uuid;
  v_comp text;
  v_count_franquia integer := 0;
  v_count_participantes integer := 0;
  v_total_antecipado_franquia numeric := 0;
  v_total_antecipado_participantes numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Cota não encontrada'; END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = v_cota.venda_id FOR UPDATE;

  v_comp := COALESCE(p_competencia_antecipada, to_char(p_data_contemplacao, 'YYYY-MM'));

  -- 1. Atualiza status da cota e registra em cota_contemplacoes
  UPDATE public.cotas_definitivas
  SET status = 'contemplada',
      contemplada = true,
      data_contemplacao = p_data_contemplacao,
      valor_credito_contemplacao = v_cota.valor_credito,
      tipo_contemplacao = p_tipo_contemplacao,
      observacao_contemplacao = p_observacao,
      contemplacao_atualizada_por_usuario_id = public.current_usuario_id(),
      contemplacao_atualizada_em = now(),
      updated_at = now()
  WHERE id = p_cota_id;

  INSERT INTO public.cota_contemplacoes (
    empresa_id, cota_definitiva_id, venda_id, data_contemplacao, tipo_contemplacao, valor_credito_contemplacao, observacao, registrado_por_usuario_id
  ) VALUES (
    p_empresa_id, p_cota_id, v_venda.id, p_data_contemplacao, p_tipo_contemplacao, v_cota.valor_credito, p_observacao, public.current_usuario_id()
  )
  ON CONFLICT (cota_definitiva_id) DO UPDATE
  SET data_contemplacao = EXCLUDED.data_contemplacao,
      tipo_contemplacao = EXCLUDED.tipo_contemplacao,
      valor_credito_contemplacao = EXCLUDED.valor_credito_contemplacao,
      observacao = EXCLUDED.observacao,
      registrado_por_usuario_id = EXCLUDED.registrado_por_usuario_id
  RETURNING id INTO v_contemplacao_id;

  -- 2. Se antecipar todas as comissões restantes para o próximo pagamento:
  IF p_antecipar_comissoes THEN
    -- Soma e antecipa previsões da franquia em aberto
    SELECT count(*), COALESCE(SUM(valor_previsto), 0) INTO v_count_franquia, v_total_antecipado_franquia
    FROM public.comissao_previsoes_franquia
    WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel');

    UPDATE public.comissao_previsoes_franquia
    SET competencia = v_comp,
        status = 'elegivel',
        tipo_gatilho = 'CONTEMPLACAO',
        evento_origem_id = v_contemplacao_id
    WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel');

    -- Soma e antecipa previsões dos participantes em aberto
    SELECT count(*), COALESCE(SUM(valor_previsto), 0) INTO v_count_participantes, v_total_antecipado_participantes
    FROM public.comissao_previsoes_participantes
    WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel', 'parcialmente_elegivel');

    UPDATE public.comissao_previsoes_participantes
    SET competencia = v_comp,
        status = 'elegivel',
        tipo_gatilho = 'CONTEMPLACAO',
        valor_elegivel = valor_previsto
    WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel', 'parcialmente_elegivel');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'cota_id', p_cota_id,
    'contemplacao_id', v_contemplacao_id,
    'competencia_liberada', v_comp,
    'antecipar_comissoes', p_antecipar_comissoes,
    'parcelas_franquia_antecipadas', v_count_franquia,
    'valor_franquia_antecipado', v_total_antecipado_franquia,
    'parcelas_participantes_antecipadas', v_count_participantes,
    'valor_participantes_antecipado', v_total_antecipado_participantes
  );
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
