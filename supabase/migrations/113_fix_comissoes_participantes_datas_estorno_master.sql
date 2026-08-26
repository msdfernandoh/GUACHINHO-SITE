-- 113: Motor de Comissões com Datas Personalizadas, Geração de Previsões para Participantes, Curva de Estorno e Gestão Master de Vendas
BEGIN;

-- 1. Colunas para controle de competências e datas personalizadas em vendas e cotas
ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS data_primeira_parcela date,
  ADD COLUMN IF NOT EXISTS data_segunda_parcela date,
  ADD COLUMN IF NOT EXISTS participante_secundario_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS participante_secundario_fracao_percentual numeric(7,4),
  ADD COLUMN IF NOT EXISTS perfil_principal_id uuid REFERENCES public.comissao_perfis(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS perfil_secundario_id uuid REFERENCES public.comissao_perfis(id) ON DELETE SET NULL;

ALTER TABLE public.cotas_definitivas
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 2. Atualizar rpc_gerar_previsoes_comissao_v2 com suporte a datas personalizadas e geração completa de participantes
CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao_v2(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_venda record;
  v_cota record;
  v_grupo record;
  v_regra record;
  v_etapa record;
  v_imposto numeric := 0;
  v_bruto numeric;
  v_tax numeric;
  v_liquido numeric;
  v_comp text;
  v_result jsonb;
  v_prev_id uuid;
  v_percentual numeric := 4.0;
  v_etapas_count integer := 0;
  v_data_base_1 date;
  v_data_base_2 date;
  v_mes_data date;
  v_ordem_idx integer;

  -- Variáveis de Participantes
  v_principal_id uuid;
  v_secundario_id uuid;
  v_fracao_secundario numeric;
  v_perfil_principal_id uuid;
  v_perfil_secundario_id uuid;
  v_percentual_principal numeric := 50.0;
  v_valor_principal_bruto numeric;
  v_valor_secundario numeric := 0;
  v_valor_principal_liquido numeric;
  v_modo_cronograma_sec text := 'SEGUIR_PRINCIPAL';
  v_total_secundario_acumulado numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':GERACAO_PREVISOES_V2:' || p_idempotency_key, 0));

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_venda_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_venda.id IS NULL THEN
    RAISE EXCEPTION 'Venda não encontrada no tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id = p_venda_id;
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = v_venda.grupo_id;

  -- Se já existem previsões geradas, verifica se tem participantes
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id) THEN
    IF NOT EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id) THEN
      -- Se tinha franquia mas não tinha participantes, limpa para regerar completo
      DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id;
    ELSE
      SELECT jsonb_build_object(
        'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
        'participantes', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY competencia, ordem_etapa), '[]'::jsonb) FROM public.comissao_previsoes_participantes p WHERE p.venda_id = p_venda_id),
        'reused', true
      ) INTO v_result
      FROM public.comissao_previsoes_franquia f
      WHERE venda_id = p_venda_id;
      RETURN v_result;
    END IF;
  END IF;

  -- Resolução de datas de comissão
  v_data_base_1 := COALESCE(v_venda.data_primeira_parcela, v_venda.data_venda::date, CURRENT_DATE);
  v_data_base_2 := COALESCE(v_venda.data_segunda_parcela, (v_data_base_1 + INTERVAL '1 month')::date);

  -- Identificação de participantes e perfis
  v_principal_id := COALESCE(v_venda.participante_comercial_id, (v_venda.snapshot_venda->>'participante_comercial_id')::uuid);
  v_secundario_id := COALESCE(v_venda.participante_secundario_id, (v_venda.snapshot_venda->>'participante_secundario_id')::uuid);
  v_fracao_secundario := COALESCE(v_venda.participante_secundario_fracao_percentual, (v_venda.snapshot_venda->>'fracao_secundario')::numeric, (v_venda.snapshot_venda->>'participante_secundario_fracao_percentual')::numeric, 0);
  v_perfil_principal_id := COALESCE(v_venda.perfil_principal_id, (v_venda.snapshot_venda->>'perfil_principal_id')::uuid);
  v_perfil_secundario_id := COALESCE(v_venda.perfil_secundario_id, (v_venda.snapshot_venda->>'perfil_secundario_id')::uuid);
  v_modo_cronograma_sec := COALESCE((v_venda.snapshot_venda->>'cronograma_secundario'), 'SEGUIR_PRINCIPAL');

  -- Se principal tem perfil vinculado em participante_comissao_perfis
  IF v_principal_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT override_percentual FROM public.participante_comissao_perfis WHERE empresa_id = p_empresa_id AND participante_id = v_principal_id AND (perfil_id = v_perfil_principal_id OR v_perfil_principal_id IS NULL) AND ativo AND override_percentual IS NOT NULL LIMIT 1),
      (SELECT r.percentual_comissao FROM public.participante_comissao_perfis p JOIN public.comissao_regras_participantes r ON r.perfil_id = p.perfil_id WHERE p.empresa_id = p_empresa_id AND p.participante_id = v_principal_id AND (p.perfil_id = v_perfil_principal_id OR v_perfil_principal_id IS NULL) AND p.ativo AND r.ativa LIMIT 1),
      (SELECT CASE WHEN papel_tipo = 'GESTOR' OR papel_tipo = 'SOCIO' THEN 100.0 ELSE 50.0 END FROM public.participante_comissao_perfis WHERE empresa_id = p_empresa_id AND participante_id = v_principal_id AND ativo LIMIT 1),
      50.0
    ) INTO v_percentual_principal;
  END IF;

  -- 1. Busca Regra da Franqueadora
  SELECT r.*, p.nome as programa_nome INTO v_regra
  FROM public.comissao_regras_franquia r
  JOIN public.comissao_programas p ON p.id = r.programa_id
  WHERE r.empresa_id = p_empresa_id
    AND p.administradora_id = v_venda.administradora_id
    AND p.ativo
    AND r.ativa
    AND r.configuracao_homologada
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
    AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id = v_grupo.modalidade_comissao_id OR r.modalidade_comissao_id = v_venda.modalidade_comissao_id)
    AND r.vigencia_inicio <= v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY (r.tipo_administradora_id IS NOT NULL) DESC, (r.modalidade_comissao_id IS NOT NULL) DESC, r.versao DESC
  LIMIT 1;

  IF v_regra.id IS NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE r.empresa_id = p_empresa_id AND p.administradora_id = v_venda.administradora_id AND p.ativo AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC LIMIT 1;
  END IF;

  IF v_regra.id IS NULL THEN
    SELECT r.*, p.nome as programa_nome INTO v_regra
    FROM public.comissao_regras_franquia r
    JOIN public.comissao_programas p ON p.id = r.programa_id
    WHERE p.administradora_id = v_venda.administradora_id AND r.ativa
    ORDER BY r.configuracao_homologada DESC, r.versao DESC LIMIT 1;
  END IF;

  -- Alíquota fiscal
  SELECT f.percentual_imposto INTO v_imposto
  FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id = p_empresa_id AND f.ativo AND f.vigencia_inicio <= v_venda.data_venda::date
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim >= v_venda.data_venda::date)
  ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto := COALESCE(v_imposto, 0);

  IF v_regra.id IS NOT NULL THEN
    v_percentual := COALESCE(v_regra.percentual_total_comissao, 4.0);
    SELECT count(*) INTO v_etapas_count FROM public.comissao_regra_etapas WHERE regra_franquia_id = v_regra.id;

    IF v_etapas_count > 0 THEN
      v_ordem_idx := 0;
      FOR v_etapa IN SELECT * FROM public.comissao_regra_etapas WHERE regra_franquia_id = v_regra.id AND tipo_gatilho = 'MES_RELATIVO' ORDER BY ordem LOOP
        v_ordem_idx := v_ordem_idx + 1;
        v_bruto := round(v_venda.valor_credito * v_etapa.percentual_venda / 100, 2);
        v_tax := round(v_bruto * v_imposto / 100, 2);
        v_liquido := v_bruto - v_tax;

        -- Competência personalizada
        IF v_ordem_idx = 1 THEN
          v_comp := to_char(v_data_base_1, 'YYYY-MM');
        ELSE
          v_comp := to_char(date_trunc('month', v_data_base_2) + make_interval(months => v_ordem_idx - 2), 'YYYY-MM');
        END IF;

        INSERT INTO public.comissao_previsoes_franquia(
          empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
          base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id, v_etapa.ordem, v_etapa.nome, v_comp,
          v_venda.valor_credito, v_etapa.percentual_venda, v_bruto, 'prevista',
          jsonb_build_object('regra_id', v_regra.id, 'programa_id', v_regra.programa_id, 'versao', v_regra.versao),
          'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
        ) RETURNING id INTO v_prev_id;

        -- Geração de Previsões para os Participantes (Principal e SDR)
        IF v_principal_id IS NOT NULL THEN
          v_valor_principal_bruto := round(v_liquido * v_percentual_principal / 100, 2);

          IF v_secundario_id IS NOT NULL AND v_fracao_secundario > 0 AND v_modo_cronograma_sec = 'SEGUIR_PRINCIPAL' THEN
            v_valor_secundario := round(v_valor_principal_bruto * v_fracao_secundario / 100, 2);
            v_valor_principal_liquido := v_valor_principal_bruto - v_valor_secundario;

            -- Linha do SDR Secundário
            INSERT INTO public.comissao_previsoes_participantes(
              empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, ordem_etapa, nome_etapa, competencia,
              base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho
            ) VALUES (
              p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, v_etapa.ordem, v_etapa.nome || ' (SDR)', v_comp,
              v_valor_principal_bruto, v_fracao_secundario, v_valor_secundario, 'prevista',
              jsonb_build_object('papel', 'SECUNDARIO', 'fracao', v_fracao_secundario, 'previsao_franquia_id', v_prev_id),
              'MES_RELATIVO'
            );
          ELSE
            v_valor_principal_liquido := v_valor_principal_bruto;
          END IF;

          -- Linha do Consultor Principal
          INSERT INTO public.comissao_previsoes_participantes(
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, ordem_etapa, nome_etapa, competencia,
            base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_principal_id, v_etapa.ordem, v_etapa.nome, v_comp,
            v_liquido, v_percentual_principal, v_valor_principal_liquido, 'prevista',
            jsonb_build_object('papel', 'PRINCIPAL', 'percentual', v_percentual_principal, 'previsao_franquia_id', v_prev_id),
            'MES_RELATIVO'
          );
        END IF;
      END LOOP;
    ELSE
      -- Regra em parcela única
      v_bruto := round(v_venda.valor_credito * v_percentual / 100, 2);
      v_tax := round(v_bruto * v_imposto / 100, 2);
      v_liquido := v_bruto - v_tax;
      v_comp := to_char(v_data_base_1, 'YYYY-MM');

      INSERT INTO public.comissao_previsoes_franquia(
        empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
        base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, v_regra.id, 1, '1ª Parcela', v_comp,
        v_venda.valor_credito, v_percentual, v_bruto, 'prevista',
        jsonb_build_object('regra_id', v_regra.id, 'programa_id', v_regra.programa_id, 'versao', v_regra.versao),
        'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
      ) RETURNING id INTO v_prev_id;

      IF v_principal_id IS NOT NULL THEN
        v_valor_principal_bruto := round(v_liquido * v_percentual_principal / 100, 2);
        IF v_secundario_id IS NOT NULL AND v_fracao_secundario > 0 THEN
          v_valor_secundario := round(v_valor_principal_bruto * v_fracao_secundario / 100, 2);
          v_valor_principal_liquido := v_valor_principal_bruto - v_valor_secundario;

          INSERT INTO public.comissao_previsoes_participantes(
            empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, ordem_etapa, nome_etapa, competencia,
            base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho
          ) VALUES (
            p_empresa_id, p_venda_id, v_cota.id, v_secundario_id, 1, '1ª Parcela (SDR)', v_comp,
            v_valor_principal_bruto, v_fracao_secundario, v_valor_secundario, 'prevista',
            jsonb_build_object('papel', 'SECUNDARIO', 'fracao', v_fracao_secundario), 'MES_RELATIVO'
          );
        ELSE
          v_valor_principal_liquido := v_valor_principal_bruto;
        END IF;

        INSERT INTO public.comissao_previsoes_participantes(
          empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, ordem_etapa, nome_etapa, competencia,
          base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho
        ) VALUES (
          p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 1, '1ª Parcela', v_comp,
          v_liquido, v_percentual_principal, v_valor_principal_liquido, 'prevista',
          jsonb_build_object('papel', 'PRINCIPAL', 'percentual', v_percentual_principal), 'MES_RELATIVO'
        );
      END IF;
    END IF;
  ELSE
    -- Fallback padrão de 4%
    v_percentual := 4.0;
    v_bruto := round(v_venda.valor_credito * v_percentual / 100, 2);
    v_tax := round(v_bruto * v_imposto / 100, 2);
    v_liquido := v_bruto - v_tax;
    v_comp := to_char(v_data_base_1, 'YYYY-MM');

    INSERT INTO public.comissao_previsoes_franquia(
      empresa_id, venda_id, cota_definitiva_id, administradora_id, regra_franquia_id, ordem_etapa, nome_etapa, competencia,
      base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho, valor_bruto, percentual_imposto, valor_imposto, valor_liquido
    ) VALUES (
      p_empresa_id, p_venda_id, v_cota.id, v_venda.administradora_id, NULL, 1, '1ª Parcela (Padrão)', v_comp,
      v_venda.valor_credito, v_percentual, v_bruto, 'prevista',
      jsonb_build_object('modo', 'PADRAO_FALLBACK', 'percentual', v_percentual),
      'MES_RELATIVO', v_bruto, v_imposto, v_tax, v_liquido
    );

    IF v_principal_id IS NOT NULL THEN
      v_valor_principal_bruto := round(v_liquido * v_percentual_principal / 100, 2);
      INSERT INTO public.comissao_previsoes_participantes(
        empresa_id, venda_id, cota_definitiva_id, participante_comercial_id, ordem_etapa, nome_etapa, competencia,
        base_calculo_valor, percentual_aplicado, valor_previsto, status, snapshot_regra, tipo_gatilho
      ) VALUES (
        p_empresa_id, p_venda_id, v_cota.id, v_principal_id, 1, '1ª Parcela (Padrão)', v_comp,
        v_liquido, v_percentual_principal, v_valor_principal_bruto, 'prevista',
        jsonb_build_object('papel', 'PRINCIPAL', 'percentual', v_percentual_principal), 'MES_RELATIVO'
      );
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'franquia', COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa), '[]'::jsonb),
    'participantes', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY competencia, ordem_etapa), '[]'::jsonb) FROM public.comissao_previsoes_participantes p WHERE p.venda_id = p_venda_id),
    'reused', false
  ) INTO v_result
  FROM public.comissao_previsoes_franquia f
  WHERE venda_id = p_venda_id;

  RETURN v_result;
END;
$$;

-- 3. RPC para Cancelar Cota com Aplicação da Curva de Estorno
CREATE OR REPLACE FUNCTION public.rpc_cancelar_cota_com_estorno(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_motivo text,
  p_data_cancelamento date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_cota record;
  v_venda record;
  v_meses_decorridos integer;
  v_percentual_estorno numeric := 100.0;
  v_curva_id uuid;
  v_valor_total_pago numeric := 0;
  v_valor_a_estornar numeric := 0;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Cota não encontrada'; END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = v_cota.venda_id FOR UPDATE;

  -- Calcula meses decorridos entre a venda e o cancelamento
  v_meses_decorridos := GREATEST(1, (EXTRACT(YEAR FROM p_data_cancelamento) - EXTRACT(YEAR FROM v_venda.data_venda::date)) * 12 + (EXTRACT(MONTH FROM p_data_cancelamento) - EXTRACT(MONTH FROM v_venda.data_venda::date)) + 1);

  -- Busca percentual de estorno na curva da administradora
  SELECT r.curva_estorno_id INTO v_curva_id
  FROM public.comissao_regras_participantes r
  WHERE r.empresa_id = p_empresa_id AND r.ativa AND r.aplicar_curva_estorno AND r.curva_estorno_id IS NOT NULL
  LIMIT 1;

  IF v_curva_id IS NOT NULL THEN
    SELECT f.percentual_estorno INTO v_percentual_estorno
    FROM public.administradora_curva_estorno_faixas f
    WHERE f.curva_id = v_curva_id AND f.mes_relativo <= v_meses_decorridos
    ORDER BY f.mes_relativo DESC LIMIT 1;
  END IF;

  v_percentual_estorno := COALESCE(v_percentual_estorno, 100.0);

  -- Soma o que já foi pago
  SELECT COALESCE(SUM(valor_pago), 0) INTO v_valor_total_pago
  FROM public.comissao_previsoes_participantes
  WHERE venda_id = v_venda.id AND status = 'paga';

  v_valor_a_estornar := round(v_valor_total_pago * v_percentual_estorno / 100, 2);

  -- Cancela as previsões futuras em aberto
  UPDATE public.comissao_previsoes_franquia
  SET status = 'cancelada'
  WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel');

  UPDATE public.comissao_previsoes_participantes
  SET status = 'cancelada'
  WHERE venda_id = v_venda.id AND status IN ('prevista', 'elegivel', 'parcialmente_elegivel');

  -- Atualiza status da cota e da venda
  UPDATE public.cotas_definitivas
  SET status = 'cancelada',
      motivo_cancelamento = p_motivo,
      cancelada_em = now(),
      cancelada_por_usuario_id = public.current_usuario_id(),
      updated_at = now()
  WHERE id = p_cota_id;

  UPDATE public.vendas
  SET status = 'cancelada', updated_at = now()
  WHERE id = v_venda.id;

  RETURN jsonb_build_object(
    'ok', true,
    'cota_id', p_cota_id,
    'meses_decorridos', v_meses_decorridos,
    'percentual_estorno', v_percentual_estorno,
    'valor_total_pago', v_valor_total_pago,
    'valor_estornado', v_valor_a_estornar
  );
END;
$$;

-- 4. RPC Master para Exclusão ou Estorno Total de Venda
CREATE OR REPLACE FUNCTION public.rpc_master_excluir_ou_estornar_venda(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_acao text, -- 'EXCLUIR' ou 'ESTORNAR'
  p_cancelar_comissoes_pagas boolean DEFAULT false,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_venda record;
  v_contratacao_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado: operação restrita ao tenant master';
  END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_venda_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_venda.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

  v_contratacao_id := v_venda.contratacao_id;

  IF p_acao = 'ESTORNAR' THEN
    -- Marca venda e cota como estornadas/canceladas
    UPDATE public.vendas SET status = 'cancelada', updated_at = now() WHERE id = p_venda_id;
    UPDATE public.cotas_definitivas SET status = 'cancelada', motivo_cancelamento = p_motivo, updated_at = now() WHERE venda_id = p_venda_id;

    IF p_cancelar_comissoes_pagas THEN
      UPDATE public.comissao_previsoes_franquia SET status = 'cancelada' WHERE venda_id = p_venda_id;
      UPDATE public.comissao_previsoes_participantes SET status = 'cancelada' WHERE venda_id = p_venda_id;
    ELSE
      UPDATE public.comissao_previsoes_franquia SET status = 'cancelada' WHERE venda_id = p_venda_id AND status != 'liquidada';
      UPDATE public.comissao_previsoes_participantes SET status = 'cancelada' WHERE venda_id = p_venda_id AND status != 'paga';
    END IF;

    RETURN jsonb_build_object('ok', true, 'acao', 'ESTORNAR', 'venda_id', p_venda_id);

  ELSIF p_acao = 'EXCLUIR' THEN
    -- Deleta previsões
    DELETE FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id;
    DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id;
    DELETE FROM public.venda_participantes WHERE venda_id = p_venda_id;
    DELETE FROM public.cota_contemplacoes WHERE venda_id = p_venda_id;
    DELETE FROM public.cotas_definitivas WHERE venda_id = p_venda_id;
    DELETE FROM public.vendas WHERE id = p_venda_id;

    -- Se tinha contratação online vinculada, restaura status para permitir nova formalização
    IF v_contratacao_id IS NOT NULL THEN
      UPDATE public.contratacoes_online
      SET status_operacional_erp = 'PRONTO_FORMALIZAR',
          finalizado_em = NULL
      WHERE id = v_contratacao_id AND empresa_id = p_empresa_id;
    END IF;

    RETURN jsonb_build_object('ok', true, 'acao', 'EXCLUIR', 'venda_id', p_venda_id);
  ELSE
    RAISE EXCEPTION 'Ação inválida. Escolha EXCLUIR ou ESTORNAR';
  END IF;
END;
$$;

-- 5. RPC para Atualizar Dados da Venda e Cota Oficial (Master)
CREATE OR REPLACE FUNCTION public.rpc_master_atualizar_dados_venda(
  p_empresa_id uuid,
  p_venda_id uuid,
  p_numero_cota text,
  p_participante_principal_id uuid,
  p_participante_secundario_id uuid,
  p_fracao_secundario numeric,
  p_data_primeira_parcela date,
  p_data_segunda_parcela date,
  p_recalcular_comissoes_futuras boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado: operação restrita ao tenant master';
  END IF;

  UPDATE public.vendas
  SET participante_comercial_id = p_participante_principal_id,
      participante_secundario_id = p_participante_secundario_id,
      participante_secundario_fracao_percentual = p_fracao_secundario,
      data_primeira_parcela = p_data_primeira_parcela,
      data_segunda_parcela = p_data_segunda_parcela,
      updated_at = now()
  WHERE id = p_venda_id AND empresa_id = p_empresa_id;

  UPDATE public.cotas_definitivas
  SET numero_cota = NULLIF(trim(p_numero_cota), ''),
      participante_comercial_id = p_participante_principal_id,
      updated_at = now()
  WHERE venda_id = p_venda_id AND empresa_id = p_empresa_id;

  IF p_recalcular_comissoes_futuras THEN
    -- Limpa previsões não pagas e regera
    DELETE FROM public.comissao_previsoes_participantes WHERE venda_id = p_venda_id AND status IN ('prevista', 'elegivel');
    DELETE FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id AND status = 'prevista';
    PERFORM public.rpc_gerar_previsoes_comissao_v2(p_empresa_id, p_venda_id, 'recalculo:' || p_venda_id || ':' || extract(epoch from now())::text);
  END IF;

  RETURN jsonb_build_object('ok', true, 'venda_id', p_venda_id);
END;
$$;

-- 6. Executar sincronização inicial para todas as vendas existentes da empresa sem comissão de participante
DO $$
DECLARE
  v_v record;
BEGIN
  FOR v_v IN SELECT id, empresa_id FROM public.vendas LOOP
    BEGIN
      PERFORM public.rpc_gerar_previsoes_comissao_v2(v_v.empresa_id, v_v.id, 'sync_v113:' || v_v.id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
