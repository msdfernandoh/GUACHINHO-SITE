-- 192: aplica a configuração fiscal automaticamente nas novas previsões e
-- completa, por linha, previsões não pagas que ainda não possuem cálculo fiscal.
BEGIN;

CREATE OR REPLACE FUNCTION public.comissao_fiscal_franquia_automatico_192()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_aliquota numeric(7,4);
  v_config_id uuid;
  v_data_venda date;
BEGIN
  IF NEW.valor_previsto IS NULL OR NEW.valor_previsto < 0 THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.valor_previsto IS NOT DISTINCT FROM OLD.valor_previsto
     AND NEW.snapshot_regra IS NOT DISTINCT FROM OLD.snapshot_regra THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.snapshot_regra->>'imposto_aliquota', '') ~ '^[0-9]+([.][0-9]+)?$' THEN
    v_aliquota := (NEW.snapshot_regra->>'imposto_aliquota')::numeric;
  ELSE
    SELECT v.data_venda::date INTO v_data_venda
    FROM public.vendas v WHERE v.id=NEW.venda_id AND v.empresa_id=NEW.empresa_id;
    SELECT f.id,f.percentual_imposto INTO v_config_id,v_aliquota
    FROM public.empresa_configuracoes_fiscais f
    WHERE f.empresa_id=NEW.empresa_id AND f.ativo
      AND f.vigencia_inicio<=v_data_venda
      AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=v_data_venda)
    ORDER BY f.vigencia_inicio DESC LIMIT 1;
  END IF;
  IF v_aliquota IS NULL OR v_aliquota<0 OR v_aliquota>=100 THEN RETURN NEW; END IF;

  NEW.valor_bruto := round(NEW.valor_previsto,2);
  NEW.percentual_imposto := v_aliquota;
  NEW.valor_imposto := round(NEW.valor_bruto*v_aliquota/100,2);
  NEW.valor_liquido := NEW.valor_bruto-NEW.valor_imposto;
  NEW.snapshot_regra := COALESCE(NEW.snapshot_regra,'{}'::jsonb) || jsonb_build_object(
    'fiscal_automatico',jsonb_build_object(
      'configuracao_id',v_config_id,'aliquota',v_aliquota,
      'valor_bruto',NEW.valor_bruto,'imposto_valor',NEW.valor_imposto,
      'valor_liquido',NEW.valor_liquido
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.comissao_fiscal_participante_automatico_192()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_config record;
  v_data_venda date;
  v_bruto numeric(15,2);
  v_imposto numeric(15,2);
  v_liquido numeric(15,2);
  v_fiscal jsonb;
  v_ja_liquido boolean;
BEGIN
  IF NEW.valor_previsto IS NULL OR NEW.valor_previsto<0 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.snapshot_regra->>'aplicar_desconto_impostos','true')='false' THEN RETURN NEW; END IF;

  v_fiscal := NEW.snapshot_regra->'fiscal_lote';
  IF v_fiscal IS NOT NULL THEN
    -- A distribuição multicotas altera o valor da linha. Recompõe somente os
    -- metadados proporcionais, sem descontar novamente o líquido já calculado.
    IF COALESCE((NEW.snapshot_regra->>'multicotas_distribuida')::boolean,false)
       AND (TG_OP='INSERT' OR NEW.valor_previsto IS DISTINCT FROM OLD.valor_previsto) THEN
      v_liquido:=round(NEW.valor_previsto,2);
      v_bruto:=round(v_liquido/(1-(v_fiscal->>'imposto_aliquota')::numeric/100),2);
      v_imposto:=v_bruto-v_liquido;
      NEW.snapshot_regra:=NEW.snapshot_regra || jsonb_build_object('fiscal_lote',v_fiscal || jsonb_build_object(
        'valor_bruto',v_bruto,'imposto_valor',v_imposto,'valor_liquido',v_liquido));
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.snapshot_regra->>'reparticao_comercial'<>'aplicada'
     AND COALESCE(NEW.snapshot_regra->>'aplicar_desconto_impostos','')<>'true' THEN
    RETURN NEW;
  END IF;
  SELECT v.data_venda::date INTO v_data_venda
  FROM public.vendas v WHERE v.id=NEW.venda_id AND v.empresa_id=NEW.empresa_id;
  SELECT f.* INTO v_config FROM public.empresa_configuracoes_fiscais f
  WHERE f.empresa_id=NEW.empresa_id AND f.ativo
    AND f.vigencia_inicio<=v_data_venda
    AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=v_data_venda)
  ORDER BY f.vigencia_inicio DESC LIMIT 1;
  IF NOT FOUND OR v_config.percentual_imposto<0 OR v_config.percentual_imposto>=100 THEN RETURN NEW; END IF;

  -- O motor 171 já entrega líquido quando grava modo explícito; o motor base
  -- entrega bruto com reparticao_comercial=aplicada.
  v_ja_liquido := NEW.snapshot_regra->>'modo' IN ('AUTOMATICA','MANUAL')
    AND NEW.snapshot_regra->>'aplicar_desconto_impostos'='true';
  IF v_ja_liquido THEN
    v_liquido:=round(NEW.valor_previsto,2);
    v_bruto:=round(v_liquido/(1-v_config.percentual_imposto/100),2);
    v_imposto:=v_bruto-v_liquido;
  ELSE
    v_bruto:=round(NEW.valor_previsto,2);
    v_imposto:=round(v_bruto*v_config.percentual_imposto/100,2);
    v_liquido:=v_bruto-v_imposto;
    NEW.valor_previsto:=v_liquido;
  END IF;
  NEW.snapshot_regra:=COALESCE(NEW.snapshot_regra,'{}'::jsonb) || jsonb_build_object('fiscal_lote',jsonb_build_object(
    'origem','AUTOMATICA_NA_GERACAO','valor_bruto',v_bruto,
    'imposto_aliquota',v_config.percentual_imposto,'imposto_valor',v_imposto,
    'valor_liquido',v_liquido,'configuracao_id',v_config.id,'aplicado_em',now()));
  RETURN NEW;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR division_by_zero THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS a_comissao_fiscal_franquia_automatico_192 ON public.comissao_previsoes_franquia;
CREATE TRIGGER a_comissao_fiscal_franquia_automatico_192
BEFORE INSERT OR UPDATE OF valor_previsto,snapshot_regra ON public.comissao_previsoes_franquia
FOR EACH ROW EXECUTE FUNCTION public.comissao_fiscal_franquia_automatico_192();

DROP TRIGGER IF EXISTS a_comissao_fiscal_participante_automatico_192 ON public.comissao_previsoes_participantes;
CREATE TRIGGER a_comissao_fiscal_participante_automatico_192
BEFORE INSERT OR UPDATE OF valor_previsto,snapshot_regra ON public.comissao_previsoes_participantes
FOR EACH ROW EXECUTE FUNCTION public.comissao_fiscal_participante_automatico_192();

CREATE OR REPLACE FUNCTION public.comissao_reconciliar_fiscal_pendente_192(
  p_empresa_id uuid,p_configuracao_fiscal_id uuid,p_confirmar boolean,
  p_respeitar_vigencia boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_config public.empresa_configuracoes_fiscais%ROWTYPE;
  v_p record; v_f record;
  v_bruto numeric; v_imposto numeric; v_liquido numeric; v_elegivel numeric;
  v_participantes integer:=0; v_franquia integer:=0; v_detalhes jsonb:='[]'::jsonb;
  v_ja_liquido boolean;
BEGIN
  SELECT * INTO v_config FROM public.empresa_configuracoes_fiscais
  WHERE id=p_configuracao_fiscal_id AND empresa_id=p_empresa_id AND ativo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Configuração fiscal ativa não encontrada nesta empresa'; END IF;
  IF v_config.percentual_imposto<0 OR v_config.percentual_imposto>=100 THEN RAISE EXCEPTION 'Alíquota fiscal inválida'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':FISCAL_INCREMENTAL',0));

  FOR v_p IN SELECT p.*,v.data_venda::date AS data_venda
    FROM public.comissao_previsoes_participantes p
    JOIN public.vendas v ON v.id=p.venda_id AND v.empresa_id=p.empresa_id
    WHERE p.empresa_id=p_empresa_id
      AND p.snapshot_regra->'fiscal_lote' IS NULL
      AND COALESCE(p.snapshot_regra->>'aplicar_desconto_impostos','true')<>'false'
      AND (p.snapshot_regra->>'reparticao_comercial'='aplicada'
        OR p.snapshot_regra->>'aplicar_desconto_impostos'='true')
      AND COALESCE(p.valor_pago,0)=0 AND NOT COALESCE(p.conferido_por_participante,false)
      AND p.status IN ('prevista','elegivel','parcialmente_elegivel')
      AND NOT EXISTS(SELECT 1 FROM public.financeiro_pagamento_itens i WHERE i.previsao_participante_id=p.id)
      AND (NOT p_respeitar_vigencia OR (v_config.vigencia_inicio<=v.data_venda::date
        AND (v_config.vigencia_fim IS NULL OR v_config.vigencia_fim>=v.data_venda::date)))
    ORDER BY p.id FOR UPDATE OF p
  LOOP
    v_ja_liquido:=v_p.snapshot_regra->>'modo' IN ('AUTOMATICA','MANUAL')
      AND v_p.snapshot_regra->>'aplicar_desconto_impostos'='true';
    IF v_ja_liquido THEN
      v_liquido:=round(v_p.valor_previsto,2);
      v_bruto:=round(v_liquido/(1-v_config.percentual_imposto/100),2);
      v_imposto:=v_bruto-v_liquido;
      v_elegivel:=v_p.valor_elegivel;
    ELSE
      v_bruto:=round(v_p.valor_previsto,2);
      v_imposto:=round(v_bruto*v_config.percentual_imposto/100,2);
      v_liquido:=v_bruto-v_imposto;
      v_elegivel:=CASE WHEN COALESCE(v_p.valor_elegivel,0)>0
        THEN LEAST(v_liquido,round(v_p.valor_elegivel*(100-v_config.percentual_imposto)/100,2))
        ELSE 0 END;
    END IF;
    v_participantes:=v_participantes+1;
    IF p_confirmar THEN
      UPDATE public.comissao_previsoes_participantes SET valor_previsto=v_liquido,
        valor_elegivel=v_elegivel,
        snapshot_regra=COALESCE(snapshot_regra,'{}'::jsonb)||jsonb_build_object('fiscal_lote',jsonb_build_object(
          'origem','RECONCILIACAO_INCREMENTAL','valor_bruto',v_bruto,
          'imposto_aliquota',v_config.percentual_imposto,'imposto_valor',v_imposto,
          'valor_liquido',v_liquido,'configuracao_id',v_config.id,'aplicado_em',now())),updated_at=now()
      WHERE id=v_p.id AND empresa_id=p_empresa_id;
      v_detalhes:=v_detalhes||jsonb_build_array(jsonb_build_object('previsao_id',v_p.id,
        'bruto',v_bruto,'imposto',v_imposto,'liquido',v_liquido,'elegivel_anterior',v_p.valor_elegivel,'elegivel_novo',v_elegivel));
    END IF;
  END LOOP;

  FOR v_f IN SELECT f.*,v.data_venda::date AS data_venda
    FROM public.comissao_previsoes_franquia f
    JOIN public.vendas v ON v.id=f.venda_id AND v.empresa_id=f.empresa_id
    WHERE f.empresa_id=p_empresa_id
      AND (f.valor_bruto IS NULL OR f.percentual_imposto IS NULL OR f.valor_imposto IS NULL OR f.valor_liquido IS NULL)
      AND (NOT p_respeitar_vigencia OR (v_config.vigencia_inicio<=v.data_venda::date
        AND (v_config.vigencia_fim IS NULL OR v_config.vigencia_fim>=v.data_venda::date)))
    ORDER BY f.id FOR UPDATE OF f
  LOOP
    v_bruto:=round(v_f.valor_previsto,2); v_imposto:=round(v_bruto*v_config.percentual_imposto/100,2);
    v_liquido:=v_bruto-v_imposto; v_franquia:=v_franquia+1;
    IF p_confirmar THEN
      UPDATE public.comissao_previsoes_franquia SET valor_bruto=v_bruto,
        percentual_imposto=v_config.percentual_imposto,valor_imposto=v_imposto,valor_liquido=v_liquido,
        snapshot_regra=COALESCE(snapshot_regra,'{}'::jsonb)||jsonb_build_object('fiscal_automatico',jsonb_build_object(
          'configuracao_id',v_config.id,'aliquota',v_config.percentual_imposto,
          'valor_bruto',v_bruto,'imposto_valor',v_imposto,'valor_liquido',v_liquido)),updated_at=now()
      WHERE id=v_f.id AND empresa_id=p_empresa_id;
    END IF;
  END LOOP;
  IF p_confirmar AND (v_participantes>0 OR v_franquia>0) THEN
    INSERT INTO public.audit_logs_central(empresa_id,usuario_id,modulo,acao,entidade_tipo,entidade_id,detalhes)
    VALUES(p_empresa_id,public.current_usuario_id(),'comissoes','APLICAR_IMPOSTO_INCREMENTAL',
      'empresa_configuracoes_fiscais',v_config.id,jsonb_build_object('participantes',v_participantes,
      'franquia',v_franquia,'aliquota',v_config.percentual_imposto,'alteracoes',v_detalhes));
  END IF;
  RETURN jsonb_build_object('participantes_sem_imposto',v_participantes,'franquia_sem_imposto',v_franquia);
END;
$$;

ALTER FUNCTION public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean)
  RENAME TO rpc_aplicar_imposto_comissoes_lote_antes_192;
CREATE FUNCTION public.rpc_aplicar_imposto_comissoes_lote(
  p_empresa_id uuid,p_configuracao_fiscal_id uuid,p_confirmar boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_incremental jsonb; v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT COALESCE(public.can_write_tenant_internal(p_empresa_id),false) THEN
    RAISE EXCEPTION 'Somente o administrador da empresa pode aplicar imposto em lote';
  END IF;
  v_incremental:=public.comissao_reconciliar_fiscal_pendente_192(
    p_empresa_id,p_configuracao_fiscal_id,COALESCE(p_confirmar,false),false);
  v_resultado:=public.rpc_aplicar_imposto_comissoes_lote_antes_192(
    p_empresa_id,p_configuracao_fiscal_id,p_confirmar);
  RETURN v_resultado||jsonb_build_object('incremental',v_incremental);
END;
$$;

REVOKE ALL ON FUNCTION public.comissao_fiscal_franquia_automatico_192(),
  public.comissao_fiscal_participante_automatico_192(),
  public.comissao_reconciliar_fiscal_pendente_192(uuid,uuid,boolean,boolean),
  public.rpc_aplicar_imposto_comissoes_lote_antes_192(uuid,uuid,boolean),
  public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean)
FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_imposto_comissoes_lote(uuid,uuid,boolean) TO authenticated;

-- Reconciliação forward-only: somente linhas reconhecidas, não pagas e sem fato
-- fiscal. Configurações não sobrepostas são aplicadas conforme a data da venda.
DO $$DECLARE v_config record; BEGIN
  FOR v_config IN SELECT * FROM public.empresa_configuracoes_fiscais WHERE ativo ORDER BY empresa_id,vigencia_inicio DESC LOOP
    PERFORM public.comissao_reconciliar_fiscal_pendente_192(v_config.empresa_id,v_config.id,true,true);
  END LOOP;
END $$;

COMMIT;
NOTIFY pgrst,'reload schema';

