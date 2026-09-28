-- 295: registro do acerto societário e corte imutável dos fatos financeiros.
-- Nenhum fechamento é criado nesta migration. O corte só nasce pela RPC.
BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_fechamentos_socios_cortes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  demonstrativo jsonb NOT NULL,
  observacoes text NOT NULL,
  idempotency_key text NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (periodo_fim >= periodo_inicio),
  CHECK (jsonb_typeof(demonstrativo) = 'object'),
  CHECK (length(trim(observacoes)) >= 20),
  UNIQUE (empresa_id, idempotency_key),
  UNIQUE (empresa_id, periodo_inicio, periodo_fim)
);
CREATE INDEX IF NOT EXISTS financeiro_fechamentos_socios_cortes_empresa_data_idx
  ON public.financeiro_fechamentos_socios_cortes (empresa_id, periodo_fim DESC);

ALTER TABLE public.financeiro_fechamentos_socios_cortes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_fechamentos_socios_cortes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financeiro_fechamentos_socios_cortes TO authenticated;
CREATE POLICY financeiro_fechamentos_socios_cortes_select
  ON public.financeiro_fechamentos_socios_cortes FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

CREATE TRIGGER financeiro_fechamentos_socios_cortes_imutavel
  BEFORE UPDATE OR DELETE ON public.financeiro_fechamentos_socios_cortes
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacao_fechamento_socios();

CREATE OR REPLACE FUNCTION public.rpc_registrar_fechamento_socios_corte(
  p_empresa_id uuid, p_periodo_inicio date, p_periodo_fim date,
  p_demonstrativo jsonb, p_observacoes text, p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_id uuid; v_anterior date; v_usuario uuid;
  v_despesas numeric(15,2); v_caixa numeric(15,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão para fechar os sócios nesta empresa';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL OR p_periodo_inicio > p_periodo_fim
    OR p_periodo_fim > (now() AT TIME ZONE 'America/Cuiaba')::date THEN
    RAISE EXCEPTION 'Data de corte inválida ou futura';
  END IF;
  IF length(trim(coalesce(p_idempotency_key, ''))) < 8
    OR length(trim(coalesce(p_observacoes, ''))) < 20
    OR jsonb_typeof(p_demonstrativo) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Informe chave, demonstrativo e observações completas';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':CORTE_SOCIOS', 0));
  SELECT id INTO v_id FROM public.financeiro_fechamentos_socios_cortes
    WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN RETURN v_id; END IF;
  SELECT max(periodo_fim) INTO v_anterior FROM public.financeiro_fechamentos_socios_cortes
    WHERE empresa_id = p_empresa_id;
  IF v_anterior IS NOT NULL AND p_periodo_inicio <> v_anterior + 1 THEN
    RAISE EXCEPTION 'O próximo período deve iniciar no dia seguinte ao último corte';
  END IF;
  IF v_anterior IS NULL AND EXISTS (
    SELECT 1 FROM public.financeiro_fechamentos_socios f WHERE f.empresa_id = p_empresa_id
  ) THEN
    RAISE EXCEPTION 'Existe fechamento do modelo antigo; concilie antes de criar o novo corte';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.financeiro_fechamentos_socios_cortes f
    WHERE f.empresa_id = p_empresa_id
      AND daterange(f.periodo_inicio, f.periodo_fim, '[]') && daterange(p_periodo_inicio, p_periodo_fim, '[]')
  ) THEN
    RAISE EXCEPTION 'Período já fechado';
  END IF;
  IF coalesce((p_demonstrativo ->> 'totalRetirado')::numeric, 0) <> 0 THEN
    RAISE EXCEPTION 'Retiradas precisam de movimento bancário comprovado antes do lacre';
  END IF;
  SELECT coalesce(round(sum(c.valor), 2), 0) INTO v_despesas
  FROM public.financeiro_contas_pagar c
  LEFT JOIN public.financeiro_centros_custo cc ON cc.id = c.centro_custo_id AND cc.empresa_id = p_empresa_id
  WHERE c.empresa_id = p_empresa_id AND c.status = 'paga' AND c.excluida_em IS NULL
    AND c.pago_em BETWEEN p_periodo_inicio AND p_periodo_fim
    AND NOT coalesce(c.retirar_reserva_impostos, false)
    AND NOT coalesce(cc.descontado_comissao, false);
  IF v_despesas IS DISTINCT FROM (p_demonstrativo ->> 'despesasPagas')::numeric THEN
    RAISE EXCEPTION 'As despesas mudaram durante a conferência; atualize o painel';
  END IF;
  SELECT saldo_atual INTO v_caixa FROM public.financeiro_contas_saldos
    WHERE id = (p_demonstrativo ->> 'contaEmpresaId')::uuid AND empresa_id = p_empresa_id AND ativo;
  IF v_caixa IS NULL OR v_caixa IS DISTINCT FROM (p_demonstrativo ->> 'caixaAntes')::numeric THEN
    RAISE EXCEPTION 'O saldo da conta da empresa mudou durante a conferência';
  END IF;
  v_usuario := public.current_usuario_id();
  INSERT INTO public.financeiro_fechamentos_socios_cortes
    (empresa_id, periodo_inicio, periodo_fim, demonstrativo, observacoes, idempotency_key, criado_por)
  VALUES (p_empresa_id, p_periodo_inicio, p_periodo_fim, p_demonstrativo,
    p_observacoes, p_idempotency_key, v_usuario)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_registrar_fechamento_socios_corte(uuid,date,date,jsonb,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_fechamento_socios_corte(uuid,date,date,jsonb,text,text)
  TO authenticated;

-- A mesma trava transacional serializa novos fatos e o fechamento.
CREATE OR REPLACE FUNCTION public.bloquear_fato_apos_corte_socios()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_linha jsonb; v_empresa uuid; v_data date; v_corte date; v_coluna text;
BEGIN
  v_coluna := TG_ARGV[0];
  v_linha := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_empresa := (v_linha ->> 'empresa_id')::uuid;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Empresa obrigatória no fato financeiro'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text || ':CORTE_SOCIOS', 0));
  SELECT max(periodo_fim) INTO v_corte FROM public.financeiro_fechamentos_socios_cortes
    WHERE empresa_id = v_empresa;
  IF v_corte IS NULL THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  v_data := CASE WHEN length(v_linha ->> v_coluna) = 7
    THEN ((v_linha ->> v_coluna) || '-01')::date
    ELSE nullif(v_linha ->> v_coluna, '')::date END;
  IF v_data IS NOT NULL AND v_data <= v_corte THEN
    RAISE EXCEPTION 'Período lacrado até %. Registre o ajuste no período seguinte.', v_corte;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    v_linha := to_jsonb(OLD);
    v_data := CASE WHEN length(v_linha ->> v_coluna) = 7
      THEN ((v_linha ->> v_coluna) || '-01')::date
      ELSE nullif(v_linha ->> v_coluna, '')::date END;
    IF v_data IS NOT NULL AND v_data <= v_corte THEN
      RAISE EXCEPTION 'Não é permitido alterar um fato do período lacrado até %', v_corte;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$ DECLARE v_item text; v_tabela text; v_coluna text;
BEGIN
  FOREACH v_item IN ARRAY ARRAY[
    'financeiro_recebimentos:data_recebimento',
    'financeiro_pagamentos:data_pagamento',
    'financeiro_conta_movimentos:data_movimento',
    'financeiro_transferencias_contas:data_transferencia',
    'financeiro_transferencias_socios:data_transferencia',
    'caixa_movimentos:data_movimento',
    'comissao_previsoes_franquia:competencia',
    'comissao_previsoes_participantes:competencia',
    'erp_repasse_importacoes:competencia',
    'erp_repasse_importacao_itens:data_alocacao',
    'socio_conta_corrente_movimentos:data_movimento',
    'financeiro_reservas_socios:competencia'
  ] LOOP
    v_tabela := split_part(v_item, ':', 1);
    v_coluna := split_part(v_item, ':', 2);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON public.%I
      FOR EACH ROW EXECUTE FUNCTION public.bloquear_fato_apos_corte_socios(%L)',
      'trg_' || v_tabela || '_corte_socios', v_tabela, v_coluna);
  END LOOP;
END $$;

-- Contas em aberto antes do corte continuam abertas; podem ser quitadas em
-- período posterior. Contas pagas do período lacrado e baixas retroativas não.
CREATE OR REPLACE FUNCTION public.bloquear_conta_apos_corte_socios()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_empresa uuid; v_corte date;
BEGIN
  v_empresa := CASE WHEN TG_OP = 'DELETE' THEN OLD.empresa_id ELSE NEW.empresa_id END;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text || ':CORTE_SOCIOS', 0));
  SELECT max(periodo_fim) INTO v_corte FROM public.financeiro_fechamentos_socios_cortes
    WHERE empresa_id = v_empresa;
  IF v_corte IS NULL THEN RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END; END IF;
  IF TG_OP IN ('UPDATE','DELETE') THEN
    IF OLD.status = 'paga' AND OLD.pago_em <= v_corte THEN
      RAISE EXCEPTION 'Conta paga pertence ao período lacrado até %', v_corte;
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.vencimento <= v_corte OR NEW.competencia <= to_char(v_corte, 'YYYY-MM') THEN
      RAISE EXCEPTION 'Não é permitido lançar despesa anterior ao corte de %', v_corte;
    END IF;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') THEN
    IF NEW.status = 'paga' AND NEW.pago_em <= v_corte THEN
      RAISE EXCEPTION 'Não é permitido baixar despesa dentro do período lacrado até %', v_corte;
    END IF;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'paga' AND OLD.vencimento <= v_corte
      AND (NEW.valor IS DISTINCT FROM OLD.valor OR NEW.descricao IS DISTINCT FROM OLD.descricao
        OR NEW.vencimento IS DISTINCT FROM OLD.vencimento OR NEW.competencia IS DISTINCT FROM OLD.competencia) THEN
      RAISE EXCEPTION 'O valor e a descrição da conta anterior ao corte estão lacrados';
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER trg_financeiro_contas_pagar_corte_socios
  BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_contas_pagar
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_conta_apos_corte_socios();

-- Itens vinculados não podem alterar os totais de um documento já lacrado.
CREATE OR REPLACE FUNCTION public.bloquear_item_apos_corte_socios()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
DECLARE v_linha jsonb; v_empresa uuid; v_corte date; v_data date; v_parent_id uuid;
BEGIN
  v_linha := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_parent_id := (v_linha ->> TG_ARGV[1])::uuid;
  EXECUTE format('SELECT empresa_id, %I FROM public.%I WHERE id = $1', TG_ARGV[2], TG_ARGV[0])
    INTO v_empresa, v_data USING v_parent_id;
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'Documento financeiro vinculado não encontrado'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text || ':CORTE_SOCIOS', 0));
  SELECT max(periodo_fim) INTO v_corte FROM public.financeiro_fechamentos_socios_cortes
    WHERE empresa_id = v_empresa;
  IF v_corte IS NOT NULL AND v_data <= v_corte THEN
    RAISE EXCEPTION 'Itens do período lacrado até % não podem ser alterados', v_corte;
  END IF;
  IF TG_OP = 'UPDATE' AND (to_jsonb(OLD) ->> TG_ARGV[1]) IS DISTINCT FROM v_parent_id::text THEN
    v_parent_id := (to_jsonb(OLD) ->> TG_ARGV[1])::uuid;
    EXECUTE format('SELECT %I FROM public.%I WHERE id = $1', TG_ARGV[2], TG_ARGV[0])
      INTO v_data USING v_parent_id;
    IF v_corte IS NOT NULL AND v_data <= v_corte THEN
      RAISE EXCEPTION 'Item anterior pertence ao período lacrado até %', v_corte;
    END IF;
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
CREATE TRIGGER trg_financeiro_recebimento_itens_corte_socios
  BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_recebimento_itens
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_item_apos_corte_socios('financeiro_recebimentos','recebimento_id','data_recebimento');
CREATE TRIGGER trg_financeiro_pagamento_itens_corte_socios
  BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_pagamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_item_apos_corte_socios('financeiro_pagamentos','pagamento_id','data_pagamento');
CREATE TRIGGER trg_financeiro_despesa_rateios_corte_socios
  BEFORE INSERT OR UPDATE OR DELETE ON public.financeiro_despesa_rateios
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_item_apos_corte_socios('financeiro_contas_pagar','conta_pagar_id','pago_em');

REVOKE ALL ON FUNCTION public.bloquear_fato_apos_corte_socios() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bloquear_conta_apos_corte_socios() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bloquear_item_apos_corte_socios() FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
