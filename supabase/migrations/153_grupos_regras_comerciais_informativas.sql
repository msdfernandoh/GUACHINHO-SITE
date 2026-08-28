-- 153 — Regras comerciais informativas dos grupos.
-- Reutiliza grupos_modalidades_lance e mantém grupos legados sem alteração.
BEGIN;

ALTER TABLE public.grupos_modalidades_lance
  ADD COLUMN IF NOT EXISTS base_referencia text NOT NULL DEFAULT 'SALDO_DEVEDOR';

ALTER TABLE public.grupos_modalidades_lance
  DROP CONSTRAINT IF EXISTS grupos_modalidades_lance_base_referencia_check;
ALTER TABLE public.grupos_modalidades_lance
  ADD CONSTRAINT grupos_modalidades_lance_base_referencia_check
  CHECK (base_referencia IN ('SALDO_DEVEDOR', 'CREDITO'));

ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS regra_integralizacao_parcela_reduzida text,
  ADD COLUMN IF NOT EXISTS assembleia_limite_parcela_reduzida integer;

CREATE OR REPLACE FUNCTION public.trg_grupos_exigir_primeira_assembleia_novos()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NEW.data_primeira_assembleia IS NULL THEN
    RAISE EXCEPTION 'Data da primeira assembleia é obrigatória para novos grupos';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grupos_exigir_primeira_assembleia_novos ON public.grupos_consorcio;
CREATE TRIGGER grupos_exigir_primeira_assembleia_novos
  BEFORE INSERT ON public.grupos_consorcio
  FOR EACH ROW EXECUTE FUNCTION public.trg_grupos_exigir_primeira_assembleia_novos();

ALTER TABLE public.grupos_consorcio
  DROP CONSTRAINT IF EXISTS grupos_consorcio_regra_integralizacao_check;
ALTER TABLE public.grupos_consorcio
  ADD CONSTRAINT grupos_consorcio_regra_integralizacao_check
  CHECK (
    regra_integralizacao_parcela_reduzida IS NULL
    OR regra_integralizacao_parcela_reduzida IN ('CONTEMPLACAO', 'ASSEMBLEIA')
  );

ALTER TABLE public.grupos_consorcio
  DROP CONSTRAINT IF EXISTS grupos_consorcio_assembleia_limite_check;
ALTER TABLE public.grupos_consorcio
  ADD CONSTRAINT grupos_consorcio_assembleia_limite_check
  CHECK (
    (regra_integralizacao_parcela_reduzida IS NULL AND assembleia_limite_parcela_reduzida IS NULL)
    OR (regra_integralizacao_parcela_reduzida = 'CONTEMPLACAO' AND assembleia_limite_parcela_reduzida IS NULL)
    OR (regra_integralizacao_parcela_reduzida = 'ASSEMBLEIA' AND assembleia_limite_parcela_reduzida >= 1)
  );

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_lances_embutidos_grupo(
  p_grupo_id uuid,
  p_lances jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_item jsonb;
  v_ordem integer := 0;
  v_total integer := 0;
  v_percentual numeric;
  v_recurso_minimo numeric;
  v_primeiro_percentual numeric := NULL;
  v_nome text;
  v_base text;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode alterar os lances do grupo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.grupos_consorcio WHERE id = p_grupo_id) THEN
    RAISE EXCEPTION 'Grupo não encontrado';
  END IF;
  IF p_lances IS NULL OR jsonb_typeof(p_lances) <> 'array' THEN
    RAISE EXCEPTION 'A lista de lances deve ser um array';
  END IF;

  DELETE FROM public.grupos_modalidades_lance WHERE grupo_id = p_grupo_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lances)
  LOOP
    v_nome := nullif(trim(v_item->>'nome'), '');
    v_percentual := nullif(replace(v_item->>'percentual_lance_embutido', ',', '.'), '')::numeric;
    v_recurso_minimo := coalesce(nullif(replace(v_item->>'percentual_recurso_proprio_minimo', ',', '.'), '')::numeric, 0);
    v_base := upper(coalesce(nullif(trim(v_item->>'base_referencia'), ''), 'SALDO_DEVEDOR'));
    IF v_nome IS NULL THEN RAISE EXCEPTION 'Informe o nome de todos os tipos de lance'; END IF;
    IF v_percentual IS NULL OR v_percentual < 0 OR v_percentual > 100 THEN
      RAISE EXCEPTION 'Percentual embutido inválido para o lance %', v_nome;
    END IF;
    IF v_recurso_minimo < 0 OR v_recurso_minimo > 100 THEN
      RAISE EXCEPTION 'Recurso próprio mínimo inválido para o lance %', v_nome;
    END IF;
    IF v_percentual + v_recurso_minimo > 100 THEN
      RAISE EXCEPTION 'A composição mínima do lance % não pode ultrapassar 100%%', v_nome;
    END IF;
    IF v_base NOT IN ('SALDO_DEVEDOR', 'CREDITO') THEN
      RAISE EXCEPTION 'Base de referência inválida para o lance %', v_nome;
    END IF;

    INSERT INTO public.grupos_modalidades_lance(
      grupo_id, nome, percentual_lance_embutido,
      percentual_recurso_proprio_minimo, base_referencia,
      descricao, ativo, ordem, tipo_parcela, percentual_parcela_reduzida
    ) VALUES (
      p_grupo_id, v_nome, v_percentual, v_recurso_minimo, v_base,
      nullif(trim(v_item->>'descricao'), ''),
      coalesce((v_item->>'ativo')::boolean, true), v_ordem,
      NULL, NULL
    );
    IF v_primeiro_percentual IS NULL AND v_percentual > 0 THEN
      v_primeiro_percentual := v_percentual;
    END IF;
    v_ordem := v_ordem + 1;
    v_total := v_total + 1;
  END LOOP;

  UPDATE public.grupos_consorcio
  SET permite_lance_embutido = v_total > 0,
      percentual_lance_embutido = v_primeiro_percentual,
      updated_at = now()
  WHERE id = p_grupo_id;

  RETURN jsonb_build_object('grupo_id', p_grupo_id, 'lances', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_grupo_comercial(
  p_id uuid DEFAULT NULL,
  p_administradora_id uuid DEFAULT NULL,
  p_tipo_administradora_id uuid DEFAULT NULL,
  p_codigo_grupo text DEFAULT NULL,
  p_status text DEFAULT 'Disponível',
  p_ativo boolean DEFAULT true,
  p_prazo_total integer DEFAULT NULL,
  p_taxa_administrativa numeric DEFAULT 0,
  p_fundo_reserva numeric DEFAULT 0,
  p_seguro_percentual numeric DEFAULT 0,
  p_capacidade_total integer DEFAULT 0,
  p_vagas_disponiveis integer DEFAULT 0,
  p_observacoes text DEFAULT NULL,
  p_data_primeira_assembleia date DEFAULT NULL,
  p_percentual_parcela_reduzida numeric DEFAULT NULL,
  p_regra_integralizacao text DEFAULT NULL,
  p_assembleia_limite integer DEFAULT NULL,
  p_lances jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_salvo jsonb;
  v_grupo_id uuid;
  v_regra text := upper(nullif(trim(p_regra_integralizacao), ''));
  v_primeiro_lance numeric;
  v_permite_lance_atual boolean := false;
  v_percentual_lance_atual numeric := 0;
BEGIN
  IF NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Somente Platform Superadmin pode cadastrar ou editar Grupos Globais';
  END IF;
  IF p_id IS NULL AND p_data_primeira_assembleia IS NULL THEN
    RAISE EXCEPTION 'Data da primeira assembleia é obrigatória para novos grupos';
  END IF;
  IF p_percentual_parcela_reduzida IS NOT NULL
     AND (p_percentual_parcela_reduzida <= 0 OR p_percentual_parcela_reduzida > 100) THEN
    RAISE EXCEPTION 'Percentual da parcela reduzida deve estar entre 0 e 100';
  END IF;
  IF v_regra IS NOT NULL AND v_regra NOT IN ('CONTEMPLACAO', 'ASSEMBLEIA') THEN
    RAISE EXCEPTION 'Regra de vigência da parcela reduzida inválida';
  END IF;
  IF v_regra = 'ASSEMBLEIA'
     AND (p_assembleia_limite IS NULL OR p_assembleia_limite < 1
          OR p_prazo_total IS NULL OR p_assembleia_limite >= p_prazo_total) THEN
    RAISE EXCEPTION 'A assembleia limite deve ser menor que o prazo total do grupo';
  END IF;

  IF p_lances IS NOT NULL AND jsonb_typeof(p_lances) = 'array' THEN
    SELECT nullif(replace(value->>'percentual_lance_embutido', ',', '.'), '')::numeric
      INTO v_primeiro_lance
    FROM jsonb_array_elements(p_lances) WITH ORDINALITY AS itens(value, ordinality)
    WHERE coalesce((value->>'ativo')::boolean, true)
    ORDER BY ordinality
    LIMIT 1;
  END IF;
  IF p_id IS NOT NULL THEN
    SELECT coalesce(permite_lance_embutido, false), coalesce(percentual_lance_embutido, 0)
      INTO v_permite_lance_atual, v_percentual_lance_atual
    FROM public.grupos_consorcio WHERE id = p_id;
  END IF;

  v_salvo := public.rpc_platform_salvar_grupo(
    p_id => p_id,
    p_administradora_id => p_administradora_id,
    p_tipo_administradora_id => p_tipo_administradora_id,
    p_codigo_grupo => p_codigo_grupo,
    p_status => p_status,
    p_ativo => p_ativo,
    p_prazo_total => p_prazo_total,
    p_taxa_administrativa => p_taxa_administrativa,
    p_fundo_reserva => p_fundo_reserva,
    p_seguro_percentual => p_seguro_percentual,
    p_capacidade_total => p_capacidade_total,
    p_vagas_disponiveis => p_vagas_disponiveis,
    p_permite_lance_embutido => CASE WHEN p_lances IS NULL THEN v_permite_lance_atual ELSE jsonb_array_length(p_lances) > 0 END,
    p_percentual_lance_embutido => CASE WHEN p_lances IS NULL THEN v_percentual_lance_atual ELSE coalesce(v_primeiro_lance, 0) END,
    p_observacoes => p_observacoes,
    p_data_primeira_assembleia => p_data_primeira_assembleia
  );
  v_grupo_id := (v_salvo->>'id')::uuid;

  UPDATE public.grupos_consorcio
  SET percentual_parcela_reduzida = p_percentual_parcela_reduzida,
      tem_parcela_reduzida = p_percentual_parcela_reduzida IS NOT NULL,
      regra_integralizacao_parcela_reduzida = v_regra,
      assembleia_limite_parcela_reduzida = CASE WHEN v_regra = 'ASSEMBLEIA' THEN p_assembleia_limite ELSE NULL END,
      updated_at = now()
  WHERE id = v_grupo_id;

  IF p_lances IS NOT NULL THEN
    PERFORM public.rpc_platform_salvar_lances_embutidos_grupo(v_grupo_id, p_lances);
  END IF;
  RETURN (SELECT to_jsonb(g) FROM public.grupos_consorcio g WHERE g.id = v_grupo_id);
END;
$$;

-- O ERP envia a mesma configuração estrutural como solicitação. A lista positiva
-- impede que o tenant injete identidade, governança ou dados históricos.
CREATE OR REPLACE FUNCTION public.rpc_submeter_alteracao_grupo_franquia(
  p_empresa_id uuid,
  p_grupo_id uuid,
  p_administradora_id uuid,
  p_tipo_administradora_id uuid,
  p_codigo_grupo text,
  p_payload jsonb,
  p_chave_idempotencia text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_usuario uuid; v_id uuid; v_payload jsonb; v_grupo_id uuid := p_grupo_id;
  v_item jsonb; v_ordem integer := 0; v_embutido numeric; v_recurso numeric; v_base text; v_nome text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF nullif(trim(p_chave_idempotencia),'') IS NULL THEN RAISE EXCEPTION 'Chave de idempotência obrigatória'; END IF;
  IF p_grupo_id IS NULL AND nullif(p_payload->>'data_primeira_assembleia','') IS NULL THEN
    RAISE EXCEPTION 'Data da primeira assembleia é obrigatória para novos grupos';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.empresa_administradoras WHERE empresa_id=p_empresa_id AND administradora_id=p_administradora_id AND status='ATIVA') THEN
    RAISE EXCEPTION 'Administradora não concedida à empresa';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM public.administradora_tipos WHERE id=p_tipo_administradora_id AND administradora_id=p_administradora_id AND ativo) THEN
    RAISE EXCEPTION 'Tipo não pertence à administradora';
  END IF;
  IF p_grupo_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.grupos_consorcio WHERE id=p_grupo_id AND administradora_id=p_administradora_id) THEN
    RAISE EXCEPTION 'Grupo não pertence à administradora';
  END IF;
  IF p_payload ? 'lances' AND jsonb_typeof(p_payload->'lances') <> 'array' THEN
    RAISE EXCEPTION 'A lista de modalidades de lance é inválida';
  END IF;
  v_payload:=jsonb_strip_nulls(jsonb_build_object(
    'status',p_payload->'status', 'ativo',p_payload->'ativo',
    'prazo_total',p_payload->'prazo_total',
    'taxa_administrativa_percentual',p_payload->'taxa_administrativa_percentual',
    'fundo_reserva_percentual',p_payload->'fundo_reserva_percentual',
    'seguro_percentual',p_payload->'seguro_percentual',
    'seguro_habilitado',p_payload->'seguro_habilitado',
    'capacidade_total',p_payload->'capacidade_total',
    'vagas_disponiveis',p_payload->'vagas_disponiveis',
    'observacoes',p_payload->'observacoes', 'creditos',p_payload->'creditos',
    'categorias',p_payload->'categorias',
    'data_primeira_assembleia',p_payload->'data_primeira_assembleia',
    'percentual_parcela_reduzida',p_payload->'percentual_parcela_reduzida',
    'regra_integralizacao_parcela_reduzida',p_payload->'regra_integralizacao_parcela_reduzida',
    'assembleia_limite_parcela_reduzida',p_payload->'assembleia_limite_parcela_reduzida',
    'lances',p_payload->'lances'
  ));
  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id=auth.uid() LIMIT 1;

  IF v_grupo_id IS NULL THEN
    INSERT INTO public.grupos_consorcio(
      codigo_grupo, modalidade, administradora, administradora_id,
      tipo_administradora_id, taxa_administrativa_percentual,
      fundo_reserva_percentual, seguro_habilitado, seguro_percentual,
      tem_parcela_reduzida, percentual_parcela_reduzida,
      permite_lance_embutido, percentual_lance_embutido,
      prazo_total, prazo_restante, status, ativo, observacoes,
      data_primeira_assembleia, regra_integralizacao_parcela_reduzida,
      assembleia_limite_parcela_reduzida,
      empresa_origem_id, origem_governanca, status_governanca
    ) VALUES (
      trim(p_codigo_grupo),
      (SELECT nome FROM public.administradora_tipos WHERE id=p_tipo_administradora_id),
      (SELECT nome FROM public.administradoras WHERE id=p_administradora_id),
      p_administradora_id, p_tipo_administradora_id,
      nullif(p_payload->>'taxa_administrativa_percentual','')::numeric,
      coalesce(nullif(p_payload->>'fundo_reserva_percentual','')::numeric,0),
      coalesce((p_payload->>'seguro_habilitado')::boolean,false),
      coalesce(nullif(p_payload->>'seguro_percentual','')::numeric,0),
      p_payload->>'percentual_parcela_reduzida' IS NOT NULL,
      nullif(p_payload->>'percentual_parcela_reduzida','')::numeric,
      jsonb_array_length(coalesce(p_payload->'lances','[]'::jsonb)) > 0,
      null, nullif(p_payload->>'prazo_total','')::integer,
      nullif(p_payload->>'prazo_total','')::integer,
      coalesce(p_payload->>'status','Disponível'), coalesce((p_payload->>'ativo')::boolean,true),
      nullif(p_payload->>'observacoes',''), (p_payload->>'data_primeira_assembleia')::date,
      nullif(p_payload->>'regra_integralizacao_parcela_reduzida',''),
      nullif(p_payload->>'assembleia_limite_parcela_reduzida','')::integer,
      p_empresa_id, 'LOCAL', 'PENDENTE_PLATFORM'
    ) RETURNING id INTO v_grupo_id;

    IF jsonb_typeof(p_payload->'lances')='array' THEN
      FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'lances') LOOP
        v_nome := nullif(trim(v_item->>'nome'),'');
        v_embutido := nullif(replace(v_item->>'percentual_lance_embutido',',','.'),'')::numeric;
        v_recurso := coalesce(nullif(replace(v_item->>'percentual_recurso_proprio_minimo',',','.'),'')::numeric,0);
        v_base := upper(coalesce(nullif(trim(v_item->>'base_referencia'),''),'SALDO_DEVEDOR'));
        IF v_nome IS NULL OR v_embutido IS NULL OR v_embutido < 0 OR v_embutido > 100
           OR v_recurso < 0 OR v_recurso > 100 OR v_embutido + v_recurso > 100
           OR v_base NOT IN ('SALDO_DEVEDOR','CREDITO') THEN
          RAISE EXCEPTION 'Modalidade de lance inválida';
        END IF;
        INSERT INTO public.grupos_modalidades_lance(
          grupo_id,nome,percentual_lance_embutido,percentual_recurso_proprio_minimo,
          base_referencia,descricao,ativo,ordem,tipo_parcela,percentual_parcela_reduzida
        ) VALUES(v_grupo_id,v_nome,v_embutido,v_recurso,v_base,nullif(trim(v_item->>'descricao'),''),true,v_ordem,null,null);
        IF v_ordem=0 THEN
          UPDATE public.grupos_consorcio SET percentual_lance_embutido=v_embutido WHERE id=v_grupo_id;
        END IF;
        v_ordem:=v_ordem+1;
      END LOOP;
    END IF;
    INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao)
    VALUES(v_grupo_id,p_empresa_id,'CRIADO_LOCAL',v_usuario,'Cadastro pelo ERP aguardando homologação global');
  END IF;

  INSERT INTO public.catalogo_grupo_solicitacoes(
    empresa_id,grupo_id,administradora_id,tipo_administradora_id,codigo_grupo,payload,
    chave_idempotencia,criado_por_usuario_id
  ) VALUES(p_empresa_id,v_grupo_id,p_administradora_id,p_tipo_administradora_id,trim(p_codigo_grupo),v_payload,p_chave_idempotencia,v_usuario)
  ON CONFLICT(empresa_id,chave_idempotencia) DO UPDATE SET atualizado_em=now()
  RETURNING id INTO v_id;
  IF v_grupo_id IS NOT NULL THEN
    INSERT INTO public.empresa_grupos_config(empresa_id,grupo_id,alteracao_catalogo_payload,alteracao_catalogo_status,updated_at)
    VALUES(p_empresa_id,v_grupo_id,v_payload,'PENDENTE_PLATFORM',now())
    ON CONFLICT(empresa_id,grupo_id) DO UPDATE SET alteracao_catalogo_payload=excluded.alteracao_catalogo_payload,
      alteracao_catalogo_status='PENDENTE_PLATFORM',updated_at=now();
  END IF;
  RETURN jsonb_build_object('id',v_id,'grupo_id',v_grupo_id,'status','PENDENTE_PLATFORM','aplicacao_local',true);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_platform_decidir_solicitacao_grupo(
  p_solicitacao_id uuid,
  p_decisao text,
  p_observacao text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_s public.catalogo_grupo_solicitacoes%ROWTYPE;
  v_g public.grupos_consorcio%ROWTYPE;
  v_salvo jsonb; v_grupo_id uuid; v_usuario uuid;
  v_creditos numeric[]; v_categorias text[];
  v_decisao text:=upper(trim(p_decisao));
BEGIN
  IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
  IF v_decisao NOT IN ('APROVAR','DEVOLVER','REJEITAR') THEN RAISE EXCEPTION 'Decisão inválida'; END IF;
  SELECT * INTO v_s FROM public.catalogo_grupo_solicitacoes WHERE id=p_solicitacao_id FOR UPDATE;
  IF v_s.id IS NULL THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF v_s.status IN ('APROVADA','REJEITADA') THEN RAISE EXCEPTION 'Solicitação já encerrada'; END IF;
  SELECT id INTO v_usuario FROM public.usuarios WHERE auth_user_id=auth.uid() LIMIT 1;
  IF v_decisao='APROVAR' THEN
    IF v_s.grupo_id IS NOT NULL THEN
      SELECT * INTO v_g FROM public.grupos_consorcio WHERE id=v_s.grupo_id FOR UPDATE;
      IF v_g.id IS NULL THEN RAISE EXCEPTION 'Grupo oficial não encontrado'; END IF;
    END IF;
    v_salvo:=public.rpc_platform_salvar_grupo_comercial(
      p_id=>v_s.grupo_id, p_administradora_id=>v_s.administradora_id,
      p_tipo_administradora_id=>v_s.tipo_administradora_id, p_codigo_grupo=>v_s.codigo_grupo,
      p_status=>coalesce(v_s.payload->>'status',v_g.status,'Disponível'),
      p_ativo=>coalesce((v_s.payload->>'ativo')::boolean,v_g.ativo,true),
      p_prazo_total=>coalesce((v_s.payload->>'prazo_total')::integer,v_g.prazo_total),
      p_taxa_administrativa=>coalesce((v_s.payload->>'taxa_administrativa_percentual')::numeric,v_g.taxa_administrativa_percentual,0),
      p_fundo_reserva=>coalesce((v_s.payload->>'fundo_reserva_percentual')::numeric,v_g.fundo_reserva_percentual,0),
      p_seguro_percentual=>coalesce((v_s.payload->>'seguro_percentual')::numeric,v_g.seguro_percentual,0),
      p_capacidade_total=>coalesce((v_s.payload->>'capacidade_total')::integer,v_g.capacidade_total,0),
      p_vagas_disponiveis=>coalesce((v_s.payload->>'vagas_disponiveis')::integer,v_g.vagas_disponiveis,0),
      p_observacoes=>coalesce(v_s.payload->>'observacoes',v_g.observacoes),
      p_data_primeira_assembleia=>coalesce((v_s.payload->>'data_primeira_assembleia')::date,v_g.data_primeira_assembleia),
      p_percentual_parcela_reduzida=>coalesce((v_s.payload->>'percentual_parcela_reduzida')::numeric,v_g.percentual_parcela_reduzida),
      p_regra_integralizacao=>coalesce(v_s.payload->>'regra_integralizacao_parcela_reduzida',v_g.regra_integralizacao_parcela_reduzida),
      p_assembleia_limite=>coalesce((v_s.payload->>'assembleia_limite_parcela_reduzida')::integer,v_g.assembleia_limite_parcela_reduzida),
      p_lances=>CASE WHEN v_s.payload ? 'lances' THEN v_s.payload->'lances' ELSE NULL END
    );
    v_grupo_id:=(v_salvo->>'id')::uuid;
    IF v_g.origem_governanca='LOCAL' THEN
      UPDATE public.grupos_consorcio
      SET origem_governanca='GLOBAL',status_governanca='GLOBAL',empresa_origem_id=NULL,updated_at=now()
      WHERE id=v_grupo_id;
      INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao)
      VALUES(v_grupo_id,v_s.empresa_id,'PROMOVIDO_GLOBAL',v_usuario,p_observacao);
    END IF;
    IF jsonb_typeof(v_s.payload->'creditos')='array' THEN
      SELECT array_agg(valor) INTO v_creditos FROM (
        SELECT (jsonb_array_elements_text(v_s.payload->'creditos'))::numeric AS valor
      ) q WHERE valor>0;
      IF coalesce(array_length(v_creditos,1),0)>0 THEN PERFORM public.rpc_platform_salvar_cotas_lote(v_grupo_id,v_creditos); END IF;
    END IF;
    IF jsonb_typeof(v_s.payload->'categorias')='array' THEN
      SELECT array_agg(upper(trim(valor))) INTO v_categorias FROM jsonb_array_elements_text(v_s.payload->'categorias') q(valor);
      IF coalesce(array_length(v_categorias,1),0)>0 THEN PERFORM public.rpc_platform_configurar_categorias_grupo(v_grupo_id,v_categorias); END IF;
    END IF;
    UPDATE public.empresa_grupos_config SET alteracao_catalogo_payload='{}'::jsonb,
      alteracao_catalogo_status='APROVADA',updated_at=now()
    WHERE empresa_id=v_s.empresa_id AND grupo_id=v_grupo_id;
  END IF;
  UPDATE public.catalogo_grupo_solicitacoes SET
    status=CASE v_decisao WHEN 'APROVAR' THEN 'APROVADA' WHEN 'DEVOLVER' THEN 'DEVOLVIDA' ELSE 'REJEITADA' END,
    decidido_por_usuario_id=v_usuario,decisao_observacao=nullif(trim(p_observacao),''),
    decidido_em=now(),atualizado_em=now(),grupo_id=coalesce(v_grupo_id,grupo_id)
  WHERE id=v_s.id;
  IF v_s.grupo_id IS NOT NULL AND v_decisao<>'APROVAR' THEN
    UPDATE public.empresa_grupos_config SET alteracao_catalogo_status=CASE v_decisao WHEN 'DEVOLVER' THEN 'DEVOLVIDA' ELSE 'REJEITADA' END,updated_at=now()
    WHERE empresa_id=v_s.empresa_id AND grupo_id=v_s.grupo_id;
  END IF;
  RETURN jsonb_build_object('id',v_s.id,'decisao',v_decisao,'grupo_id',coalesce(v_grupo_id,v_s.grupo_id));
END $$;

REVOKE ALL ON FUNCTION public.rpc_platform_salvar_grupo_comercial(uuid,uuid,uuid,text,text,boolean,integer,numeric,numeric,numeric,integer,integer,text,date,numeric,text,integer,jsonb)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_grupo_comercial(uuid,uuid,uuid,text,text,boolean,integer,numeric,numeric,numeric,integer,integer,text,date,numeric,text,integer,jsonb)
  TO authenticated;

COMMENT ON COLUMN public.grupos_modalidades_lance.base_referencia IS
  'Base informativa do percentual do lance: saldo devedor ou crédito contratado.';
COMMENT ON COLUMN public.grupos_consorcio.regra_integralizacao_parcela_reduzida IS
  'Regra informativa para novos grupos: até contemplação ou até assembleia limite.';
COMMENT ON COLUMN public.grupos_consorcio.assembleia_limite_parcela_reduzida IS
  'Última assembleia com parcela reduzida; a integral começa na assembleia X+1.';

COMMIT;
NOTIFY pgrst, 'reload schema';
