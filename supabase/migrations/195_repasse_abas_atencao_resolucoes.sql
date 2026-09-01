-- 195 — Central de atenção do repasse sem bloquear o recebimento do relatório.
-- As decisões são append-only e preservam previsão, recebimento e livro financeiro.

BEGIN;

CREATE TABLE IF NOT EXISTS public.erp_repasse_atencao_resolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  importacao_id uuid REFERENCES public.erp_repasse_importacoes(id) ON DELETE RESTRICT,
  item_importacao_id uuid REFERENCES public.erp_repasse_importacao_itens(id) ON DELETE RESTRICT,
  previsao_franquia_id uuid NOT NULL REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('SISTEMA_SEM_RELATORIO','VALOR_DIVERGENTE')),
  decisao text NOT NULL CHECK (decisao IN ('AGUARDAR_PROXIMO','GERAR_CREDITO','AJUSTAR_DIFERENCA','CANCELAR_COTA')),
  valor_sistema numeric(15,2) NOT NULL CHECK (valor_sistema >= 0),
  valor_relatorio numeric(15,2) CHECK (valor_relatorio IS NULL OR valor_relatorio >= 0),
  valor_diferenca numeric(15,2) NOT NULL,
  motivo text,
  idempotency_key text NOT NULL,
  resolvido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS erp_repasse_atencao_resolucoes_empresa_idx
  ON public.erp_repasse_atencao_resolucoes(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS erp_repasse_atencao_resolucoes_previsao_idx
  ON public.erp_repasse_atencao_resolucoes(empresa_id, previsao_franquia_id, created_at DESC);

ALTER TABLE public.erp_repasse_atencao_resolucoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS erp_repasse_atencao_resolucoes_read ON public.erp_repasse_atencao_resolucoes;
CREATE POLICY erp_repasse_atencao_resolucoes_read
  ON public.erp_repasse_atencao_resolucoes FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));

REVOKE ALL ON TABLE public.erp_repasse_atencao_resolucoes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.erp_repasse_atencao_resolucoes TO authenticated;
GRANT ALL ON TABLE public.erp_repasse_atencao_resolucoes TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_resolver_atencao_repasse(
  p_empresa_id uuid,
  p_previsao_franquia_id uuid,
  p_decisao text,
  p_importacao_id uuid DEFAULT NULL,
  p_item_importacao_id uuid DEFAULT NULL,
  p_valor_ajuste numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_previsao public.comissao_previsoes_franquia%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_existente public.erp_repasse_atencao_resolucoes%ROWTYPE;
  v_recebido_item numeric := 0;
  v_valor_sistema numeric := 0;
  v_valor_relatorio numeric := NULL;
  v_diferenca numeric := 0;
  v_ajuste numeric := 0;
  v_tipo text;
  v_idempotency text;
  v_cancelamento jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para resolver atenções de repasse nesta empresa';
  END IF;
  IF p_decisao NOT IN ('AGUARDAR_PROXIMO','GERAR_CREDITO','AJUSTAR_DIFERENCA','CANCELAR_COTA') THEN
    RAISE EXCEPTION 'Decisão de repasse inválida';
  END IF;
  IF length(trim(coalesce(p_motivo,''))) > 500 THEN RAISE EXCEPTION 'Motivo deve ter no máximo 500 caracteres'; END IF;

  v_idempotency := coalesce(nullif(trim(p_idempotency_key),''),
    p_decisao||':'||p_previsao_franquia_id::text||':'||coalesce(p_item_importacao_id::text,'sem-item'));
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':REPASSE_ATENCAO:'||v_idempotency,0));
  SELECT * INTO v_existente FROM public.erp_repasse_atencao_resolucoes
  WHERE empresa_id=p_empresa_id AND idempotency_key=v_idempotency;
  IF v_existente.id IS NOT NULL THEN
    RETURN jsonb_build_object('ok',true,'idempotente',true,'resolucao_id',v_existente.id,'decisao',v_existente.decisao);
  END IF;

  SELECT * INTO v_previsao FROM public.comissao_previsoes_franquia
  WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_previsao.id IS NULL THEN RAISE EXCEPTION 'Comissão do sistema não encontrada no tenant'; END IF;

  IF p_importacao_id IS NOT NULL THEN
    SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
    WHERE id=p_importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
    IF v_importacao.id IS NULL OR v_importacao.administradora_id<>v_previsao.administradora_id THEN
      RAISE EXCEPTION 'Relatório incompatível com a comissão selecionada';
    END IF;
  END IF;

  IF p_item_importacao_id IS NOT NULL THEN
    SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
    WHERE id=p_item_importacao_id AND empresa_id=p_empresa_id
      AND (p_importacao_id IS NULL OR importacao_id=p_importacao_id)
    FOR UPDATE;
    IF v_item.id IS NULL THEN RAISE EXCEPTION 'Linha do relatório não encontrada no tenant'; END IF;
    IF v_item.previsao_franquia_id IS NOT NULL AND v_item.previsao_franquia_id<>v_previsao.id THEN
      RAISE EXCEPTION 'A linha já está vinculada a outra comissão';
    END IF;
    IF v_item.previsao_franquia_id IS NULL
       AND v_item.previsao_sugerida_id IS NOT NULL
       AND v_item.previsao_sugerida_id<>v_previsao.id THEN
      RAISE EXCEPTION 'A comissão escolhida difere da sugestão conferida';
    END IF;
    v_valor_relatorio := v_item.valor_comissao;
    IF v_importacao.recebimento_id IS NOT NULL THEN
      SELECT coalesce(sum(ri.valor_liquidado),0) INTO v_recebido_item
      FROM public.financeiro_recebimento_itens ri
      WHERE ri.recebimento_id=v_importacao.recebimento_id
        AND ri.previsao_franquia_id=v_previsao.id;
    END IF;
    v_valor_sistema := greatest(v_previsao.valor_previsto-coalesce(v_previsao.valor_liquidado,0)+v_recebido_item,0);
    v_tipo := 'VALOR_DIVERGENTE';
  ELSE
    v_valor_sistema := greatest(v_previsao.valor_previsto-coalesce(v_previsao.valor_liquidado,0),0);
    v_tipo := 'SISTEMA_SEM_RELATORIO';
  END IF;
  v_diferenca := round(v_valor_sistema-coalesce(v_valor_relatorio,0),2);

  IF p_decisao IN ('GERAR_CREDITO','AJUSTAR_DIFERENCA') THEN
    IF v_item.id IS NULL THEN RAISE EXCEPTION 'A decisão exige uma linha do relatório'; END IF;
    IF abs(v_diferenca)<=0.02 THEN RAISE EXCEPTION 'A linha não possui diferença financeira a resolver'; END IF;
    IF p_decisao='GERAR_CREDITO' AND v_diferenca<=0 THEN
      RAISE EXCEPTION 'Crédito só é permitido quando o valor do sistema é maior que o relatório';
    END IF;
    IF v_item.previsao_franquia_id IS NULL THEN
      PERFORM public.rpc_vincular_item_repasse_manual(p_empresa_id,v_item.id,v_previsao.id);
    END IF;
    IF p_decisao='AJUSTAR_DIFERENCA' AND v_diferenca<0 THEN
      v_ajuste:=coalesce(p_valor_ajuste,abs(v_diferenca));
      IF abs(v_ajuste-abs(v_diferenca))>0.02 THEN
        RAISE EXCEPTION 'O ajuste deve resolver exatamente a diferença de %',abs(v_diferenca);
      END IF;
      PERFORM public.rpc_conciliar_recebimento_manual(
        p_empresa_id,v_importacao.recebimento_id,'[]'::jsonb,
        jsonb_build_array(jsonb_build_object('tipo','AJUSTE_ADMINISTRADORA','valor',v_ajuste,
          'descricao','Ajuste manual da divergência do relatório, linha '||v_item.linha||': '||coalesce(nullif(trim(p_motivo),''),'sem observação'))),
        'repasse-ajuste:'||v_idempotency
      );
    END IF;
  ELSIF p_decisao='CANCELAR_COTA' THEN
    IF v_previsao.cota_definitiva_id IS NULL THEN RAISE EXCEPTION 'A comissão não possui cota para cancelar'; END IF;
    IF length(trim(coalesce(p_motivo,'')))<5 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento da cota'; END IF;
    v_cancelamento:=public.rpc_cancelar_cota_com_estorno(
      p_empresa_id,v_previsao.cota_definitiva_id,trim(p_motivo),current_date);
  END IF;

  INSERT INTO public.erp_repasse_atencao_resolucoes(
    empresa_id,importacao_id,item_importacao_id,previsao_franquia_id,tipo,decisao,
    valor_sistema,valor_relatorio,valor_diferenca,motivo,idempotency_key,resolvido_por_usuario_id
  ) VALUES(
    p_empresa_id,p_importacao_id,p_item_importacao_id,p_previsao_franquia_id,v_tipo,p_decisao,
    v_valor_sistema,v_valor_relatorio,v_diferenca,nullif(trim(coalesce(p_motivo,'')),''),v_idempotency,public.current_usuario_id()
  ) RETURNING * INTO v_existente;

  RETURN jsonb_build_object('ok',true,'idempotente',false,'resolucao_id',v_existente.id,
    'decisao',p_decisao,'valor_sistema',v_valor_sistema,'valor_relatorio',v_valor_relatorio,
    'diferenca',v_diferenca,'cancelamento',v_cancelamento);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_resolver_atencao_repasse(uuid,uuid,text,uuid,uuid,numeric,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_resolver_atencao_repasse(uuid,uuid,text,uuid,uuid,numeric,text,text)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.rpc_reprocessar_repasse_racon(
  p_empresa_id uuid,
  p_importacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_match record;
  v_exact_count integer;
  v_auto integer:=0;
  v_atencao integer:=0;
  v_nao_encontrado integer:=0;
  v_classificado numeric:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para atualizar a leitura deste repasse';
  END IF;
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id=p_importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_importacao.id IS NULL THEN RAISE EXCEPTION 'Relatório não encontrado no tenant'; END IF;

  -- Vínculos e baixas já realizados são fatos preservados. Somente linhas ainda
  -- abertas voltam a ser comparadas contra o estado atual do sistema.
  FOR v_item IN SELECT * FROM public.erp_repasse_importacao_itens
    WHERE importacao_id=v_importacao.id
      AND status_conciliacao IN ('ATENCAO','NAO_ENCONTRADO')
    ORDER BY linha FOR UPDATE
  LOOP
    SELECT count(*) INTO v_exact_count
    FROM public.comissao_previsoes_franquia f
    JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
    WHERE f.empresa_id=p_empresa_id AND f.administradora_id=v_importacao.administradora_id
      AND f.competencia=v_importacao.competencia AND f.status IN ('prevista','parcialmente_liquidada')
      AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
      AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
      AND f.ordem_etapa=v_item.parcela_numero
      AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02
      AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x
        WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=f.id AND x.id<>v_item.id);

    IF v_exact_count=1 THEN
      SELECT f.id,f.venda_id,v.participante_comercial_id,v.cliente_nome INTO v_match
      FROM public.comissao_previsoes_franquia f
      JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
      JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
      WHERE f.empresa_id=p_empresa_id AND f.administradora_id=v_importacao.administradora_id
        AND f.competencia=v_importacao.competencia AND f.status IN ('prevista','parcialmente_liquidada')
        AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
        AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
        AND f.ordem_etapa=v_item.parcela_numero
        AND abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)<=0.02
        AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x
          WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=f.id AND x.id<>v_item.id)
      LIMIT 1;
      IF regexp_replace(upper(coalesce(v_match.cliente_nome,'')),'[^A-Z0-9]','','g')
         = regexp_replace(upper(v_item.cliente_nome),'[^A-Z0-9]','','g') THEN
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='VINCULADO_AUTO',
          previsao_franquia_id=v_match.id,previsao_sugerida_id=v_match.id,venda_id=v_match.venda_id,
          participante_comercial_id=v_match.participante_comercial_id,
          alertas=alertas||jsonb_build_array('Vínculo encontrado ao atualizar a leitura'),
          vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now()
        WHERE id=v_item.id;
        v_auto:=v_auto+1;
      ELSE
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',
          previsao_sugerida_id=v_match.id,
          alertas=jsonb_build_array('Nome do cliente diverge do cadastro do sistema'),updated_at=now()
        WHERE id=v_item.id;
        v_atencao:=v_atencao+1;
      END IF;
    ELSE
      SELECT f.id,f.venda_id,v.participante_comercial_id INTO v_match
      FROM public.comissao_previsoes_franquia f
      JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
      JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
      WHERE f.empresa_id=p_empresa_id AND f.administradora_id=v_importacao.administradora_id
        AND f.competencia=v_importacao.competencia AND f.status IN ('prevista','parcialmente_liquidada')
        AND ltrim(regexp_replace(c.numero_grupo,'[^0-9]','','g'),'0')=ltrim(v_item.numero_grupo,'0')
        AND ltrim(regexp_replace(coalesce(c.numero_cota,''),'[^0-9]','','g'),'0')=ltrim(v_item.numero_cota,'0')
      ORDER BY abs(f.ordem_etapa-v_item.parcela_numero),
        abs((f.valor_previsto-coalesce(f.valor_liquidado,0))-v_item.valor_comissao)
      LIMIT 1;
      IF FOUND THEN
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',
          previsao_sugerida_id=v_match.id,
          alertas=jsonb_build_array('Parcela ou valor diverge do sistema; confira na aba Valores divergentes'),updated_at=now()
        WHERE id=v_item.id;
        v_atencao:=v_atencao+1;
      ELSE
        UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='NAO_ENCONTRADO',
          previsao_sugerida_id=NULL,updated_at=now() WHERE id=v_item.id;
        v_nao_encontrado:=v_nao_encontrado+1;
      END IF;
    END IF;
  END LOOP;

  IF v_importacao.recebimento_id IS NOT NULL THEN
    SELECT coalesce(sum(valor),0) INTO v_classificado FROM (
      SELECT ri.valor_liquidado AS valor FROM public.financeiro_recebimento_itens ri
      WHERE ri.recebimento_id=v_importacao.recebimento_id
      UNION ALL
      SELECT rc.valor FROM public.financeiro_recebimento_classificacoes rc
      WHERE rc.recebimento_id=v_importacao.recebimento_id
    ) valores;
  END IF;
  UPDATE public.erp_repasse_importacoes SET
    status=CASE
      WHEN EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i WHERE i.importacao_id=v_importacao.id AND i.status_conciliacao IN ('ATENCAO','NAO_ENCONTRADO')) THEN 'PENDENTE'
      WHEN v_classificado>=valor_total_bruto THEN 'CONFIRMADO'
      ELSE 'PRONTO' END,
    updated_at=now()
  WHERE id=v_importacao.id;

  RETURN jsonb_build_object('importacao_id',v_importacao.id,'reprocessado',true,
    'vinculados_auto',v_auto,'atencao',v_atencao,'nao_encontrados',v_nao_encontrado);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_reprocessar_repasse_racon(uuid,uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_reprocessar_repasse_racon(uuid,uuid) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
