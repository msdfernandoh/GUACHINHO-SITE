-- Seleção determinística de regras, snapshots congelados e conversão comercial atômica.

BEGIN;

CREATE OR REPLACE FUNCTION public.comissao_validar_cronograma(
  p_base_calculo text,
  p_valor_total numeric,
  p_etapas jsonb
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_count integer;
  v_distinct integer;
  v_sum numeric;
BEGIN
  IF p_etapas IS NULL OR jsonb_typeof(p_etapas) <> 'array' OR jsonb_array_length(p_etapas) = 0 THEN
    RETURN false;
  END IF;

  SELECT count(*), count(DISTINCT (e->>'ordem')::integer)
    INTO v_count, v_distinct
  FROM jsonb_array_elements(p_etapas) AS e
  WHERE (e->>'ordem') ~ '^[0-9]+$'
    AND (e->>'mes_relativo') ~ '^[0-9]+$'
    AND (e->>'ordem')::integer > 0
    AND (e->>'mes_relativo')::integer > 0
    AND length(trim(COALESCE(e->>'nome',''))) > 0;

  IF v_count <> jsonb_array_length(p_etapas) OR v_distinct <> v_count THEN
    RETURN false;
  END IF;

  IF p_base_calculo = 'credito' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_etapas) AS e
      WHERE COALESCE(e->>'percentual_etapa','') !~ '^[0-9]+([.][0-9]+)?$'
        OR (e->>'percentual_etapa')::numeric <= 0
        OR e ? 'valor_etapa'
    ) THEN
      RETURN false;
    END IF;
    SELECT sum((e->>'percentual_etapa')::numeric) INTO v_sum
    FROM jsonb_array_elements(p_etapas) AS e;
    RETURN v_sum = 100;
  END IF;

  IF p_base_calculo = 'valor_fixo' THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_etapas) AS e
      WHERE COALESCE(e->>'valor_etapa','') !~ '^[0-9]+([.][0-9]+)?$'
        OR (e->>'valor_etapa')::numeric <= 0
        OR e ? 'percentual_etapa'
    ) THEN
      RETURN false;
    END IF;
    SELECT sum(round((e->>'valor_etapa')::numeric, 2)) INTO v_sum
    FROM jsonb_array_elements(p_etapas) AS e;
    RETURN v_sum = round(p_valor_total, 2);
  END IF;

  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION public.comissao_regra_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_total numeric;
BEGIN
  NEW.modalidade := NULLIF(lower(trim(COALESCE(NEW.modalidade,''))), '');
  NEW.plano_condicao := NULLIF(lower(trim(COALESCE(NEW.plano_condicao,''))), '');
  NEW.origem_configuracao := upper(trim(NEW.origem_configuracao));

  IF NEW.base_calculo = 'credito' THEN
    v_total := NEW.percentual_total_comissao;
  ELSE
    v_total := NEW.valor_fixo_total;
  END IF;

  IF NOT public.comissao_validar_cronograma(NEW.base_calculo, v_total, NEW.etapas_cronograma) THEN
    RAISE EXCEPTION 'Cronograma de franquia inválido para base %', NEW.base_calculo;
  END IF;

  SELECT p.administradora_id INTO v_admin_id
  FROM public.comissao_programas AS p
  WHERE p.id = NEW.programa_id AND p.empresa_id = NEW.empresa_id;

  IF NEW.configuracao_homologada AND v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Regra homologada exige programa com administradora explícita';
  END IF;

  IF NEW.opcao_cota_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.grupos_cotas AS c
    JOIN public.grupos_consorcio AS g ON g.id = c.grupo_id
    WHERE c.id = NEW.opcao_cota_id
      AND g.administradora_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Opção de cota não pertence à administradora do programa';
  END IF;

  RETURN NEW;
END
$$;

-- A tabela de participantes usa nomes de colunas distintos; função dedicada.
CREATE OR REPLACE FUNCTION public.comissao_regra_participante_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_total numeric;
BEGIN
  NEW.modalidade := NULLIF(lower(trim(COALESCE(NEW.modalidade,''))), '');
  NEW.plano_condicao := NULLIF(lower(trim(COALESCE(NEW.plano_condicao,''))), '');
  NEW.origem_configuracao := upper(trim(NEW.origem_configuracao));
  v_total := CASE WHEN NEW.base_calculo = 'credito' THEN NEW.percentual_comissao ELSE NEW.valor_fixo_total END;

  IF NOT public.comissao_validar_cronograma(NEW.base_calculo, v_total, NEW.etapas_cronograma) THEN
    RAISE EXCEPTION 'Cronograma de participante inválido para base %', NEW.base_calculo;
  END IF;

  SELECT p.administradora_id INTO v_admin_id
  FROM public.comissao_programas AS p
  WHERE p.id = NEW.programa_id AND p.empresa_id = NEW.empresa_id;

  IF NEW.configuracao_homologada AND v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Regra homologada exige programa com administradora explícita';
  END IF;

  IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais AS pc
    WHERE pc.id = NEW.participante_comercial_id AND pc.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Participante da regra pertence a outro tenant';
  END IF;

  IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organizacoes_parceiras AS op
    WHERE op.id = NEW.organizacao_parceira_id AND op.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Organização da regra pertence a outro tenant';
  END IF;

  IF NEW.opcao_cota_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.grupos_cotas AS c
    JOIN public.grupos_consorcio AS g ON g.id = c.grupo_id
    WHERE c.id = NEW.opcao_cota_id AND g.administradora_id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Opção de cota não pertence à administradora do programa';
  END IF;

  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.comissao_regra_versionamento_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_referenciada boolean;
BEGIN
  IF TG_TABLE_NAME = 'comissao_regras_franquia' THEN
    SELECT EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE regra_franquia_id = OLD.id)
      INTO v_referenciada;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.comissao_previsoes_participantes WHERE regra_participante_id = OLD.id)
      INTO v_referenciada;
  END IF;

  IF TG_OP = 'DELETE' AND v_referenciada THEN
    RAISE EXCEPTION 'Regra versionada com histórico não pode ser excluída';
  END IF;

  IF TG_OP = 'UPDATE' AND v_referenciada AND to_jsonb(NEW) - ARRAY['ativa','updated_at']
      IS DISTINCT FROM to_jsonb(OLD) - ARRAY['ativa','updated_at'] THEN
    RAISE EXCEPTION 'Regra utilizada não pode ser recalculada; crie nova versão';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_comissao_regra_franquia_validate ON public.comissao_regras_franquia;
CREATE TRIGGER trg_comissao_regra_franquia_validate
BEFORE INSERT OR UPDATE ON public.comissao_regras_franquia
FOR EACH ROW EXECUTE FUNCTION public.comissao_regra_before_write();

DROP TRIGGER IF EXISTS trg_comissao_regra_participante_validate ON public.comissao_regras_participantes;
CREATE TRIGGER trg_comissao_regra_participante_validate
BEFORE INSERT OR UPDATE ON public.comissao_regras_participantes
FOR EACH ROW EXECUTE FUNCTION public.comissao_regra_participante_before_write();

DROP TRIGGER IF EXISTS trg_comissao_regra_franquia_version_guard ON public.comissao_regras_franquia;
CREATE TRIGGER trg_comissao_regra_franquia_version_guard
BEFORE UPDATE OR DELETE ON public.comissao_regras_franquia
FOR EACH ROW EXECUTE FUNCTION public.comissao_regra_versionamento_guard();

DROP TRIGGER IF EXISTS trg_comissao_regra_participante_version_guard ON public.comissao_regras_participantes;
CREATE TRIGGER trg_comissao_regra_participante_version_guard
BEFORE UPDATE OR DELETE ON public.comissao_regras_participantes
FOR EACH ROW EXECUTE FUNCTION public.comissao_regra_versionamento_guard();

CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao(
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
  v_rf record;
  v_rp record;
  v_etapa record;
  v_hash text;
  v_idem record;
  v_score integer;
  v_conflicts integer;
  v_total numeric(15,2);
  v_valor_etapa numeric(15,2);
  v_sum_etapas numeric(15,2) := 0;
  v_competencia text;
  v_plano text;
  v_benef_part uuid;
  v_benef_org uuid;
  v_franquia jsonb;
  v_participantes jsonb;
  v_response jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) < 8 THEN
    RAISE EXCEPTION 'Idempotency key obrigatória (mínimo 8 caracteres)';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_hash := md5(p_venda_id::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':GERACAO_PREVISOES:' || p_idempotency_key, 0));

  SELECT * INTO v_idem FROM public.operacoes_idempotentes
  WHERE empresa_id = p_empresa_id AND operacao = 'GERACAO_PREVISOES' AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_idem.payload_hash <> v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente'; END IF;
    RETURN v_idem.resposta;
  END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE id = p_venda_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;
  IF v_venda.empresa_id <> p_empresa_id THEN RAISE EXCEPTION 'Venda pertence a outro tenant'; END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id = p_venda_id;
  IF NOT FOUND OR v_cota.empresa_id <> p_empresa_id THEN RAISE EXCEPTION 'Venda sem cota definitiva íntegra'; END IF;
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = v_venda.grupo_id;
  IF NOT FOUND OR v_grupo.administradora_id <> v_venda.administradora_id THEN
    RAISE EXCEPTION 'Grupo/administradora inconsistentes na venda';
  END IF;
  v_plano := NULLIF(lower(trim(COALESCE(v_venda.snapshot_venda->>'plano_condicao', v_venda.snapshot_venda#>>'{dados_simulacao,plano_condicao}', ''))), '');

  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id = p_venda_id) THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.ordem_etapa),'[]'::jsonb) INTO v_franquia
    FROM public.comissao_previsoes_franquia AS f WHERE f.venda_id = p_venda_id;
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.ordem_etapa),'[]'::jsonb) INTO v_participantes
    FROM public.comissao_previsoes_participantes AS p WHERE p.venda_id = p_venda_id;
    v_response := jsonb_build_object('franquia',v_franquia,'participantes',v_participantes,'reused',true);
    INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
    VALUES(p_empresa_id,'GERACAO_PREVISOES',p_idempotency_key,v_hash,p_venda_id,v_response);
    RETURN v_response;
  END IF;

  SELECT r.*, p.nome AS programa_nome, p.administradora_id,
         ((r.opcao_cota_id IS NOT NULL)::integer * 4
          + (r.plano_condicao IS NOT NULL)::integer * 2
          + (r.modalidade IS NOT NULL)::integer) AS specificity
  INTO v_rf
  FROM public.comissao_regras_franquia AS r
  JOIN public.comissao_programas AS p ON p.id = r.programa_id AND p.empresa_id = r.empresa_id
  WHERE r.empresa_id = p_empresa_id AND r.ativa AND r.configuracao_homologada AND p.ativo
    AND p.administradora_id = v_venda.administradora_id
    AND r.vigencia_inicio <= v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    AND (r.modalidade IS NULL OR r.modalidade = lower(trim(v_grupo.modalidade)))
    AND (r.opcao_cota_id IS NULL OR r.opcao_cota_id = v_venda.opcao_cota_id)
    AND (r.plano_condicao IS NULL OR r.plano_condicao = v_plano)
  ORDER BY specificity DESC
  LIMIT 1;
  IF v_rf.id IS NULL THEN RAISE EXCEPTION 'Nenhuma regra de franquia homologada e vigente para a venda'; END IF;
  v_score := v_rf.specificity;

  SELECT count(*) INTO v_conflicts
  FROM public.comissao_regras_franquia AS r
  JOIN public.comissao_programas AS p ON p.id = r.programa_id AND p.empresa_id = r.empresa_id
  WHERE r.empresa_id = p_empresa_id AND r.ativa AND r.configuracao_homologada AND p.ativo
    AND p.administradora_id = v_venda.administradora_id
    AND r.vigencia_inicio <= v_venda.data_venda::date
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
    AND (r.modalidade IS NULL OR r.modalidade = lower(trim(v_grupo.modalidade)))
    AND (r.opcao_cota_id IS NULL OR r.opcao_cota_id = v_venda.opcao_cota_id)
    AND (r.plano_condicao IS NULL OR r.plano_condicao = v_plano)
    AND ((r.opcao_cota_id IS NOT NULL)::integer * 4 + (r.plano_condicao IS NOT NULL)::integer * 2 + (r.modalidade IS NOT NULL)::integer) = v_score;
  IF v_conflicts <> 1 THEN RAISE EXCEPTION 'Regras de franquia ambíguas na mesma precedência/vigência'; END IF;

  v_total := CASE WHEN v_rf.base_calculo = 'credito'
    THEN round(v_venda.valor_credito * v_rf.percentual_total_comissao / 100, 2)
    ELSE round(v_rf.valor_fixo_total, 2) END;
  v_sum_etapas := 0;
  FOR v_etapa IN
    SELECT e AS etapa, row_number() OVER (ORDER BY (e->>'ordem')::integer) AS pos,
           count(*) OVER () AS total_count
    FROM jsonb_array_elements(v_rf.etapas_cronograma) AS e
    ORDER BY (e->>'ordem')::integer
  LOOP
    IF v_rf.base_calculo = 'credito' THEN
      v_valor_etapa := CASE WHEN v_etapa.pos = v_etapa.total_count
        THEN v_total - v_sum_etapas
        ELSE round(v_total * (v_etapa.etapa->>'percentual_etapa')::numeric / 100, 2) END;
    ELSE
      v_valor_etapa := round((v_etapa.etapa->>'valor_etapa')::numeric, 2);
    END IF;
    v_sum_etapas := v_sum_etapas + v_valor_etapa;
    v_competencia := to_char(
      date_trunc('month', v_venda.data_venda) + make_interval(months => (v_etapa.etapa->>'mes_relativo')::integer - 1),
      'YYYY-MM'
    );
    INSERT INTO public.comissao_previsoes_franquia(
      empresa_id,venda_id,cota_definitiva_id,administradora_id,regra_franquia_id,
      ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,
      valor_fixo_aplicado,valor_previsto,status,snapshot_regra
    ) VALUES (
      p_empresa_id,p_venda_id,v_cota.id,v_venda.administradora_id,v_rf.id,
      (v_etapa.etapa->>'ordem')::integer,v_etapa.etapa->>'nome',v_competencia,
      CASE WHEN v_rf.base_calculo='credito' THEN v_venda.valor_credito ELSE v_rf.valor_fixo_total END,
      CASE WHEN v_rf.base_calculo='credito' THEN v_rf.percentual_total_comissao ELSE NULL END,
      CASE WHEN v_rf.base_calculo='valor_fixo' THEN v_rf.valor_fixo_total ELSE NULL END,
      v_valor_etapa,'prevista',
      jsonb_build_object(
        'regra_id',v_rf.id,'programa_id',v_rf.programa_id,'programa_nome',v_rf.programa_nome,
        'versao',v_rf.versao,'base_calculo',v_rf.base_calculo,
        'percentual',v_rf.percentual_total_comissao,'valor_fixo',v_rf.valor_fixo_total,
        'cronograma',v_rf.etapas_cronograma,'etapa',v_etapa.etapa,
        'vigencia_inicio',v_rf.vigencia_inicio,'vigencia_fim',v_rf.vigencia_fim,
        'administradora_id',v_venda.administradora_id,'modalidade',v_grupo.modalidade,
        'opcao_cota_id',v_venda.opcao_cota_id,'plano_condicao',v_plano
      )
    );
  END LOOP;

  IF v_venda.participante_comercial_id IS NOT NULL OR v_venda.organizacao_parceira_id IS NOT NULL THEN
    SELECT r.*, p.nome AS programa_nome, p.administradora_id,
      ((CASE WHEN r.participante_comercial_id IS NOT NULL THEN 3
             WHEN r.organizacao_parceira_id IS NOT NULL THEN 2 ELSE 1 END) * 100
       + (r.opcao_cota_id IS NOT NULL)::integer * 4
       + (r.plano_condicao IS NOT NULL)::integer * 2
       + (r.modalidade IS NOT NULL)::integer) AS precedence_score
    INTO v_rp
    FROM public.comissao_regras_participantes AS r
    JOIN public.comissao_programas AS p ON p.id=r.programa_id AND p.empresa_id=r.empresa_id
    WHERE r.empresa_id=p_empresa_id AND r.ativa AND r.configuracao_homologada AND p.ativo
      AND p.administradora_id=v_venda.administradora_id
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
      AND (r.participante_comercial_id IS NULL OR r.participante_comercial_id=v_venda.participante_comercial_id)
      AND (r.organizacao_parceira_id IS NULL OR r.organizacao_parceira_id=v_venda.organizacao_parceira_id)
      AND (r.modalidade IS NULL OR r.modalidade=lower(trim(v_grupo.modalidade)))
      AND (r.opcao_cota_id IS NULL OR r.opcao_cota_id=v_venda.opcao_cota_id)
      AND (r.plano_condicao IS NULL OR r.plano_condicao=v_plano)
    ORDER BY precedence_score DESC LIMIT 1;
    IF v_rp.id IS NULL THEN RAISE EXCEPTION 'Nenhuma regra de participante/parceiro homologada e vigente para a venda'; END IF;
    v_score := v_rp.precedence_score;

    SELECT count(*) INTO v_conflicts
    FROM public.comissao_regras_participantes AS r
    JOIN public.comissao_programas AS p ON p.id=r.programa_id AND p.empresa_id=r.empresa_id
    WHERE r.empresa_id=p_empresa_id AND r.ativa AND r.configuracao_homologada AND p.ativo
      AND p.administradora_id=v_venda.administradora_id
      AND r.vigencia_inicio <= v_venda.data_venda::date
      AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= v_venda.data_venda::date)
      AND (r.participante_comercial_id IS NULL OR r.participante_comercial_id=v_venda.participante_comercial_id)
      AND (r.organizacao_parceira_id IS NULL OR r.organizacao_parceira_id=v_venda.organizacao_parceira_id)
      AND (r.modalidade IS NULL OR r.modalidade=lower(trim(v_grupo.modalidade)))
      AND (r.opcao_cota_id IS NULL OR r.opcao_cota_id=v_venda.opcao_cota_id)
      AND (r.plano_condicao IS NULL OR r.plano_condicao=v_plano)
      AND ((CASE WHEN r.participante_comercial_id IS NOT NULL THEN 3 WHEN r.organizacao_parceira_id IS NOT NULL THEN 2 ELSE 1 END)*100
          +(r.opcao_cota_id IS NOT NULL)::integer*4+(r.plano_condicao IS NOT NULL)::integer*2+(r.modalidade IS NOT NULL)::integer)=v_score;
    IF v_conflicts <> 1 THEN RAISE EXCEPTION 'Regras de participante/parceiro ambíguas na mesma precedência/vigência'; END IF;

    IF v_rp.participante_comercial_id IS NOT NULL THEN
      v_benef_part := v_venda.participante_comercial_id; v_benef_org := NULL;
    ELSIF v_rp.organizacao_parceira_id IS NOT NULL THEN
      v_benef_part := NULL; v_benef_org := v_venda.organizacao_parceira_id;
    ELSIF v_venda.participante_comercial_id IS NOT NULL THEN
      v_benef_part := v_venda.participante_comercial_id; v_benef_org := NULL;
    ELSE
      v_benef_part := NULL; v_benef_org := v_venda.organizacao_parceira_id;
    END IF;

    v_total := CASE WHEN v_rp.base_calculo='credito'
      THEN round(v_venda.valor_credito*v_rp.percentual_comissao/100,2)
      ELSE round(v_rp.valor_fixo_total,2) END;
    v_sum_etapas := 0;
    FOR v_etapa IN
      SELECT e AS etapa,row_number() OVER(ORDER BY (e->>'ordem')::integer) AS pos,count(*) OVER() AS total_count
      FROM jsonb_array_elements(v_rp.etapas_cronograma) AS e ORDER BY (e->>'ordem')::integer
    LOOP
      IF v_rp.base_calculo='credito' THEN
        v_valor_etapa := CASE WHEN v_etapa.pos=v_etapa.total_count THEN v_total-v_sum_etapas
          ELSE round(v_total*(v_etapa.etapa->>'percentual_etapa')::numeric/100,2) END;
      ELSE
        v_valor_etapa := round((v_etapa.etapa->>'valor_etapa')::numeric,2);
      END IF;
      v_sum_etapas := v_sum_etapas+v_valor_etapa;
      v_competencia := to_char(date_trunc('month',v_venda.data_venda)+make_interval(months=>(v_etapa.etapa->>'mes_relativo')::integer-1),'YYYY-MM');
      IF NOT EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia f WHERE f.venda_id=p_venda_id AND f.ordem_etapa=(v_etapa.etapa->>'ordem')::integer AND f.competencia=v_competencia) THEN
        RAISE EXCEPTION 'Cronograma do beneficiário sem etapa correspondente da franquia (ordem %, competência %)',v_etapa.etapa->>'ordem',v_competencia;
      END IF;
      INSERT INTO public.comissao_previsoes_participantes(
        empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,organizacao_parceira_id,
        regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,
        percentual_aplicado,valor_fixo_aplicado,valor_previsto,status,snapshot_regra
      ) VALUES (
        p_empresa_id,p_venda_id,v_cota.id,v_benef_part,v_benef_org,v_rp.id,
        (v_etapa.etapa->>'ordem')::integer,v_etapa.etapa->>'nome',v_competencia,
        CASE WHEN v_rp.base_calculo='credito' THEN v_venda.valor_credito ELSE v_rp.valor_fixo_total END,
        CASE WHEN v_rp.base_calculo='credito' THEN v_rp.percentual_comissao ELSE NULL END,
        CASE WHEN v_rp.base_calculo='valor_fixo' THEN v_rp.valor_fixo_total ELSE NULL END,
        v_valor_etapa,'prevista',
        jsonb_build_object(
          'regra_id',v_rp.id,'programa_id',v_rp.programa_id,'programa_nome',v_rp.programa_nome,
          'versao',v_rp.versao,'precedencia',CASE WHEN v_rp.participante_comercial_id IS NOT NULL THEN 'participante' WHEN v_rp.organizacao_parceira_id IS NOT NULL THEN 'organizacao' ELSE 'generica' END,
          'base_calculo',v_rp.base_calculo,'percentual',v_rp.percentual_comissao,'valor_fixo',v_rp.valor_fixo_total,
          'cronograma',v_rp.etapas_cronograma,'etapa',v_etapa.etapa,
          'vigencia_inicio',v_rp.vigencia_inicio,'vigencia_fim',v_rp.vigencia_fim,
          'administradora_id',v_venda.administradora_id,'modalidade',v_grupo.modalidade,
          'opcao_cota_id',v_venda.opcao_cota_id,'plano_condicao',v_plano,
          'beneficiario_participante_id',v_benef_part,'beneficiario_organizacao_id',v_benef_org
        )
      );
    END LOOP;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.ordem_etapa),'[]'::jsonb) INTO v_franquia
  FROM public.comissao_previsoes_franquia AS f WHERE f.venda_id=p_venda_id;
  SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.ordem_etapa),'[]'::jsonb) INTO v_participantes
  FROM public.comissao_previsoes_participantes AS p WHERE p.venda_id=p_venda_id;
  v_response := jsonb_build_object('franquia',v_franquia,'participantes',v_participantes,'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'GERACAO_PREVISOES',p_idempotency_key,v_hash,p_venda_id,v_response);
  RETURN v_response;
END
$$;

CREATE OR REPLACE FUNCTION public.rpc_converter_contratacao_venda(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_idempotency_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_contratacao public.contratacoes_online%ROWTYPE;
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_opcao public.grupos_cotas%ROWTYPE;
  v_venda public.vendas%ROWTYPE;
  v_cota public.cotas_definitivas%ROWTYPE;
  v_idem record;
  v_hash text;
  v_dados jsonb;
  v_opcao_text text;
  v_opcao_id uuid;
  v_credito numeric(15,2);
  v_parcela numeric(15,2);
  v_prazo integer;
  v_snapshot jsonb;
  v_previsoes jsonb;
  v_response jsonb;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  v_hash:=md5(p_contratacao_id::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CONVERSAO_VENDA:'||p_idempotency_key,0));
  SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='CONVERSAO_VENDA' AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente'; END IF;
    RETURN v_idem.resposta;
  END IF;

  SELECT * INTO v_contratacao FROM public.contratacoes_online WHERE id=p_contratacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada'; END IF;
  IF v_contratacao.empresa_id IS NULL OR v_contratacao.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Contratação pertence a outro tenant'; END IF;

  SELECT * INTO v_venda FROM public.vendas WHERE empresa_id=p_empresa_id AND contratacao_id=p_contratacao_id;
  IF FOUND THEN
    SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id=v_venda.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venda existente sem cota definitiva íntegra'; END IF;
    SELECT public.rpc_gerar_previsoes_comissao(p_empresa_id,v_venda.id,p_idempotency_key||':comissao') INTO v_previsoes;
    v_response:=jsonb_build_object('venda',to_jsonb(v_venda),'cotaDefinitiva',to_jsonb(v_cota),'previsoes',v_previsoes,'reused',true);
    INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
    VALUES(p_empresa_id,'CONVERSAO_VENDA',p_idempotency_key,v_hash,v_venda.id,v_response);
    RETURN v_response;
  END IF;

  v_dados:=COALESCE(v_contratacao.dados_simulacao,'{}'::jsonb);
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=v_contratacao.grupo_id;
  IF NOT FOUND OR v_grupo.administradora_id IS NULL THEN RAISE EXCEPTION 'Grupo/administradora inválidos na contratação'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresa_administradoras ea JOIN public.administradoras a ON a.id=ea.administradora_id WHERE ea.empresa_id=p_empresa_id AND ea.administradora_id=v_grupo.administradora_id AND ea.status='ATIVA' AND a.status='ATIVA') THEN
    RAISE EXCEPTION 'Empresa sem concessão ativa para a administradora do grupo';
  END IF;

  v_opcao_text:=NULLIF(COALESCE(v_contratacao.cota_id,v_dados->>'cotaId',v_dados->>'opcao_cota_id'), '');
  IF v_opcao_text IS NOT NULL THEN
    IF v_opcao_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Opção de cota inválida'; END IF;
    v_opcao_id:=v_opcao_text::uuid;
    SELECT * INTO v_opcao FROM public.grupos_cotas WHERE id=v_opcao_id AND grupo_id=v_grupo.id AND ativo AND status NOT IN ('Inativo','Esgotado');
    IF NOT FOUND THEN RAISE EXCEPTION 'Opção de cota não pertence ao grupo ou está inativa'; END IF;
  END IF;

  v_credito:=COALESCE(v_contratacao.credito_selecionado,NULLIF(v_dados->>'valor_credito','')::numeric,v_opcao.valor_credito);
  v_parcela:=COALESCE(v_contratacao.parcela_estimada,NULLIF(v_dados->>'valor_parcela','')::numeric,v_opcao.valor_parcela);
  v_prazo:=COALESCE(v_contratacao.prazo,NULLIF(v_dados->>'prazo','')::integer,v_grupo.prazo_total);
  IF v_credito IS NULL OR v_credito<=0 OR v_parcela IS NULL OR v_parcela<=0 OR v_prazo IS NULL OR v_prazo<=0 THEN RAISE EXCEPTION 'Dados monetários/prazo inválidos na contratação'; END IF;

  v_snapshot:=jsonb_build_object(
    'dados_simulacao',v_dados,'grupo_codigo',v_grupo.codigo_grupo,'administradora_id',v_grupo.administradora_id,
    'modalidade',v_grupo.modalidade,'opcao_cota_id',v_opcao_id,
    'plano_condicao',COALESCE(v_dados->>'plano_condicao',v_dados->>'plano'),'data_conversao',now()
  );
  INSERT INTO public.vendas(
    empresa_id,lead_id,contratacao_id,cliente_nome,cliente_cpf_cnpj,cliente_email,cliente_telefone,
    administradora_id,grupo_id,opcao_cota_id,participante_comercial_id,organizacao_parceira_id,
    valor_credito,prazo,parcela,status,snapshot_venda
  ) VALUES (
    p_empresa_id,v_contratacao.lead_id,p_contratacao_id,COALESCE(NULLIF(trim(v_contratacao.nome),''),'Cliente Consórcio'),
    COALESCE(v_contratacao.cpf,v_contratacao.cnpj),v_contratacao.email,v_contratacao.telefone,
    v_grupo.administradora_id,v_grupo.id,v_opcao_id,v_contratacao.participante_comercial_id,v_contratacao.organizacao_parceira_id,
    v_credito,v_prazo,v_parcela,'confirmada',v_snapshot
  ) RETURNING * INTO v_venda;
  INSERT INTO public.cotas_definitivas(
    empresa_id,venda_id,administradora_id,grupo_id,numero_grupo,numero_cota,valor_credito,prazo,parcela,
    status,participante_comercial_id,organizacao_parceira_id,snapshot_cota
  ) VALUES (
    p_empresa_id,v_venda.id,v_grupo.administradora_id,v_grupo.id,v_grupo.codigo_grupo,NULLIF(v_dados->>'numero_cota',''),
    v_credito,v_prazo,v_parcela,'ativa',v_contratacao.participante_comercial_id,v_contratacao.organizacao_parceira_id,v_snapshot
  ) RETURNING * INTO v_cota;
  UPDATE public.contratacoes_online SET status='finalizada',finalizado_em=COALESCE(finalizado_em,now()),updated_at=now() WHERE id=p_contratacao_id;
  IF v_contratacao.lead_id IS NOT NULL THEN UPDATE public.leads SET status='convertido',updated_at=now() WHERE id=v_contratacao.lead_id AND empresa_id=p_empresa_id; END IF;

  SELECT public.rpc_gerar_previsoes_comissao(p_empresa_id,v_venda.id,p_idempotency_key||':comissao') INTO v_previsoes;
  v_response:=jsonb_build_object('venda',to_jsonb(v_venda),'cotaDefinitiva',to_jsonb(v_cota),'previsoes',v_previsoes,'reused',false);
  INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)
  VALUES(p_empresa_id,'CONVERSAO_VENDA',p_idempotency_key,v_hash,v_venda.id,v_response);
  RETURN v_response;
END
$$;

REVOKE ALL ON FUNCTION public.comissao_validar_cronograma(text,numeric,jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comissao_regra_before_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comissao_regra_participante_before_write() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.comissao_regra_versionamento_guard() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) TO authenticated, service_role;

COMMIT;
