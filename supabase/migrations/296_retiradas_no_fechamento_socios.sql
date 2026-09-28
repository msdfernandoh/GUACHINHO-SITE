-- 296: retirada comprovada, baixa bancária e lacre na mesma transação.
BEGIN;

CREATE TABLE public.financeiro_fechamento_socios_retiradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  fechamento_id uuid NOT NULL REFERENCES public.financeiro_fechamentos_socios_cortes(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  conta_movimento_id uuid NOT NULL UNIQUE REFERENCES public.financeiro_conta_movimentos(id) ON DELETE RESTRICT,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  comprovante_referencia text NOT NULL CHECK (length(trim(comprovante_referencia)) >= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fechamento_id, socio_id)
);
ALTER TABLE public.financeiro_fechamento_socios_retiradas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_fechamento_socios_retiradas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financeiro_fechamento_socios_retiradas TO authenticated;
CREATE POLICY financeiro_fechamento_socios_retiradas_select
  ON public.financeiro_fechamento_socios_retiradas FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE TRIGGER financeiro_fechamento_socios_retiradas_imutavel
  BEFORE UPDATE OR DELETE ON public.financeiro_fechamento_socios_retiradas
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacao_fechamento_socios();

CREATE OR REPLACE FUNCTION public.rpc_registrar_fechamento_socios_corte(
  p_empresa_id uuid, p_periodo_inicio date, p_periodo_fim date,
  p_demonstrativo jsonb, p_observacoes text, p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_id uuid; v_anterior date; v_usuario uuid; v_despesas numeric(15,2);
  v_caixa numeric(15,2); v_conta uuid; v_socio jsonb; v_socio_id uuid;
  v_retirada numeric(15,2); v_total numeric(15,2) := 0;
  v_comprovante text; v_movimento uuid; v_nome text; v_retiradas jsonb := '[]'::jsonb;
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
    OR jsonb_typeof(p_demonstrativo) IS DISTINCT FROM 'object'
    OR jsonb_typeof(p_demonstrativo -> 'socios') IS DISTINCT FROM 'array' THEN
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
  v_conta := (p_demonstrativo ->> 'contaEmpresaId')::uuid;
  SELECT s.saldo_atual INTO v_caixa FROM public.financeiro_contas_saldos s
    JOIN public.financeiro_contas_bancarias b ON b.id = s.id AND b.empresa_id = p_empresa_id
    WHERE s.id = v_conta AND s.empresa_id = p_empresa_id AND s.ativo AND b.nome ILIKE '%empresa%';
  IF v_caixa IS NULL OR v_caixa IS DISTINCT FROM (p_demonstrativo ->> 'caixaAntes')::numeric THEN
    RAISE EXCEPTION 'O saldo da conta da empresa mudou durante a conferência';
  END IF;
  FOR v_socio IN SELECT value FROM jsonb_array_elements(p_demonstrativo -> 'socios') LOOP
    v_socio_id := (v_socio ->> 'id')::uuid;
    SELECT nome INTO v_nome FROM public.empresa_socios
      WHERE id = v_socio_id AND empresa_id = p_empresa_id AND ativo;
    IF v_nome IS NULL THEN RAISE EXCEPTION 'Sócio inválido no demonstrativo'; END IF;
    v_retirada := (v_socio ->> 'retirada')::numeric;
    IF v_retirada < 0 OR v_retirada > greatest(0, (v_socio ->> 'direitoAntesRetirada')::numeric) THEN
      RAISE EXCEPTION 'Retirada maior que o direito do sócio';
    END IF;
    IF v_retirada > 0 THEN
      v_comprovante := trim(coalesce(v_socio ->> 'comprovanteRetirada', ''));
      IF length(v_comprovante) < 8 THEN
        RAISE EXCEPTION 'Informe comprovante da retirada de %', v_nome;
      END IF;
      v_total := v_total + v_retirada;
    END IF;
  END LOOP;
  IF v_total IS DISTINCT FROM (p_demonstrativo ->> 'totalRetirado')::numeric
    OR v_caixa - v_total IS DISTINCT FROM (p_demonstrativo ->> 'caixaDepois')::numeric
    OR v_total > v_caixa OR (p_demonstrativo ->> 'cobertura')::numeric < 0 THEN
    RAISE EXCEPTION 'Caixa ou retiradas divergentes do demonstrativo';
  END IF;
  v_usuario := public.current_usuario_id();
  v_id := gen_random_uuid();
  -- Movimentos são lançados antes do corte, para que o próprio gatilho passe a
  -- impedir reescritas após o INSERT do fechamento. Qualquer erro reverte tudo.
  FOR v_socio IN SELECT value FROM jsonb_array_elements(p_demonstrativo -> 'socios') LOOP
    v_retirada := (v_socio ->> 'retirada')::numeric;
    IF v_retirada > 0 THEN
      v_socio_id := (v_socio ->> 'id')::uuid;
      v_comprovante := trim(v_socio ->> 'comprovanteRetirada');
      INSERT INTO public.financeiro_conta_movimentos
        (empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,
         comprovante_referencia,idempotency_key,criado_por)
      VALUES (p_empresa_id,v_conta,'SAIDA','AJUSTE',v_retirada,p_periodo_fim,
        'Retirada do fechamento societário - ' || v_socio_id::text,
        v_comprovante,'corte:' || v_id::text || ':' || v_socio_id::text,v_usuario)
      RETURNING id INTO v_movimento;
      v_retiradas := v_retiradas || jsonb_build_array(jsonb_build_object(
        'socio_id', v_socio_id, 'movimento_id', v_movimento,
        'valor', v_retirada, 'comprovante', v_comprovante));
    END IF;
  END LOOP;
  INSERT INTO public.financeiro_fechamentos_socios_cortes
    (id,empresa_id,periodo_inicio,periodo_fim,demonstrativo,observacoes,idempotency_key,criado_por)
  VALUES (v_id,p_empresa_id,p_periodo_inicio,p_periodo_fim,p_demonstrativo,p_observacoes,p_idempotency_key,v_usuario);
  FOR v_socio IN SELECT value FROM jsonb_array_elements(v_retiradas) LOOP
    INSERT INTO public.financeiro_fechamento_socios_retiradas
      (empresa_id,fechamento_id,socio_id,conta_movimento_id,valor,comprovante_referencia)
    VALUES (p_empresa_id,v_id,(v_socio ->> 'socio_id')::uuid,
      (v_socio ->> 'movimento_id')::uuid,(v_socio ->> 'valor')::numeric,v_socio ->> 'comprovante');
  END LOOP;
  RETURN v_id;
END;
$$;
COMMIT;
