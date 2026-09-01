-- 182: conciliação de repasse com cadastro mínimo e comissão exata do relatório.
BEGIN;

DROP FUNCTION IF EXISTS public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,numeric);

CREATE OR REPLACE FUNCTION public.rpc_lancar_item_repasse_legado(
  p_empresa_id uuid,
  p_item_id uuid,
  p_participante_id uuid,
  p_regra_participante_id uuid DEFAULT NULL,
  p_sem_regra boolean DEFAULT true,
  p_cliente_nome text DEFAULT NULL,
  p_grupo_id uuid DEFAULT NULL,
  p_numero_grupo text DEFAULT NULL,
  p_numero_cota text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_item public.erp_repasse_importacao_itens%ROWTYPE;
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_admin public.administradoras%ROWTYPE;
  v_regra public.comissao_regras_participantes%ROWTYPE;
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_cliente public.clientes%ROWTYPE;
  v_venda public.vendas%ROWTYPE;
  v_cota public.cotas_definitivas%ROWTYPE;
  v_previsao_id uuid;
  v_valor_participante numeric;
  v_percentual numeric;
  v_prazo integer;
  v_parcela numeric;
BEGIN
  IF auth.uid() IS NULL
     OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro')
     OR NOT public.has_company_permission(p_empresa_id,'gerenciar_comissoes') THEN
    RAISE EXCEPTION 'Sem permissão para lançar comissão de repasse';
  END IF;

  SELECT * INTO v_item FROM public.erp_repasse_importacao_itens
  WHERE id=p_item_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_item.id IS NULL OR v_item.status_conciliacao NOT IN ('NAO_ENCONTRADO','ATENCAO') THEN
    RAISE EXCEPTION 'Linha não está disponível para cadastro e vínculo';
  END IF;
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id=v_item.importacao_id AND empresa_id=p_empresa_id;
  SELECT * INTO v_admin FROM public.administradoras WHERE id=v_importacao.administradora_id;

  IF NULLIF(trim(p_cliente_nome),'') IS NULL OR NULLIF(trim(p_numero_grupo),'') IS NULL
     OR NULLIF(trim(p_numero_cota),'') IS NULL THEN
    RAISE EXCEPTION 'Cliente, grupo e número da cota são obrigatórios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais p
    WHERE p.id=p_participante_id AND p.empresa_id=p_empresa_id AND p.status='ATIVO') THEN
    RAISE EXCEPTION 'Consultor inválido';
  END IF;

  IF NOT coalesce(p_sem_regra,false) THEN
    SELECT * INTO v_regra FROM public.comissao_regras_participantes r
    WHERE r.id=p_regra_participante_id AND r.empresa_id=p_empresa_id
      AND r.ativa AND r.configuracao_homologada AND r.status='HOMOLOGADA';
    IF v_regra.id IS NULL THEN RAISE EXCEPTION 'Regra do consultor inválida'; END IF;
  END IF;

  IF p_grupo_id IS NOT NULL THEN
    SELECT * INTO v_grupo FROM public.grupos_consorcio g
    WHERE g.id=p_grupo_id AND g.administradora_id=v_importacao.administradora_id
      AND (g.origem_governanca IN ('GLOBAL','LEGADO') OR g.empresa_origem_id=p_empresa_id);
    IF v_grupo.id IS NULL THEN RAISE EXCEPTION 'Grupo não pertence à administradora ou à franquia'; END IF;
  ELSE
    SELECT * INTO v_grupo FROM public.grupos_consorcio g
    WHERE g.administradora_id=v_importacao.administradora_id
      AND upper(trim(g.codigo_grupo))=upper(trim(p_numero_grupo))
      AND (g.origem_governanca IN ('GLOBAL','LEGADO') OR g.empresa_origem_id=p_empresa_id)
    ORDER BY (g.empresa_origem_id=p_empresa_id) DESC LIMIT 1;

    IF v_grupo.id IS NULL THEN
      INSERT INTO public.grupos_consorcio(
        codigo_grupo,modalidade,administradora,administradora_id,status,ativo,
        prazo_total,prazo_restante,observacoes,empresa_origem_id,origem_governanca,status_governanca
      ) VALUES(
        trim(p_numero_grupo),coalesce(nullif(trim(v_item.produto),''),'Cadastro administrativo'),
        coalesce(v_admin.nome_fantasia,v_admin.nome),v_admin.id,'Inativo',false,
        greatest(coalesce(v_item.parcela_total,1),1),greatest(coalesce(v_item.parcela_total,1),1),
        'Grupo local criado pela conciliação de repasse; não publicado no site.',
        p_empresa_id,'LOCAL','LOCAL'
      ) RETURNING * INTO v_grupo;
      INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao)
      VALUES(v_grupo.id,p_empresa_id,'CRIADO_LOCAL',public.current_usuario_id(),
        'Criação administrativa inativa pelo vínculo de cota do PDF de repasse.');
    END IF;
  END IF;

  SELECT * INTO v_cliente FROM public.clientes c
  WHERE c.empresa_id=p_empresa_id AND upper(trim(c.nome))=upper(trim(p_cliente_nome))
  ORDER BY c.created_at LIMIT 1;
  IF v_cliente.id IS NULL THEN
    INSERT INTO public.clientes(
      empresa_id,tipo_pessoa,nome,origem,pendencias_cadastro,observacoes,participante_comercial_id
    ) VALUES(
      p_empresa_id,'PF',trim(p_cliente_nome),'importacao_legado',
      ARRAY['PENDENTE_CPF_CNPJ','PENDENTE_TELEFONE']::text[],
      'Cadastro mínimo criado pelo PDF de repasse. Completar os dados cadastrais.',p_participante_id
    ) RETURNING * INTO v_cliente;
  END IF;

  v_prazo:=greatest(coalesce(v_grupo.prazo_restante,v_grupo.prazo_total,v_item.parcela_total,1),1);
  v_parcela:=greatest(round(coalesce(nullif(v_item.valor_base,0),v_item.valor_comissao)/v_prazo,2),0.01);
  INSERT INTO public.vendas(
    empresa_id,cliente_id,cliente_nome,administradora_id,grupo_id,participante_comercial_id,
    valor_credito,prazo,parcela,status,snapshot_venda,data_venda,origem_registro,afeta_faturamento
  ) VALUES(
    p_empresa_id,v_cliente.id,v_cliente.nome,v_admin.id,v_grupo.id,p_participante_id,
    greatest(coalesce(v_item.valor_base,v_item.valor_comissao),0.01),v_prazo,v_parcela,'confirmada',
    jsonb_build_object('origem','REPASSE_PDF_CADASTRO_MINIMO','afeta_faturamento',false,
      'numero_grupo',trim(p_numero_grupo),'numero_cota',trim(p_numero_cota),'dados_pendentes',true),
    coalesce(v_item.data_alocacao,current_date)::timestamptz,'IMPORTACAO_LEGADO',false
  ) RETURNING * INTO v_venda;

  INSERT INTO public.cotas_definitivas(
    empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,numero_cota,valor_credito,
    prazo,parcela,status,participante_comercial_id,snapshot_cota,origem_registro
  ) VALUES(
    p_empresa_id,v_venda.id,v_admin.id,v_grupo.id,trim(p_numero_grupo),trim(p_numero_cota),
    v_venda.valor_credito,v_prazo,v_parcela,'ativa',p_participante_id,
    jsonb_build_object('origem','REPASSE_PDF_CADASTRO_MINIMO','dados_pendentes',true),'IMPORTACAO_LEGADO'
  ) RETURNING * INTO v_cota;

  INSERT INTO public.comissao_previsoes_franquia(
    empresa_id,venda_id,cota_definitiva_id,administradora_id,ordem_etapa,nome_etapa,competencia,
    base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho
  ) VALUES(
    p_empresa_id,v_venda.id,v_cota.id,v_admin.id,v_item.parcela_numero,
    v_item.parcela_numero||'ª Parcela (PDF)',v_importacao.competencia,v_item.valor_base,
    v_item.percentual_comissao,v_item.valor_comissao,'prevista',
    jsonb_build_object('origem','REPASSE_PDF','item_repasse_id',v_item.id),'MES_RELATIVO'
  ) RETURNING id INTO v_previsao_id;

  v_valor_participante:=CASE WHEN p_sem_regra THEN v_item.valor_comissao
    ELSE round(v_item.valor_comissao*v_regra.percentual_comissao/100,2) END;
  v_percentual:=CASE WHEN p_sem_regra THEN 100 ELSE v_regra.percentual_comissao END;
  INSERT INTO public.comissao_previsoes_participantes(
    empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,regra_participante_id,papel_tipo,
    previsao_franquia_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,
    valor_previsto,status,snapshot_regra,tipo_gatilho,origem_registro
  ) VALUES(
    p_empresa_id,v_venda.id,v_cota.id,p_participante_id,CASE WHEN p_sem_regra THEN NULL ELSE v_regra.id END,
    'CONSULTOR',v_previsao_id,v_item.parcela_numero,v_item.parcela_numero||'ª Parcela (PDF)',
    v_importacao.competencia,v_item.valor_comissao,v_percentual,v_valor_participante,'prevista',
    jsonb_build_object('origem','REPASSE_PDF','sem_regra',p_sem_regra,'valor_exato_relatorio',v_valor_participante,
      'item_repasse_id',v_item.id),'MES_RELATIVO','IMPORTACAO_LEGADO'
  );

  UPDATE public.erp_repasse_importacao_itens SET
    status_conciliacao='LANCADO_LEGADO',previsao_franquia_id=v_previsao_id,
    previsao_sugerida_id=v_previsao_id,venda_id=v_venda.id,participante_comercial_id=p_participante_id,
    cliente_nome=v_cliente.nome,numero_grupo=trim(p_numero_grupo),numero_cota=trim(p_numero_cota),
    vinculado_por_usuario_id=public.current_usuario_id(),vinculado_em=now(),updated_at=now()
  WHERE id=v_item.id;

  INSERT INTO public.clientes_historico(empresa_id,cliente_id,tipo_evento,descricao,venda_id)
  VALUES(p_empresa_id,v_cliente.id,'importacao_legado',
    format('Cota %s/%s cadastrada pelo repasse; dados cadastrais pendentes.',trim(p_numero_grupo),trim(p_numero_cota)),v_venda.id);

  RETURN jsonb_build_object('ok',true,'venda_id',v_venda.id,'cota_id',v_cota.id,
    'previsao_id',v_previsao_id,'grupo_criado_inativo',NOT v_grupo.ativo,'dados_pendentes',true);
END $$;

REVOKE ALL ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_lancar_item_repasse_legado(uuid,uuid,uuid,uuid,boolean,text,uuid,text,text)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
