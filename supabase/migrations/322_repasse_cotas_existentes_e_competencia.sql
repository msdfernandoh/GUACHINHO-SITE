-- Continuidade de parcelas do PDF sem duplicar cliente/venda/cota.
-- Nenhum backfill: a releitura autenticada executa a conciliação.
BEGIN;

CREATE FUNCTION public.repasse_chave_numero_322(text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT nullif(ltrim(regexp_replace(coalesce($1,''),'[^0-9]','','g'),'0'),'');
$$;
CREATE FUNCTION public.repasse_chave_nome_322(text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT nullif(regexp_replace(translate(upper(coalesce($1,'')),
    'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ','AAAAAEEEEIIIIOOOOOUUUUC'),'[^A-Z0-9]','','g'),'');
$$;

-- Exceção explícita para reconhecer uma parcela real do PDF em cota de controle.
-- Não transforma a venda em faturamento nem autoriza projeções sem relatório.
CREATE TABLE public.erp_repasse_cotas_comissao_autorizacoes (
  cota_definitiva_id uuid PRIMARY KEY REFERENCES public.cotas_definitivas(id),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  participante_comercial_id uuid NOT NULL REFERENCES public.participantes_comerciais(id),
  autorizado_por uuid NOT NULL REFERENCES public.usuarios(id),
  motivo text NOT NULL CHECK (length(trim(motivo))>=10),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.erp_repasse_cotas_comissao_autorizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY repasse_cota_autorizacao_leitura ON public.erp_repasse_cotas_comissao_autorizacoes
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
GRANT SELECT ON public.erp_repasse_cotas_comissao_autorizacoes TO authenticated;
CREATE TRIGGER repasse_cota_autorizacao_append_only BEFORE UPDATE OR DELETE
  ON public.erp_repasse_cotas_comissao_autorizacoes FOR EACH ROW
  EXECUTE FUNCTION public.bloquear_mutacao_financeira_187();

CREATE OR REPLACE FUNCTION public.bloquear_comissao_cadastro_antigo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vendas WHERE id=NEW.venda_id AND somente_controle) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.erp_repasse_cotas_comissao_autorizacoes a
      JOIN public.cotas_definitivas c ON c.id=a.cota_definitiva_id AND c.empresa_id=a.empresa_id
      JOIN public.erp_repasse_importacao_itens i ON i.id::text=NEW.snapshot_regra->>'item_repasse_id'
        AND i.empresa_id=a.empresa_id
      JOIN public.erp_repasse_importacoes imp ON imp.id=i.importacao_id AND imp.empresa_id=i.empresa_id
      WHERE a.empresa_id=NEW.empresa_id AND c.venda_id=NEW.venda_id
        AND c.id=NEW.cota_definitiva_id AND imp.recebimento_id IS NOT NULL
        AND public.repasse_chave_numero_322(c.numero_grupo)=public.repasse_chave_numero_322(i.numero_grupo)
        AND public.repasse_chave_numero_322(c.numero_cota)=public.repasse_chave_numero_322(i.numero_cota)
        AND NEW.ordem_etapa=i.parcela_numero AND NEW.competencia=imp.competencia
        AND NEW.valor_previsto BETWEEN 0 AND i.valor_comissao
        AND NEW.snapshot_regra->>'origem'='REPASSE_PDF'
    ) THEN RAISE EXCEPTION 'Cadastro antigo somente para controle: não gera comissões sem autorização e parcela real do repasse'; END IF;
    IF TG_TABLE_NAME='comissao_previsoes_participantes' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.erp_repasse_cotas_comissao_autorizacoes a
      WHERE a.cota_definitiva_id=NEW.cota_definitiva_id AND a.empresa_id=NEW.empresa_id
        AND a.participante_comercial_id=NEW.participante_comercial_id
    ) THEN RAISE EXCEPTION 'Participante não autorizado para esta cota de controle'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Candidatos incluem competências anteriores/futuras; a etapa permanece exata.
CREATE FUNCTION public.repasse_candidatos_322(p_empresa_id uuid,p_item_id uuid)
RETURNS TABLE(id uuid,venda_id uuid,cota_id uuid,cliente_nome text,
  participante_id uuid,ordem_etapa integer,competencia text,saldo numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT f.id,f.venda_id,c.id,coalesce(nullif(trim(cli.nome),''),v.cliente_nome),
    v.participante_comercial_id,f.ordem_etapa,f.competencia,f.valor_previsto-coalesce(f.valor_liquidado,0)
  FROM public.erp_repasse_importacao_itens i
  JOIN public.erp_repasse_importacoes imp ON imp.id=i.importacao_id AND imp.empresa_id=i.empresa_id
  JOIN public.comissao_previsoes_franquia f ON f.empresa_id=i.empresa_id AND f.administradora_id=imp.administradora_id
  JOIN public.cotas_definitivas c ON c.id=f.cota_definitiva_id AND c.empresa_id=f.empresa_id
  JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
  LEFT JOIN public.clientes cli ON cli.id=v.cliente_id AND cli.empresa_id=v.empresa_id
  WHERE i.id=p_item_id AND i.empresa_id=p_empresa_id
    AND f.status IN ('prevista','parcialmente_liquidada') AND c.status<>'cancelada' AND v.status='confirmada'
    AND public.repasse_chave_numero_322(c.numero_grupo)=public.repasse_chave_numero_322(i.numero_grupo)
    AND public.repasse_chave_numero_322(c.numero_cota)=public.repasse_chave_numero_322(i.numero_cota)
    AND NOT EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens x
      WHERE x.empresa_id=p_empresa_id AND x.previsao_franquia_id=f.id AND x.id<>i.id);
$$;

-- Identidade natural da cota, priorizando a continuação de histórico financeiro.
-- Duplicatas históricas são preservadas; empate exige decisão manual.
CREATE FUNCTION public.repasse_cota_existente_322(p_empresa_id uuid,p_item_id uuid)
RETURNS TABLE(cota_id uuid,ultima_etapa integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT c.id,coalesce(max(f.ordem_etapa),0)
  FROM public.erp_repasse_importacao_itens i
  JOIN public.erp_repasse_importacoes imp ON imp.id=i.importacao_id AND imp.empresa_id=i.empresa_id
  JOIN public.cotas_definitivas c ON c.empresa_id=i.empresa_id AND c.administradora_id=imp.administradora_id
  JOIN public.vendas v ON v.id=c.venda_id AND v.empresa_id=c.empresa_id
  LEFT JOIN public.clientes cli ON cli.id=v.cliente_id AND cli.empresa_id=v.empresa_id
  LEFT JOIN public.comissao_previsoes_franquia f ON f.cota_definitiva_id=c.id AND f.empresa_id=c.empresa_id
    AND f.status<>'cancelada'
  WHERE i.id=p_item_id AND i.empresa_id=p_empresa_id AND c.status<>'cancelada' AND v.status='confirmada'
    AND public.repasse_chave_numero_322(c.numero_grupo)=public.repasse_chave_numero_322(i.numero_grupo)
    AND public.repasse_chave_numero_322(c.numero_cota)=public.repasse_chave_numero_322(i.numero_cota)
    AND public.repasse_chave_nome_322(coalesce(nullif(trim(cli.nome),''),v.cliente_nome))=
        public.repasse_chave_nome_322(i.cliente_nome)
  GROUP BY c.id ORDER BY coalesce(max(f.ordem_etapa),0) DESC;
$$;

CREATE FUNCTION public.repasse_criar_parcela_existente_322(
  p_empresa_id uuid,p_item_id uuid,p_cota_id uuid,p_participante_id uuid,p_valor_participante numeric
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  i public.erp_repasse_importacao_itens%ROWTYPE;
  c public.cotas_definitivas%ROWTYPE;
  imp public.erp_repasse_importacoes%ROWTYPE;
  f_id uuid;
  aliquota numeric;
  liquido_participante numeric;
  imposto_participante numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro')
    OR NOT public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN RAISE EXCEPTION 'Sem permissão para lançar parcela'; END IF;
  SELECT * INTO i FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linha não encontrada'; END IF;
  SELECT * INTO imp FROM public.erp_repasse_importacoes WHERE id=i.importacao_id AND empresa_id=p_empresa_id;
  SELECT * INTO c FROM public.cotas_definitivas WHERE id=p_cota_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) x WHERE x.cota_id=c.id)
    THEN RAISE EXCEPTION 'Cota não corresponde ao cliente, grupo e número do relatório'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':REPASSE_COTA:'||
    imp.administradora_id::text||':'||public.repasse_chave_numero_322(i.numero_grupo)||':'||
    public.repasse_chave_numero_322(i.numero_cota),0));
  IF i.previsao_franquia_id IS NOT NULL THEN RETURN i.previsao_franquia_id; END IF;
  -- Nunca recriar uma etapa que já existe, inclusive liquidada em outra cópia histórica da cota.
  IF EXISTS (SELECT 1 FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) x
    JOIN public.comissao_previsoes_franquia f ON f.cota_definitiva_id=x.cota_id AND f.empresa_id=p_empresa_id
    WHERE f.ordem_etapa=i.parcela_numero AND f.status<>'cancelada')
    THEN RAISE EXCEPTION 'Esta parcela já possui comissão; selecione a previsão existente ou confira sua baixa anterior'; END IF;
  IF p_valor_participante IS NULL OR p_valor_participante<0 OR p_valor_participante>i.valor_comissao
    THEN RAISE EXCEPTION 'Comissão do participante inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais WHERE id=p_participante_id
    AND empresa_id=p_empresa_id AND status='ATIVO') THEN RAISE EXCEPTION 'Consultor inválido'; END IF;
  -- Continuação conserva a alíquota comprovada na parcela anterior da mesma cota.
  SELECT f.percentual_imposto INTO aliquota FROM public.comissao_previsoes_franquia f
    WHERE f.empresa_id=p_empresa_id AND f.cota_definitiva_id=c.id AND f.status<>'cancelada'
    ORDER BY f.ordem_etapa DESC,f.created_at DESC LIMIT 1;
  IF aliquota IS NULL THEN
    SELECT cf.percentual_imposto INTO aliquota FROM public.empresa_configuracoes_fiscais cf
      WHERE cf.empresa_id=p_empresa_id AND cf.ativo AND cf.vigencia_inicio<=(imp.competencia||'-01')::date
        AND (cf.vigencia_fim IS NULL OR cf.vigencia_fim>=(imp.competencia||'-01')::date)
      ORDER BY cf.vigencia_inicio DESC LIMIT 1;
  END IF;
  IF aliquota IS NULL THEN RAISE EXCEPTION 'Configure o imposto da empresa antes de reconhecer a parcela do repasse'; END IF;
  imposto_participante:=round(p_valor_participante*aliquota/100,2);
  liquido_participante:=p_valor_participante-imposto_participante;
  INSERT INTO public.comissao_previsoes_franquia(empresa_id,venda_id,cota_definitiva_id,administradora_id,
    ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
  VALUES(p_empresa_id,c.venda_id,c.id,c.administradora_id,i.parcela_numero,i.parcela_numero||'ª Parcela (PDF)',
    imp.competencia,i.valor_base,i.percentual_comissao,i.valor_comissao,'prevista',
    jsonb_build_object('origem','REPASSE_PDF','item_repasse_id',i.id,'cota_existente_322',true,'imposto_aliquota',aliquota), 'MES_RELATIVO')
  RETURNING id INTO f_id;
  -- O valor informado é bruto; imposto e elegibilidade seguem a sincronização canônica.
  INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,
    papel_tipo,previsao_franquia_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,
    valor_previsto,status,snapshot_regra,tipo_gatilho,origem_registro)
  VALUES(p_empresa_id,c.venda_id,c.id,p_participante_id,'CONSULTOR',f_id,i.parcela_numero,
    i.parcela_numero||'ª Parcela (PDF)',imp.competencia,i.valor_comissao,
    CASE WHEN i.valor_comissao>0 THEN round(p_valor_participante*100/i.valor_comissao,4) ELSE 0 END,
    liquido_participante,'prevista',jsonb_build_object('origem','REPASSE_PDF','item_repasse_id',i.id,
      'sem_regra',true,'valor_exato_relatorio',p_valor_participante,'cota_existente_322',true,
      'fiscal_lote',jsonb_build_object('valor_bruto',p_valor_participante,'valor_liquido',liquido_participante,
        'imposto_aliquota',aliquota,'imposto_valor',imposto_participante)),'MES_RELATIVO','IMPORTACAO_LEGADO');
  INSERT INTO public.clientes_historico(empresa_id,cliente_id,tipo_evento,descricao,venda_id)
  SELECT p_empresa_id,v.cliente_id,'importacao_legado',
    format('Parcela %s do repasse vinculada à cota existente %s/%s, sem duplicar venda ou cota.',i.parcela_numero,i.numero_grupo,i.numero_cota),c.venda_id
  FROM public.vendas v WHERE v.id=c.venda_id AND v.cliente_id IS NOT NULL;
  RETURN f_id;
END $$;

CREATE FUNCTION public.repasse_conciliar_linha_322(p_empresa_id uuid,p_item_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  i public.erp_repasse_importacao_itens%ROWTYPE;
  m record;
  ref record;
  cot record;
  n integer;
  f_id uuid;
  aviso text;
BEGIN
  SELECT * INTO i FROM public.erp_repasse_importacao_itens WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF i.previsao_franquia_id IS NOT NULL THEN RETURN i.status_conciliacao; END IF;
  SELECT count(*) INTO n FROM public.repasse_candidatos_322(p_empresa_id,p_item_id) x
    WHERE x.ordem_etapa=i.parcela_numero AND abs(x.saldo-i.valor_comissao)<=0.02
      AND public.repasse_chave_nome_322(x.cliente_nome)=public.repasse_chave_nome_322(i.cliente_nome);
  IF n=1 THEN
    SELECT * INTO m FROM public.repasse_candidatos_322(p_empresa_id,p_item_id) x
      WHERE x.ordem_etapa=i.parcela_numero AND abs(x.saldo-i.valor_comissao)<=0.02
        AND public.repasse_chave_nome_322(x.cliente_nome)=public.repasse_chave_nome_322(i.cliente_nome);
    UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=m.id,previsao_sugerida_id=m.id,
      venda_id=m.venda_id,participante_comercial_id=m.participante_id,status_conciliacao='VINCULADO_AUTO',
      alertas=CASE WHEN m.competencia<>(SELECT competencia FROM public.erp_repasse_importacoes WHERE id=i.importacao_id)
        THEN jsonb_build_array('Parcela recebida em competência diferente da previsão; cronograma histórico preservado') ELSE '[]'::jsonb END,
      vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=i.id;
    RETURN 'VINCULADO_AUTO';
  END IF;
  IF n>1 THEN aviso:='Mais de uma comissão corresponde à parcela; selecione o vínculo manual';
  ELSE
    SELECT count(*) INTO n FROM public.repasse_candidatos_322(p_empresa_id,p_item_id);
    IF n>0 THEN
      SELECT * INTO m FROM public.repasse_candidatos_322(p_empresa_id,p_item_id)
        ORDER BY abs(ordem_etapa-i.parcela_numero),abs(saldo-i.valor_comissao),id LIMIT 1;
      UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='ATENCAO',previsao_sugerida_id=m.id,
        alertas=jsonb_build_array('Parcela, valor ou titular diverge do sistema; confira antes de vincular'),updated_at=now() WHERE id=i.id;
      RETURN 'ATENCAO';
    END IF;
    SELECT * INTO cot FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) LIMIT 1;
    IF FOUND THEN
      SELECT count(*) INTO n FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) x WHERE x.ultima_etapa=cot.ultima_etapa;
      IF n=1 AND cot.ultima_etapa<i.parcela_numero AND public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN
        -- Continuação automática somente do cadastro mínimo pelo PDF, com percentual explícito.
        SELECT p.participante_comercial_id,p.percentual_aplicado INTO ref
        FROM public.comissao_previsoes_franquia f
        JOIN public.comissao_previsoes_participantes p ON p.previsao_franquia_id=f.id AND p.empresa_id=f.empresa_id
        WHERE f.cota_definitiva_id=cot.cota_id AND f.empresa_id=p_empresa_id AND f.ordem_etapa=cot.ultima_etapa
          AND f.ordem_etapa<i.parcela_numero AND f.regra_franquia_id IS NULL
          AND f.snapshot_regra->>'origem'='REPASSE_PDF' AND p.snapshot_regra->>'sem_regra'='true'
          AND p.percentual_aplicado BETWEEN 0 AND 100
          AND (SELECT count(*) FROM public.comissao_previsoes_participantes pp WHERE pp.previsao_franquia_id=f.id)=1;
        IF FOUND THEN
          f_id:=public.repasse_criar_parcela_existente_322(p_empresa_id,p_item_id,cot.cota_id,
            ref.participante_comercial_id,round(i.valor_comissao*ref.percentual_aplicado/100,2));
          UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=f_id,previsao_sugerida_id=f_id,
            venda_id=(SELECT venda_id FROM public.cotas_definitivas WHERE id=cot.cota_id),
            participante_comercial_id=ref.participante_comercial_id,status_conciliacao='VINCULADO_AUTO',alertas='[]',
            vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=i.id;
          RETURN 'VINCULADO_AUTO';
        END IF;
        -- Cota de controle tem autorização explícita própria, nunca percentual presumido.
        SELECT participante_comercial_id INTO ref FROM public.erp_repasse_cotas_comissao_autorizacoes
          WHERE cota_definitiva_id=cot.cota_id AND empresa_id=p_empresa_id;
        IF FOUND THEN
          f_id:=public.repasse_criar_parcela_existente_322(p_empresa_id,p_item_id,cot.cota_id,ref.participante_comercial_id,i.valor_comissao);
          UPDATE public.erp_repasse_importacao_itens SET previsao_franquia_id=f_id,previsao_sugerida_id=f_id,
            venda_id=(SELECT venda_id FROM public.cotas_definitivas WHERE id=cot.cota_id),
            participante_comercial_id=ref.participante_comercial_id,status_conciliacao='VINCULADO_AUTO',alertas='[]',
            vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now() WHERE id=i.id;
          RETURN 'VINCULADO_AUTO';
        END IF;
      END IF;
      aviso:='Cliente e cota já cadastrados, sem comissão aberta para esta parcela; informe a comissão usando a cota existente';
    ELSE aviso:='Nenhuma cota cadastrada corresponde ao cliente, grupo e número do PDF'; END IF;
  END IF;
  UPDATE public.erp_repasse_importacao_itens SET status_conciliacao='NAO_ENCONTRADO',previsao_sugerida_id=NULL,
    alertas=jsonb_build_array(aviso),updated_at=now() WHERE id=i.id;
  RETURN 'NAO_ENCONTRADO';
END $$;

CREATE OR REPLACE FUNCTION public.rpc_reprocessar_repasse_racon(p_empresa_id uuid,p_importacao_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE imp public.erp_repasse_importacoes%ROWTYPE; i record; s text; a integer:=0; t integer:=0; n integer:=0; total numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão para atualizar a leitura deste repasse'; END IF;
  SELECT * INTO imp FROM public.erp_repasse_importacoes WHERE id=p_importacao_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Relatório não encontrado no tenant'; END IF;
  FOR i IN SELECT id FROM public.erp_repasse_importacao_itens WHERE importacao_id=imp.id AND empresa_id=p_empresa_id
    AND previsao_franquia_id IS NULL AND status_conciliacao IN ('ATENCAO','NAO_ENCONTRADO') ORDER BY linha,id FOR UPDATE
  LOOP
    s:=public.repasse_conciliar_linha_322(p_empresa_id,i.id);
    IF s='VINCULADO_AUTO' THEN a:=a+1; ELSIF s='ATENCAO' THEN t:=t+1; ELSE n:=n+1; END IF;
  END LOOP;
  PERFORM public.sincronizar_importacao_repasse_canonica_282(p_empresa_id,imp.id,auth.uid());
  SELECT coalesce(sum(valor),0) INTO total FROM (
    SELECT valor_liquidado valor FROM public.financeiro_recebimento_itens WHERE recebimento_id=imp.recebimento_id
    UNION ALL SELECT valor FROM public.financeiro_recebimento_classificacoes WHERE recebimento_id=imp.recebimento_id
  ) x;
  UPDATE public.erp_repasse_importacoes SET status=CASE
    WHEN EXISTS(SELECT 1 FROM public.erp_repasse_importacao_itens WHERE importacao_id=imp.id
      AND (previsao_franquia_id IS NULL OR alertas @> jsonb_build_array('Saldo do recebimento insuficiente para completar a linha do relatorio'))) THEN 'PENDENTE'
    WHEN total>=valor_total_bruto THEN 'CONFIRMADO' ELSE 'PRONTO' END,updated_at=now() WHERE id=imp.id;
  RETURN jsonb_build_object('importacao_id',imp.id,'reprocessado',true,'vinculados_auto',a,'atencao',t,'nao_encontrados',n);
END $$;

CREATE FUNCTION public.rpc_autorizar_comissao_repasse_controle_322(
  p_empresa_id uuid,p_cota_id uuid,p_participante_id uuid,p_motivo text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro')
    OR NOT public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cotas_definitivas c JOIN public.vendas v ON v.id=c.venda_id AND v.empresa_id=c.empresa_id
    WHERE c.id=p_cota_id AND c.empresa_id=p_empresa_id AND v.somente_controle)
    OR NOT EXISTS (SELECT 1 FROM public.participantes_comerciais p WHERE p.id=p_participante_id AND p.empresa_id=p_empresa_id AND p.status='ATIVO')
    THEN RAISE EXCEPTION 'Cota de controle ou participante inválido na empresa'; END IF;
  INSERT INTO public.erp_repasse_cotas_comissao_autorizacoes(cota_definitiva_id,empresa_id,participante_comercial_id,autorizado_por,motivo)
  VALUES(p_cota_id,p_empresa_id,p_participante_id,public.current_usuario_id(),p_motivo) ON CONFLICT DO NOTHING;
  IF NOT EXISTS (SELECT 1 FROM public.erp_repasse_cotas_comissao_autorizacoes WHERE cota_definitiva_id=p_cota_id
    AND empresa_id=p_empresa_id AND participante_comercial_id=p_participante_id) THEN RAISE EXCEPTION 'Autorização anterior pertence a outro participante'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.rpc_autorizar_comissao_repasse_controle_322(uuid,uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_autorizar_comissao_repasse_controle_322(uuid,uuid,uuid,text) TO authenticated;

-- O formulário existente continua aceitando valor explícito, agora reaproveitando a cota.
ALTER FUNCTION public.rpc_lancar_item_repasse_corrigido_214(uuid,uuid,uuid,text,uuid,text,text,numeric)
  RENAME TO rpc_lancar_item_repasse_corrigido_antes_322;
REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_corrigido_antes_322(uuid,uuid,uuid,text,uuid,text,text,numeric) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.rpc_lancar_item_repasse_corrigido_214(
  p_empresa_id uuid,p_item_id uuid,p_participante_id uuid,p_cliente_nome text,
  p_grupo_id uuid,p_numero_grupo text,p_numero_cota text,p_valor_participante numeric
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE cot record; n integer; f_id uuid; resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro')
    OR NOT public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO cot FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) LIMIT 1;
  IF FOUND THEN
    SELECT count(*) INTO n FROM public.repasse_cota_existente_322(p_empresa_id,p_item_id) WHERE ultima_etapa=cot.ultima_etapa;
    IF n<>1 THEN RAISE EXCEPTION 'Mais de uma cota existente corresponde ao relatório; confira os cadastros antes de lançar'; END IF;
    f_id:=public.repasse_criar_parcela_existente_322(p_empresa_id,p_item_id,cot.cota_id,p_participante_id,p_valor_participante);
    resultado:=public.rpc_vincular_item_repasse_com_cota(p_empresa_id,p_item_id,f_id,'cota-existente-322:'||p_item_id::text);
    RETURN resultado||jsonb_build_object('ok',true,'previsao_id',f_id,'cota_id',cot.cota_id,
      'venda_id',(SELECT venda_id FROM public.cotas_definitivas WHERE id=cot.cota_id),'cota_reutilizada',true);
  END IF;
  -- Se o número já existe com outro titular, nunca duplicar silenciosamente.
  IF EXISTS (SELECT 1 FROM public.erp_repasse_importacao_itens i
    JOIN public.erp_repasse_importacoes imp ON imp.id=i.importacao_id
    JOIN public.cotas_definitivas c ON c.empresa_id=i.empresa_id AND c.administradora_id=imp.administradora_id
    WHERE i.id=p_item_id AND i.empresa_id=p_empresa_id AND c.status<>'cancelada'
      AND public.repasse_chave_numero_322(c.numero_grupo)=public.repasse_chave_numero_322(p_numero_grupo)
      AND public.repasse_chave_numero_322(c.numero_cota)=public.repasse_chave_numero_322(p_numero_cota))
    THEN RAISE EXCEPTION 'Grupo e cota já cadastrados com outro titular; confira o vínculo manual'; END IF;
  RETURN public.rpc_lancar_item_repasse_corrigido_antes_322(p_empresa_id,p_item_id,p_participante_id,p_cliente_nome,
    p_grupo_id,p_numero_grupo,p_numero_cota,p_valor_participante);
END $$;
REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_corrigido_214(uuid,uuid,uuid,text,uuid,text,text,numeric) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_item_repasse_corrigido_214(uuid,uuid,uuid,text,uuid,text,text,numeric) TO authenticated;

-- Mesmo tratamento de saldo insuficiente no vínculo manual e automático.
CREATE OR REPLACE FUNCTION public.rpc_corrigir_vinculo_item_repasse(
  p_empresa_id uuid,
  p_item_id uuid,
  p_nova_previsao_franquia_id uuid,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_usuario uuid := auth.uid();
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_anterior uuid;
  v_alocacao numeric(14,2);
  v_vinculado numeric(14,2);
  v_key text := COALESCE(NULLIF(trim(p_idempotency_key), ''), 'corrigir-vinculo:' || p_item_id::text || ':' || p_nova_previsao_franquia_id::text);
BEGIN
  IF v_usuario IS NOT NULL AND NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
  WHERE id = p_item_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item de repasse nao encontrado'; END IF;

  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id = v_item.importacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN RAISE EXCEPTION 'Recebimento do relatorio nao encontrado'; END IF;

  PERFORM 1 FROM public.comissao_previsoes_franquia
  WHERE id = p_nova_previsao_franquia_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nova previsao nao encontrada'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.erp_repasse_importacao_itens
    WHERE empresa_id = p_empresa_id AND previsao_franquia_id = p_nova_previsao_franquia_id AND id <> p_item_id
  ) THEN RAISE EXCEPTION 'Esta previsao ja esta vinculada a outra linha de relatorio'; END IF;

  v_anterior := v_item.previsao_franquia_id;

  IF v_anterior IS DISTINCT FROM p_nova_previsao_franquia_id THEN
    IF EXISTS (
      SELECT 1 FROM public.comissao_previsoes_participantes
      WHERE empresa_id = p_empresa_id
        AND previsao_franquia_id IN (v_anterior, p_nova_previsao_franquia_id)
        AND COALESCE(valor_pago, 0) > 0
    ) THEN RAISE EXCEPTION 'Nao e permitido trocar previsao com comissao ja paga'; END IF;

    SELECT round(COALESCE(sum(valor_liquidado), 0), 2) INTO v_alocacao
    FROM public.erp_repasse_item_baixas
    WHERE empresa_id = p_empresa_id AND item_importacao_id = p_item_id;

    IF abs(v_alocacao) >= 0.01 AND v_anterior IS NOT NULL THEN
      INSERT INTO public.financeiro_recebimento_itens (
        recebimento_id, previsao_franquia_id, valor_liquidado
      ) VALUES (
        v_importacao.recebimento_id, v_anterior, -v_alocacao
      );

      INSERT INTO public.erp_repasse_item_baixas (
        empresa_id, item_importacao_id, recebimento_id, previsao_franquia_id,
        valor_liquidado, evento, idempotency_key, criado_por
      ) VALUES (
        p_empresa_id, p_item_id, v_importacao.recebimento_id, v_anterior,
        -v_alocacao, 'REVERSAO', v_key || ':reversao', v_usuario
      ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
    END IF;

    UPDATE public.erp_repasse_importacao_itens
    SET previsao_franquia_id = p_nova_previsao_franquia_id,
        previsao_sugerida_id = p_nova_previsao_franquia_id,
        status_conciliacao = 'VINCULADO_MANUAL',
        alertas = '[]'::jsonb,
        venda_id = (SELECT venda_id FROM public.comissao_previsoes_franquia WHERE id = p_nova_previsao_franquia_id),
        vinculado_por_usuario_id = public.current_usuario_id(),
        vinculado_em = now(),
        updated_at = now()
    WHERE id = p_item_id;

    IF v_anterior IS NOT NULL THEN
      INSERT INTO public.erp_repasse_vinculo_correcoes (
        empresa_id, item_importacao_id, recebimento_id, previsao_anterior_id,
        previsao_nova_id, valor_baixa_transferido, idempotency_key, corrigido_por_usuario_id
      ) VALUES (
        p_empresa_id, p_item_id, v_importacao.recebimento_id, v_anterior,
        p_nova_previsao_franquia_id, greatest(COALESCE(v_alocacao, 0), 0),
        v_key, public.current_usuario_id()
      ) ON CONFLICT (empresa_id, idempotency_key) DO NOTHING;
    END IF;

    IF v_anterior IS NOT NULL THEN
      PERFORM public.recalcular_liquidacao_previsao_repasse_203(p_empresa_id, v_anterior);
    END IF;
  END IF;

  -- Falta de saldo mantém o vínculo e a pendência, como na importação 313.
  PERFORM public.tentar_sincronizar_item_repasse_313(p_empresa_id, p_item_id, v_usuario);
  SELECT round(coalesce(sum(valor_liquidado),0),2) INTO v_vinculado
  FROM public.erp_repasse_item_baixas WHERE empresa_id=p_empresa_id AND item_importacao_id=p_item_id;

  RETURN jsonb_build_object(
    'item_id', p_item_id,
    'previsao_anterior_id', v_anterior,
    'previsao_nova_id', p_nova_previsao_franquia_id,
    'valor_vinculado', v_vinculado,
    'valor_relatorio', v_item.valor_comissao,
    'baixa_pendente', v_vinculado + 0.009 < v_item.valor_comissao
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_corrigir_vinculo_item_repasse(uuid, uuid, uuid, text) TO authenticated, service_role;


-- Helpers privados: nenhuma escrita administrativa direta pelo navegador.
REVOKE ALL ON FUNCTION public.repasse_candidatos_322(uuid,uuid),public.repasse_cota_existente_322(uuid,uuid),
  public.repasse_criar_parcela_existente_322(uuid,uuid,uuid,uuid,numeric),public.repasse_conciliar_linha_322(uuid,uuid)
  FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.rpc_importar_repasse_racon(
  p_empresa_id uuid,
  p_administradora_id uuid,
  p_competencia text,
  p_arquivo_nome text,
  p_arquivo_path text,
  p_arquivo_hash text,
  p_relatorio jsonb,
  p_data_recebimento date,
  p_conta_entrada text,
  p_conta_bancaria_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item_json jsonb;
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_match record;
  v_exact_count integer;
  v_auto integer := 0;
  v_atencao integer := 0;
  v_nao_encontrado integer := 0;
  v_alertas jsonb;
  v_recebimento_result jsonb;
  v_recebimento_id uuid;
  v_leitura jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para importar repasses nesta empresa';
  END IF;
  IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida'; END IF;
  IF jsonb_typeof(p_relatorio->'itens') <> 'array' OR jsonb_array_length(p_relatorio->'itens') = 0 THEN
    RAISE EXCEPTION 'Relatório sem itens';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_administradoras ea WHERE ea.empresa_id=p_empresa_id AND ea.administradora_id=p_administradora_id AND ea.status='ATIVA') THEN
    RAISE EXCEPTION 'Administradora não concedida à empresa';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':REPASSE_PDF:' || p_arquivo_hash, 0));
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE empresa_id=p_empresa_id AND arquivo_hash=p_arquivo_hash;
  IF FOUND THEN
    RETURN jsonb_build_object('importacao_id',v_importacao.id,'idempotente',true,'valor_total',v_importacao.valor_total_bruto);
  END IF;

  INSERT INTO public.erp_repasse_importacoes(
    empresa_id,administradora_id,competencia,arquivo_nome,arquivo_path,arquivo_hash,
    valor_total_bruto,ponto_venda,comissionado_codigo,comissionado_nome,pedidos,alertas,criado_por_usuario_id
  ) VALUES(
    p_empresa_id,p_administradora_id,p_competencia,trim(p_arquivo_nome),p_arquivo_path,p_arquivo_hash,
    (p_relatorio->>'valor_total')::numeric,nullif(p_relatorio->>'ponto_venda',''),
    nullif(p_relatorio->>'comissionado_codigo',''),nullif(p_relatorio->>'comissionado_nome',''),
    coalesce(p_relatorio->'pedidos','[]'::jsonb),coalesce(p_relatorio->'alertas','[]'::jsonb),public.current_usuario_id()
  ) RETURNING * INTO v_importacao;

  FOR v_item_json IN SELECT value FROM jsonb_array_elements(p_relatorio->'itens') LOOP
    INSERT INTO public.erp_repasse_importacao_itens(
      importacao_id,empresa_id,linha,produto,data_alocacao,periodo,numero_grupo,numero_cota,versao,
      cliente_nome,parcela_numero,parcela_total,situacao,percentual_comissao,valor_comissao,valor_base,dados_origem
    ) VALUES(
      v_importacao.id,p_empresa_id,(v_item_json->>'linha')::integer,v_item_json->>'produto',(v_item_json->>'data_alocacao')::date,
      v_item_json->>'periodo',v_item_json->>'grupo',v_item_json->>'cota',v_item_json->>'versao',v_item_json->>'cliente_nome',
      (v_item_json->>'parcela_numero')::integer,(v_item_json->>'parcela_total')::integer,v_item_json->>'situacao',
      (v_item_json->>'percentual_comissao')::numeric,(v_item_json->>'valor_comissao')::numeric,(v_item_json->>'valor_base')::numeric,v_item_json
    ) RETURNING * INTO v_item;

  END LOOP;

  UPDATE public.erp_repasse_importacoes SET status=CASE WHEN v_atencao+v_nao_encontrado=0 THEN 'PRONTO' ELSE 'PENDENTE' END,updated_at=now()
  WHERE id=v_importacao.id;
  v_recebimento_result := public.rpc_registrar_recebimento_manual(
    p_empresa_id,p_administradora_id,p_competencia,v_importacao.valor_total_bruto,p_data_recebimento,
    p_conta_entrada,'repasse-pdf:'||p_arquivo_hash,p_conta_bancaria_id,NULL,NULL,
    'Entrada bruta do repasse Racon '||p_competencia,'Gerado pelo PDF '||trim(p_arquivo_nome)
  );
  v_recebimento_id := (v_recebimento_result#>>'{recebimento,id}')::uuid;
  UPDATE public.erp_repasse_importacoes SET recebimento_id=v_recebimento_id WHERE id=v_importacao.id;
  v_leitura:=public.rpc_reprocessar_repasse_racon(p_empresa_id,v_importacao.id);
  v_auto:=(v_leitura->>'vinculados_auto')::integer;
  v_atencao:=(v_leitura->>'atencao')::integer;
  v_nao_encontrado:=(v_leitura->>'nao_encontrados')::integer;
  RETURN jsonb_build_object('importacao_id',v_importacao.id,'idempotente',false,'valor_total',v_importacao.valor_total_bruto,
    'recebimento_id',v_recebimento_id,'vinculados_auto',v_auto,'atencao',v_atencao,'nao_encontrados',v_nao_encontrado);
END;
$$;


COMMIT;
NOTIFY pgrst,'reload schema';
