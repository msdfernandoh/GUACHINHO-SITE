-- 179: Programa de Indicacao publico, rastreio venda e participante tenant-aware.
-- Forward-only: preserva leads/vendas historicos e nao cria regra comercial implicita.
BEGIN;

CREATE TABLE public.programa_indicadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  participante_id uuid NOT NULL REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT,
  cpf text NOT NULL CHECK (cpf ~ '^[0-9]{11}$'),
  telefone text NOT NULL CHECK (telefone ~ '^[0-9]{10,13}$'),
  chave_pix text NOT NULL CHECK (char_length(trim(chave_pix)) BETWEEN 3 AND 140),
  empresa_trabalho text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, cpf),
  UNIQUE (empresa_id, telefone),
  UNIQUE (empresa_id, participante_id)
);

CREATE TABLE public.programa_indicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  indicador_id uuid REFERENCES public.programa_indicadores(id) ON DELETE RESTRICT,
  indicador_nome_snapshot text NOT NULL CHECK (char_length(trim(indicador_nome_snapshot)) > 0),
  indicador_telefone_snapshot text NOT NULL CHECK (indicador_telefone_snapshot ~ '^[0-9]{10,13}$'),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  venda_id uuid REFERENCES public.vendas(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'PENDENTE' CHECK (status IN (
    'PENDENTE','VENDA_REALIZADA','COMISSAO_PREVISTA','DISPONIVEL_PAGAMENTO','PAGA','CANCELADA'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, lead_id),
  UNIQUE (empresa_id, venda_id)
);

CREATE INDEX programa_indicadores_empresa_ativo_idx ON public.programa_indicadores(empresa_id, ativo);
CREATE INDEX programa_indicacoes_indicador_created_idx ON public.programa_indicacoes(empresa_id, indicador_id, created_at DESC);

-- Disponibiliza o mesmo menu nos modelos oficiais Gauchinho e Racon já publicados.
UPDATE public.site_modelos sm SET catalogo_menus = COALESCE(sm.catalogo_menus,'[]'::jsonb) ||
  jsonb_build_array(jsonb_build_object('id','programa_indicacao','label','Programa de Indicação','rota','/indicar','ativo_padrao',true,'ativo',true))
WHERE sm.codigo IN ('gauchinho_default','racon_inspired')
  AND NOT COALESCE(sm.catalogo_menus,'[]'::jsonb) @> '[{"id":"programa_indicacao"}]'::jsonb;
UPDATE public.empresa_site_modelos esm SET menus_habilitados = COALESCE(esm.menus_habilitados,'[]'::jsonb) || '"programa_indicacao"'::jsonb
FROM public.site_modelos sm WHERE sm.id=esm.modelo_id AND sm.codigo IN ('gauchinho_default','racon_inspired')
  AND NOT COALESCE(esm.menus_habilitados,'[]'::jsonb) @> '["programa_indicacao"]'::jsonb;

ALTER TABLE public.programa_indicadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programa_indicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY programa_indicadores_interno_select ON public.programa_indicadores FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY programa_indicadores_interno_write ON public.programa_indicadores FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY programa_indicacoes_interno_select ON public.programa_indicacoes FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY programa_indicacoes_interno_write ON public.programa_indicacoes FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id));

CREATE OR REPLACE FUNCTION public.programa_indicadores_validar_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.participantes_comerciais p WHERE p.id=NEW.participante_id AND p.empresa_id=NEW.empresa_id) THEN
    RAISE EXCEPTION 'Participante indicador nao pertence a empresa';
  END IF;
  NEW.cpf := regexp_replace(NEW.cpf,'[^0-9]','','g');
  NEW.telefone := regexp_replace(NEW.telefone,'[^0-9]','','g');
  NEW.chave_pix := trim(NEW.chave_pix);
  NEW.empresa_trabalho := nullif(trim(coalesce(NEW.empresa_trabalho,'')),'');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER programa_indicadores_validar BEFORE INSERT OR UPDATE ON public.programa_indicadores
FOR EACH ROW EXECUTE FUNCTION public.programa_indicadores_validar_tenant();

CREATE OR REPLACE FUNCTION public.programa_indicacoes_validar_tenant()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.leads l WHERE l.id=NEW.lead_id AND l.empresa_id=NEW.empresa_id) THEN
    RAISE EXCEPTION 'Lead indicado nao pertence a empresa';
  END IF;
  IF NEW.indicador_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.programa_indicadores i WHERE i.id=NEW.indicador_id AND i.empresa_id=NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Indicador nao pertence a empresa'; END IF;
  IF NEW.venda_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendas v WHERE v.id=NEW.venda_id AND v.empresa_id=NEW.empresa_id AND v.lead_id=NEW.lead_id
  ) THEN RAISE EXCEPTION 'Venda nao corresponde ao lead indicado'; END IF;
  NEW.indicador_telefone_snapshot := regexp_replace(NEW.indicador_telefone_snapshot,'[^0-9]','','g');
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER programa_indicacoes_validar BEFORE INSERT OR UPDATE ON public.programa_indicacoes
FOR EACH ROW EXECUTE FUNCTION public.programa_indicacoes_validar_tenant();

-- A venda e ligada pela FK canonica vendas.lead_id; nenhum casamento por texto.
CREATE OR REPLACE FUNCTION public.programa_indicacao_venda_vincular()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_indicacao public.programa_indicacoes%rowtype; v_participante uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_indicacao FROM public.programa_indicacoes
   WHERE empresa_id=NEW.empresa_id AND lead_id=NEW.lead_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE public.programa_indicacoes SET venda_id=NEW.id,status='VENDA_REALIZADA',updated_at=now() WHERE id=v_indicacao.id;
  IF v_indicacao.indicador_id IS NOT NULL THEN
    SELECT participante_id INTO v_participante FROM public.programa_indicadores WHERE id=v_indicacao.indicador_id AND ativo;
    IF v_participante IS NOT NULL THEN
      INSERT INTO public.venda_participantes(empresa_id,venda_id,participante_comercial_id,papel,tipo_atuacao)
      VALUES(NEW.empresa_id,NEW.id,v_participante,'PARTICIPANTE_SECUNDARIO','INDICADOR')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER programa_indicacao_venda_vincular AFTER INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.programa_indicacao_venda_vincular();

-- O estado publico deriva dos fatos de venda e comissao, sem permitir escrita publica de status.
CREATE OR REPLACE FUNCTION public.programa_indicacao_sincronizar_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_venda uuid; v_status text;
BEGIN
  v_venda := NEW.venda_id;
  IF v_venda IS NULL THEN RETURN NEW; END IF;
  SELECT CASE
    WHEN bool_or(p.status='cancelada') AND NOT bool_or(COALESCE(p.valor_pago,0)>0) THEN 'CANCELADA'
    WHEN bool_or(COALESCE(p.valor_pago,0)>=p.valor_previsto AND p.valor_previsto>0) THEN 'PAGA'
    WHEN bool_or(COALESCE(p.valor_elegivel,0)>COALESCE(p.valor_pago,0)) THEN 'DISPONIVEL_PAGAMENTO'
    ELSE 'COMISSAO_PREVISTA' END INTO v_status
  FROM public.comissao_previsoes_participantes p
  JOIN public.programa_indicacoes i ON i.venda_id=p.venda_id AND i.empresa_id=p.empresa_id
  JOIN public.programa_indicadores g ON g.id=i.indicador_id AND g.participante_id=p.participante_comercial_id
  WHERE p.venda_id=v_venda GROUP BY p.venda_id;
  IF v_status IS NOT NULL THEN UPDATE public.programa_indicacoes SET status=v_status,updated_at=now() WHERE venda_id=v_venda; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER programa_indicacao_status_comissao AFTER INSERT OR UPDATE OF status,valor_elegivel,valor_pago ON public.comissao_previsoes_participantes
FOR EACH ROW EXECUTE FUNCTION public.programa_indicacao_sincronizar_status();

CREATE OR REPLACE FUNCTION public.programa_indicacao_cancelar_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF lower(coalesce(NEW.status,'')) IN ('cancelada','cancelado') THEN
    UPDATE public.programa_indicacoes SET status='CANCELADA',updated_at=now()
    WHERE empresa_id=NEW.empresa_id AND venda_id=NEW.id AND status<>'PAGA';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER programa_indicacao_cancelar_venda AFTER UPDATE OF status ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.programa_indicacao_cancelar_venda();

-- Extensao do motor: gera a previsao do indicador somente quando houver perfil
-- INDICADOR vinculado e regra homologada do mesmo programa da franqueadora.
CREATE OR REPLACE FUNCTION public.comissao_gerar_indicador_176(p_empresa_id uuid,p_venda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_participante uuid; v_perfil uuid; v_programa uuid; v_regra record; v_venda record;
  v_fonte record; v_item jsonb; v_total numeric; v_valor numeric; v_soma numeric:=0;
  v_count integer; v_idx integer:=0; v_comp text; v_base numeric; v_imposto numeric:=0;
BEGIN
  SELECT g.participante_id INTO v_participante
  FROM public.programa_indicacoes i JOIN public.programa_indicadores g ON g.id=i.indicador_id AND g.ativo
  WHERE i.empresa_id=p_empresa_id AND i.venda_id=p_venda_id;
  IF v_participante IS NULL THEN RETURN; END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id=p_venda_id AND empresa_id=p_empresa_id;
  SELECT pc.perfil_id INTO v_perfil FROM public.participante_comissao_perfis pc
  JOIN public.comissao_perfis cp ON cp.id=pc.perfil_id AND cp.empresa_id=pc.empresa_id
  WHERE pc.empresa_id=p_empresa_id AND pc.participante_id=v_participante AND pc.ativo
    AND pc.papel_tipo='INDICADOR' AND cp.papel_base='INDICADOR' AND cp.ativo
  ORDER BY pc.vigencia_inicio DESC LIMIT 1;
  IF v_perfil IS NULL THEN RETURN; END IF;
  SELECT rf.programa_id INTO v_programa FROM public.comissao_previsoes_franquia f
  JOIN public.comissao_regras_franquia rf ON rf.id=f.regra_franquia_id
  WHERE f.empresa_id=p_empresa_id AND f.venda_id=p_venda_id ORDER BY f.ordem_etapa LIMIT 1;
  IF v_programa IS NULL THEN RETURN; END IF;
  SELECT r.* INTO v_regra FROM public.comissao_regras_participantes r
  WHERE r.empresa_id=p_empresa_id AND r.perfil_id=v_perfil AND r.programa_id=v_programa
    AND r.ativa AND r.configuracao_homologada AND r.status='HOMOLOGADA'
    AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date)
  ORDER BY r.versao DESC LIMIT 1;
  IF v_regra.id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_count FROM public.comissao_regras_participantes r
  WHERE r.empresa_id=p_empresa_id AND r.perfil_id=v_perfil AND r.programa_id=v_programa
    AND r.ativa AND r.configuracao_homologada AND r.status='HOMOLOGADA'
    AND r.versao=v_regra.versao AND r.vigencia_inicio<=v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date);
  IF v_count<>1 THEN RAISE EXCEPTION 'Regra de indicador ausente ou ambigua'; END IF;
  SELECT COALESCE(sum(COALESCE(f.valor_bruto,f.valor_previsto)),0),COALESCE(max(f.percentual_imposto),0)
    INTO v_base,v_imposto FROM public.comissao_previsoes_franquia f WHERE f.empresa_id=p_empresa_id AND f.venda_id=p_venda_id;
  IF v_regra.base_v2='VALOR_VENDIDO' THEN v_base:=v_venda.valor_credito; END IF;
  v_total:=CASE WHEN v_regra.base_v2='VALOR_FIXO' THEN v_regra.valor_fixo_total
    ELSE round(v_base*v_regra.percentual_comissao/100,2) END;
  IF v_regra.aplicar_desconto_impostos THEN v_total:=round(v_total*(100-v_imposto)/100,2); END IF;
  IF v_total IS NULL OR v_total<=0 THEN RAISE EXCEPTION 'Valor da regra de indicador invalido'; END IF;
  IF v_regra.seguir_cronograma_franquia THEN
    SELECT count(*) INTO v_count FROM public.comissao_previsoes_franquia WHERE empresa_id=p_empresa_id AND venda_id=p_venda_id;
    FOR v_fonte IN SELECT * FROM public.comissao_previsoes_franquia WHERE empresa_id=p_empresa_id AND venda_id=p_venda_id ORDER BY ordem_etapa LOOP
      v_idx:=v_idx+1; v_valor:=CASE WHEN v_idx=v_count THEN v_total-v_soma ELSE round(v_total*COALESCE(v_fonte.valor_bruto,v_fonte.valor_previsto)/NULLIF(v_base,0),2) END; v_soma:=v_soma+v_valor;
      INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,papel_tipo,previsao_franquia_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
      VALUES(p_empresa_id,p_venda_id,v_fonte.cota_definitiva_id,v_participante,'INDICADOR',v_fonte.id,v_regra.id,v_fonte.ordem_etapa,v_fonte.nome_etapa,v_fonte.competencia,v_base,COALESCE(v_regra.percentual_comissao,0),v_valor,'prevista',jsonb_build_object('origem','PROGRAMA_INDICACAO','perfil_id',v_perfil,'regra_id',v_regra.id),'MES_RELATIVO');
    END LOOP;
  ELSE
    v_count:=jsonb_array_length(v_regra.etapas_cronograma);
    FOR v_item IN SELECT value FROM jsonb_array_elements(v_regra.etapas_cronograma) ORDER BY (value->>'ordem')::integer LOOP
      v_idx:=v_idx+1; v_valor:=CASE WHEN v_idx=v_count THEN v_total-v_soma WHEN v_regra.base_v2='VALOR_FIXO' THEN (v_item->>'valor_etapa')::numeric ELSE round(v_total*(v_item->>'percentual_etapa')::numeric/100,2) END; v_soma:=v_soma+v_valor;
      v_comp:=to_char(date_trunc('month',COALESCE(v_venda.data_primeira_parcela,v_venda.data_venda::date))+make_interval(months=>(v_item->>'mes_relativo')::integer-1),'YYYY-MM');
      SELECT * INTO v_fonte FROM public.comissao_previsoes_franquia WHERE empresa_id=p_empresa_id AND venda_id=p_venda_id ORDER BY ordem_etapa LIMIT 1;
      INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,papel_tipo,previsao_franquia_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
      VALUES(p_empresa_id,p_venda_id,v_fonte.cota_definitiva_id,v_participante,'INDICADOR',v_fonte.id,v_regra.id,v_idx,COALESCE(v_item->>'nome','Parcela '||v_idx),v_comp,v_base,COALESCE(v_regra.percentual_comissao,0),v_valor,'prevista',jsonb_build_object('origem','PROGRAMA_INDICACAO','perfil_id',v_perfil,'regra_id',v_regra.id),'MES_RELATIVO');
    END LOOP;
  END IF;
END $$;

ALTER FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) RENAME TO rpc_gerar_previsoes_comissao_v2_antes_176;
CREATE FUNCTION public.rpc_gerar_previsoes_comissao_v2(p_empresa_id uuid,p_venda_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_result jsonb;
BEGIN
  v_result:=public.rpc_gerar_previsoes_comissao_v2_antes_176(p_empresa_id,p_venda_id,p_idempotency_key);
  PERFORM public.comissao_gerar_indicador_176(p_empresa_id,p_venda_id);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) TO authenticated,service_role;

REVOKE ALL ON public.programa_indicadores, public.programa_indicacoes FROM PUBLIC, anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.programa_indicadores, public.programa_indicacoes TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.programa_indicadores_validar_tenant(), public.programa_indicacoes_validar_tenant(), public.programa_indicacao_venda_vincular(), public.programa_indicacao_sincronizar_status(), public.programa_indicacao_cancelar_venda(), public.comissao_gerar_indicador_176(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
