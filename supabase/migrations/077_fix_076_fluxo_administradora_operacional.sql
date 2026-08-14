-- 077: correções forward-only da fase 076.
-- Catálogo nasce na Administradora, cronograma automático é herdado,
-- recebimento real é separado da conciliação e lance pertence à cota.

BEGIN;

CREATE OR REPLACE FUNCTION public.codigo_catalogo_administradora(p_nome text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path=pg_catalog AS $$
  SELECT upper(trim(both '_' from regexp_replace(
    translate(lower(trim(coalesce(p_nome,''))),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+','_','g')))
$$;

CREATE TABLE public.administradora_tipo_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  tipo_canonico_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  alias_codigo text NOT NULL,
  alias_nome text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(administradora_id,alias_codigo)
);

DO $$
DECLARE v_admin uuid; v_canon uuid; v_dup record;
BEGIN
  SELECT id INTO v_admin FROM public.administradoras WHERE slug='racon';
  IF v_admin IS NULL THEN RETURN; END IF;
  SELECT id INTO v_canon FROM public.administradora_tipos
   WHERE administradora_id=v_admin AND codigo='AUTOMOVEIS' ORDER BY created_at,id LIMIT 1;
  IF v_canon IS NULL THEN
    SELECT id INTO v_canon FROM public.administradora_tipos
     WHERE administradora_id=v_admin
       AND public.codigo_catalogo_administradora(nome) IN ('AUTOMOVEL','AUTOMOVEIS')
     ORDER BY (public.codigo_catalogo_administradora(nome)='AUTOMOVEIS') DESC,created_at,id LIMIT 1;
  END IF;
  IF v_canon IS NULL THEN RETURN; END IF;
  UPDATE public.administradora_tipos SET nome='Automóveis',codigo='AUTOMOVEIS',ativo=true,updated_at=now() WHERE id=v_canon;
  FOR v_dup IN SELECT * FROM public.administradora_tipos
    WHERE administradora_id=v_admin AND id<>v_canon
      AND public.codigo_catalogo_administradora(nome) IN ('AUTOMOVEL','AUTOMOVEIS')
  LOOP
    INSERT INTO public.administradora_tipo_aliases(administradora_id,tipo_canonico_id,alias_codigo,alias_nome)
    VALUES(v_admin,v_canon,v_dup.codigo,v_dup.nome)
    ON CONFLICT(administradora_id,alias_codigo) DO UPDATE SET tipo_canonico_id=excluded.tipo_canonico_id,alias_nome=excluded.alias_nome;
    UPDATE public.comissao_regras_franquia SET tipo_administradora_id=v_canon WHERE tipo_administradora_id=v_dup.id;
    UPDATE public.comissao_regras_participantes SET tipo_administradora_id=v_canon WHERE tipo_administradora_id=v_dup.id;
    UPDATE public.grupos_consorcio SET tipo_administradora_id=v_canon WHERE tipo_administradora_id=v_dup.id;
    UPDATE public.administradora_tipos SET ativo=false,updated_at=now() WHERE id=v_dup.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX administradora_tipos_nome_ativo_uidx
 ON public.administradora_tipos(administradora_id,lower(trim(nome))) WHERE ativo;
CREATE UNIQUE INDEX administradora_modalidades_nome_ativo_uidx
 ON public.administradora_modalidades_comissao(administradora_id,lower(trim(nome))) WHERE ativo;

ALTER TABLE public.administradora_modalidades_comissao
  ADD COLUMN IF NOT EXISTS descricao text;
ALTER TABLE public.administradora_curvas_estorno
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.administradora_curvas_estorno DROP CONSTRAINT IF EXISTS administradora_curvas_estorno_status_check;
ALTER TABLE public.administradora_curvas_estorno ADD CONSTRAINT administradora_curvas_estorno_status_check
 CHECK(status IN ('RASCUNHO','HOMOLOGADA','INATIVA'));

CREATE OR REPLACE FUNCTION public.rpc_salvar_tipo_administradora(
 p_administradora_id uuid,p_nome text,p_ativo boolean DEFAULT true,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_codigo text;v_row record;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.administradoras WHERE id=p_administradora_id) THEN RAISE EXCEPTION 'Administradora não encontrada';END IF;
 IF length(trim(coalesce(p_nome,'')))<2 THEN RAISE EXCEPTION 'Nome do Tipo é obrigatório';END IF;
 IF EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=p_administradora_id AND id IS DISTINCT FROM p_id AND ativo AND lower(trim(nome))=lower(trim(p_nome))) THEN RAISE EXCEPTION 'Já existe Tipo ativo com este nome';END IF;
 IF p_id IS NULL THEN
  v_codigo:=public.codigo_catalogo_administradora(p_nome);
  IF v_codigo='' THEN RAISE EXCEPTION 'Nome não gera código técnico válido';END IF;
  WHILE EXISTS(SELECT 1 FROM public.administradora_tipos WHERE administradora_id=p_administradora_id AND codigo=v_codigo) LOOP
   v_codigo:=v_codigo||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  END LOOP;
  INSERT INTO public.administradora_tipos(administradora_id,codigo,nome,ativo)
   VALUES(p_administradora_id,v_codigo,trim(p_nome),p_ativo) RETURNING * INTO v_row;
 ELSE
  UPDATE public.administradora_tipos SET nome=trim(p_nome),ativo=p_ativo,updated_at=now()
   WHERE id=p_id AND administradora_id=p_administradora_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Tipo não encontrado nesta Administradora';END IF;
 END IF;
 RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_salvar_modalidade_administradora(
 p_administradora_id uuid,p_nome text,p_descricao text DEFAULT NULL,p_ativo boolean DEFAULT true,p_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_codigo text;v_row record;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin'; END IF;
 IF length(trim(coalesce(p_nome,'')))<2 THEN RAISE EXCEPTION 'Nome da Modalidade é obrigatório';END IF;
 IF EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE administradora_id=p_administradora_id AND id IS DISTINCT FROM p_id AND ativo AND lower(trim(nome))=lower(trim(p_nome))) THEN RAISE EXCEPTION 'Já existe Modalidade ativa com este nome';END IF;
 IF p_id IS NULL THEN
  v_codigo:=public.codigo_catalogo_administradora(p_nome);
  WHILE EXISTS(SELECT 1 FROM public.administradora_modalidades_comissao WHERE administradora_id=p_administradora_id AND codigo=v_codigo) LOOP
   v_codigo:=v_codigo||'_'||substr(replace(gen_random_uuid()::text,'-',''),1,6);
  END LOOP;
  INSERT INTO public.administradora_modalidades_comissao(administradora_id,codigo,nome,descricao,ativo)
   VALUES(p_administradora_id,v_codigo,trim(p_nome),nullif(trim(coalesce(p_descricao,'')),''),p_ativo) RETURNING * INTO v_row;
 ELSE
  UPDATE public.administradora_modalidades_comissao SET nome=trim(p_nome),descricao=nullif(trim(coalesce(p_descricao,'')),''),ativo=p_ativo,updated_at=now()
   WHERE id=p_id AND administradora_id=p_administradora_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Modalidade não encontrada nesta Administradora';END IF;
 END IF;
 RETURN to_jsonb(v_row);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_salvar_curva_estorno(
 p_administradora_id uuid,p_nome text,p_vigencia_inicio date,p_faixas jsonb,
 p_curva_id uuid DEFAULT NULL,p_nova_versao boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_curva record;v_f jsonb;v_versao integer;
BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform Superadmin';END IF;
 IF length(trim(coalesce(p_nome,'')))<2 OR p_vigencia_inicio IS NULL THEN RAISE EXCEPTION 'Nome e início da vigência são obrigatórios';END IF;
 IF jsonb_typeof(p_faixas)<>'array' OR jsonb_array_length(p_faixas)=0 THEN RAISE EXCEPTION 'Adicione ao menos uma faixa';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_faixas)e WHERE coalesce(e->>'mes','')!~'^[0-9]+$' OR (e->>'mes')::int<1 OR coalesce(e->>'percentual','')!~'^[0-9]+([.][0-9]{1,4})?$' OR (e->>'percentual')::numeric<0 OR (e->>'percentual')::numeric>100) THEN RAISE EXCEPTION 'Faixa de mês/percentual inválida';END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_faixas))<>(SELECT count(DISTINCT (e->>'mes')::int) FROM jsonb_array_elements(p_faixas)e) THEN RAISE EXCEPTION 'Mês duplicado na curva';END IF;
 IF p_curva_id IS NOT NULL AND NOT p_nova_versao THEN
  SELECT * INTO v_curva FROM public.administradora_curvas_estorno WHERE id=p_curva_id AND administradora_id=p_administradora_id FOR UPDATE;
  IF v_curva.id IS NULL THEN RAISE EXCEPTION 'Curva não encontrada';END IF;
  IF v_curva.status<>'RASCUNHO' THEN RAISE EXCEPTION 'Curva homologada exige Nova versão';END IF;
  UPDATE public.administradora_curvas_estorno SET nome=trim(p_nome),vigencia_inicio=p_vigencia_inicio,updated_at=now() WHERE id=v_curva.id RETURNING * INTO v_curva;
  DELETE FROM public.administradora_curva_estorno_faixas WHERE curva_id=v_curva.id;
 ELSE
  SELECT coalesce(max(versao),0)+1 INTO v_versao FROM public.administradora_curvas_estorno WHERE administradora_id=p_administradora_id AND nome=trim(p_nome);
  INSERT INTO public.administradora_curvas_estorno(administradora_id,nome,versao,vigencia_inicio,ativa,encerra_na_contemplacao,status)
   VALUES(p_administradora_id,trim(p_nome),v_versao,p_vigencia_inicio,true,true,'RASCUNHO') RETURNING * INTO v_curva;
 END IF;
 FOR v_f IN SELECT value FROM jsonb_array_elements(p_faixas) LOOP
  INSERT INTO public.administradora_curva_estorno_faixas(curva_id,mes_relativo,percentual_estorno)
   VALUES(v_curva.id,(v_f->>'mes')::int,(v_f->>'percentual')::numeric);
 END LOOP;
 RETURN to_jsonb(v_curva);
END $$;

ALTER TABLE public.comissao_regras_participantes DROP CONSTRAINT IF EXISTS comissao_regra_participante_cronograma_array_check;
CREATE OR REPLACE FUNCTION public.comissao_regra_participante_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE v_admin_id uuid; v_total numeric;
BEGIN
  NEW.modalidade := NULLIF(lower(trim(COALESCE(NEW.modalidade,''))), '');
  NEW.plano_condicao := NULLIF(lower(trim(COALESCE(NEW.plano_condicao,''))), '');
  NEW.origem_configuracao := upper(trim(NEW.origem_configuracao));
  v_total := CASE WHEN NEW.base_calculo = 'credito' THEN NEW.percentual_comissao ELSE NEW.valor_fixo_total END;
  IF NEW.modo_regra <> 'AUTOMATICA'
     AND NOT public.comissao_validar_cronograma(NEW.base_calculo, v_total, NEW.etapas_cronograma) THEN
    RAISE EXCEPTION 'Cronograma de participante inválido para base %', NEW.base_calculo;
  END IF;
  IF NEW.modo_regra = 'AUTOMATICA' THEN NEW.etapas_cronograma := '[]'::jsonb; END IF;
  SELECT p.administradora_id INTO v_admin_id FROM public.comissao_programas p
   WHERE p.id=NEW.programa_id AND p.empresa_id=NEW.empresa_id;
  IF NEW.configuracao_homologada AND v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Regra homologada exige programa com administradora explícita';
  END IF;
  IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais pc
     WHERE pc.id=NEW.participante_comercial_id AND pc.empresa_id=NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Participante da regra pertence a outro tenant'; END IF;
  IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organizacoes_parceiras op
     WHERE op.id=NEW.organizacao_parceira_id AND op.empresa_id=NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Organização da regra pertence a outro tenant'; END IF;
  IF NEW.opcao_cota_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.grupos_cotas c JOIN public.grupos_consorcio g ON g.id=c.grupo_id
     WHERE c.id=NEW.opcao_cota_id AND g.administradora_id=v_admin_id
  ) THEN RAISE EXCEPTION 'Opção de cota não pertence à administradora do programa'; END IF;
  RETURN NEW;
END $$;
-- Regras automáticas anteriores à 077 podiam persistir um cronograma que o
-- motor nunca deveria tratar como fonte própria. A partir desta correção elas
-- herdam exclusivamente o cronograma da Franqueadora.
UPDATE public.comissao_regras_participantes
SET etapas_cronograma = '[]'::jsonb,
    updated_at = now()
WHERE modo_regra = 'AUTOMATICA'
  AND etapas_cronograma IS DISTINCT FROM '[]'::jsonb;
ALTER TABLE public.comissao_regras_participantes ADD CONSTRAINT comissao_regra_participante_cronograma_array_check CHECK (
 jsonb_typeof(etapas_cronograma)='array' AND
 ((modo_regra='AUTOMATICA' AND jsonb_array_length(etapas_cronograma)=0) OR
  (modo_regra='MANUAL' AND jsonb_array_length(etapas_cronograma)>0))
);

CREATE OR REPLACE FUNCTION public.empresa_configuracao_fiscal_sem_sobreposicao()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.empresa_id::text||':FISCAL',0));
 IF NEW.ativo AND EXISTS(SELECT 1 FROM public.empresa_configuracoes_fiscais f WHERE f.empresa_id=NEW.empresa_id AND f.ativo AND f.id<>NEW.id AND NEW.vigencia_inicio<=coalesce(f.vigencia_fim,'infinity'::date) AND f.vigencia_inicio<=coalesce(NEW.vigencia_fim,'infinity'::date)) THEN
  RAISE EXCEPTION 'Já existe configuração fiscal ativa sobreposta nesta vigência';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER empresa_configuracao_fiscal_sem_sobreposicao_guard
 BEFORE INSERT OR UPDATE ON public.empresa_configuracoes_fiscais FOR EACH ROW
 EXECUTE FUNCTION public.empresa_configuracao_fiscal_sem_sobreposicao();

CREATE OR REPLACE FUNCTION public.rpc_salvar_configuracao_fiscal(
 p_empresa_id uuid,p_percentual numeric,p_vigencia_inicio date,p_vigencia_fim date,p_exibe_detalhes boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_row record;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF p_percentual<0 OR p_percentual>=100 OR p_vigencia_inicio IS NULL OR (p_vigencia_fim IS NOT NULL AND p_vigencia_fim<p_vigencia_inicio) THEN RAISE EXCEPTION 'Configuração fiscal inválida';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':FISCAL',0));
 UPDATE public.empresa_configuracoes_fiscais SET vigencia_fim=p_vigencia_inicio-1,updated_at=now()
  WHERE empresa_id=p_empresa_id AND ativo AND vigencia_fim IS NULL AND vigencia_inicio<p_vigencia_inicio;
 IF EXISTS(SELECT 1 FROM public.empresa_configuracoes_fiscais f WHERE f.empresa_id=p_empresa_id AND f.ativo AND p_vigencia_inicio<=coalesce(f.vigencia_fim,'infinity'::date) AND f.vigencia_inicio<=coalesce(p_vigencia_fim,'infinity'::date)) THEN RAISE EXCEPTION 'Já existe configuração fiscal ativa sobreposta nesta vigência';END IF;
 INSERT INTO public.empresa_configuracoes_fiscais(empresa_id,vigencia_inicio,vigencia_fim,percentual_imposto,participante_exibe_detalhes_fiscais,ativo,created_by_usuario_id)
 VALUES(p_empresa_id,p_vigencia_inicio,p_vigencia_fim,p_percentual,p_exibe_detalhes,true,public.current_usuario_id()) RETURNING * INTO v_row;
 RETURN to_jsonb(v_row);
END $$;

ALTER TABLE public.financeiro_recebimentos
 ADD COLUMN IF NOT EXISTS origem_registro text NOT NULL DEFAULT 'PREVISOES',
 ADD COLUMN IF NOT EXISTS conta_bancaria_id uuid REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS conta_entrada text,
 ADD COLUMN IF NOT EXISTS numero_nota_fiscal text,
 ADD COLUMN IF NOT EXISTS data_nota_fiscal date,
 ADD COLUMN IF NOT EXISTS descricao text,
 ADD COLUMN IF NOT EXISTS idempotency_key text,
 ADD COLUMN IF NOT EXISTS conciliacao_status text NOT NULL DEFAULT 'CONCILIADO',
 ADD COLUMN IF NOT EXISTS valor_classificado numeric(15,2) NOT NULL DEFAULT 0;
ALTER TABLE public.financeiro_recebimentos DROP CONSTRAINT IF EXISTS financeiro_recebimentos_origem_registro_check;
ALTER TABLE public.financeiro_recebimentos ADD CONSTRAINT financeiro_recebimentos_origem_registro_check CHECK(origem_registro IN ('PREVISOES','MANUAL'));
ALTER TABLE public.financeiro_recebimentos DROP CONSTRAINT IF EXISTS financeiro_recebimentos_conciliacao_status_check;
ALTER TABLE public.financeiro_recebimentos ADD CONSTRAINT financeiro_recebimentos_conciliacao_status_check CHECK(conciliacao_status IN ('PENDENTE_CLASSIFICACAO','PARCIALMENTE_CONCILIADO','CONCILIADO'));
CREATE UNIQUE INDEX financeiro_recebimentos_idempotency_manual_uidx ON public.financeiro_recebimentos(empresa_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
UPDATE public.financeiro_recebimentos r SET valor_classificado=x.total,
 conciliacao_status=CASE WHEN x.total>=r.valor_total THEN 'CONCILIADO' WHEN x.total>0 THEN 'PARCIALMENTE_CONCILIADO' ELSE 'PENDENTE_CLASSIFICACAO' END
FROM (SELECT recebimento_id,coalesce(sum(valor_liquidado),0) total FROM public.financeiro_recebimento_itens GROUP BY recebimento_id)x
WHERE r.id=x.recebimento_id AND r.origem_registro='PREVISOES';

CREATE TABLE public.financeiro_recebimento_classificacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 recebimento_id uuid NOT NULL REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('PENDENCIA_ANTERIOR','COMISSAO_LEGADO','REPASSE_TERCEIRO_SOCIO','PLANO_MIDIA','BONIFICACAO','AJUSTE_ADMINISTRADORA','NAO_IDENTIFICADO')),
 valor numeric(15,2) NOT NULL CHECK(valor>0),descricao text,created_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.financeiro_recebimento_conciliacoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 recebimento_id uuid NOT NULL REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
 idempotency_key text NOT NULL,payload_hash text NOT NULL,created_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,idempotency_key)
);

CREATE OR REPLACE FUNCTION public.rpc_registrar_recebimento_manual(
 p_empresa_id uuid,p_administradora_id uuid,p_competencia text,p_valor_total numeric,p_data_recebimento date,
 p_conta_entrada text,p_idempotency_key text,p_conta_bancaria_id uuid DEFAULT NULL,p_numero_nota_fiscal text DEFAULT NULL,
 p_data_nota_fiscal date DEFAULT NULL,p_descricao text DEFAULT NULL,p_observacoes text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_receb record;v_hash text;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF p_valor_total<=0 OR round(p_valor_total,2)<>p_valor_total THEN RAISE EXCEPTION 'Valor recebido inválido';END IF;
 IF p_competencia!~'^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competência inválida';END IF;
 IF length(trim(coalesce(p_conta_entrada,'')))<2 THEN RAISE EXCEPTION 'Conta/Caixa de entrada é obrigatório';END IF;
 IF length(trim(coalesce(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Chave de idempotência inválida';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.empresa_administradoras WHERE empresa_id=p_empresa_id AND administradora_id=p_administradora_id AND status='ATIVA') THEN RAISE EXCEPTION 'Administradora não concedida ao tenant';END IF;
 IF p_conta_bancaria_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_bancaria_id AND empresa_id=p_empresa_id AND ativo) THEN RAISE EXCEPTION 'Conta bancária inválida para o tenant';END IF;
 v_hash:=md5(concat_ws('|',p_administradora_id,p_competencia,p_valor_total,p_data_recebimento,p_conta_entrada,coalesce(p_numero_nota_fiscal,'')));
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':RECEBIMENTO_MANUAL:'||p_idempotency_key,0));
 SELECT * INTO v_receb FROM public.financeiro_recebimentos WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF v_receb.id IS NOT NULL THEN
  IF md5(concat_ws('|',v_receb.administradora_id,v_receb.competencia,v_receb.valor_total,v_receb.data_recebimento,v_receb.conta_entrada,coalesce(v_receb.numero_nota_fiscal,'')))<>v_hash THEN RAISE EXCEPTION 'Chave reutilizada com dados diferentes';END IF;
  RETURN jsonb_build_object('recebimento',to_jsonb(v_receb),'reused',true);
 END IF;
 INSERT INTO public.financeiro_recebimentos(empresa_id,administradora_id,competencia,data_recebimento,valor_total,forma_pagamento,referencia_documento,observacoes,status,origem_registro,conta_bancaria_id,conta_entrada,numero_nota_fiscal,data_nota_fiscal,descricao,idempotency_key,conciliacao_status,valor_classificado)
 VALUES(p_empresa_id,p_administradora_id,p_competencia,p_data_recebimento,p_valor_total,'outros',p_numero_nota_fiscal,p_observacoes,'confirmado','MANUAL',p_conta_bancaria_id,trim(p_conta_entrada),nullif(trim(coalesce(p_numero_nota_fiscal,'')),''),p_data_nota_fiscal,nullif(trim(coalesce(p_descricao,'')),''),p_idempotency_key,'PENDENTE_CLASSIFICACAO',0) RETURNING * INTO v_receb;
 INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
 VALUES(p_empresa_id,'entrada','recebimento_administradora',v_receb.id,p_data_recebimento,p_competencia,p_valor_total,'Recebimento real da Administradora - '||p_competencia);
 RETURN jsonb_build_object('recebimento',to_jsonb(v_receb),'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_conciliar_recebimento_manual(
 p_empresa_id uuid,p_recebimento_id uuid,p_itens jsonb,p_classificacoes jsonb,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_receb record;v_prev record;v_item jsonb;v_class jsonb;v_valor numeric;v_novo numeric;v_existente numeric;v_novo_total numeric;v_hash text;v_idem record;v_status text;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF jsonb_typeof(p_itens)<>'array' OR jsonb_typeof(p_classificacoes)<>'array' THEN RAISE EXCEPTION 'Itens e classificações devem ser listas';END IF;
 IF jsonb_array_length(p_itens)+jsonb_array_length(p_classificacoes)=0 THEN RAISE EXCEPTION 'Informe ao menos uma conciliação/classificação';END IF;
 v_hash:=md5(p_recebimento_id::text||p_itens::text||p_classificacoes::text);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CONCILIAR:'||p_idempotency_key,0));
 SELECT * INTO v_idem FROM public.financeiro_recebimento_conciliacoes WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF v_idem.id IS NOT NULL THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Chave reutilizada com dados diferentes';END IF;RETURN jsonb_build_object('recebimento_id',p_recebimento_id,'reused',true);END IF;
 SELECT * INTO v_receb FROM public.financeiro_recebimentos WHERE id=p_recebimento_id AND empresa_id=p_empresa_id AND origem_registro='MANUAL' AND status='confirmado' FOR UPDATE;
 IF v_receb.id IS NULL THEN RAISE EXCEPTION 'Recebimento manual não encontrado';END IF;
 SELECT coalesce(sum(valor_liquidado),0)+(SELECT coalesce(sum(valor),0) FROM public.financeiro_recebimento_classificacoes WHERE recebimento_id=p_recebimento_id) INTO v_existente FROM public.financeiro_recebimento_itens WHERE recebimento_id=p_recebimento_id;
 SELECT coalesce(sum((s.e->>'valor')::numeric),0) INTO v_novo_total FROM (SELECT e FROM jsonb_array_elements(p_itens)e UNION ALL SELECT e FROM jsonb_array_elements(p_classificacoes)e)s;
 IF v_novo_total<=0 OR v_existente+v_novo_total>v_receb.valor_total THEN RAISE EXCEPTION 'Classificação excede o saldo do recebimento';END IF;
 FOR v_item IN SELECT e FROM jsonb_array_elements(p_itens)e LOOP
  v_valor:=(v_item->>'valor')::numeric;
  SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=(v_item->>'previsao_franquia_id')::uuid FOR UPDATE;
  IF v_valor<=0 OR v_prev.id IS NULL OR v_prev.empresa_id<>p_empresa_id OR v_prev.administradora_id<>v_receb.administradora_id THEN RAISE EXCEPTION 'Previsão inválida para este recebimento';END IF;
  v_novo:=v_prev.valor_liquidado+v_valor; IF v_novo>v_prev.valor_previsto THEN RAISE EXCEPTION 'Valor excede o saldo da previsão';END IF;
  INSERT INTO public.financeiro_recebimento_itens(recebimento_id,previsao_franquia_id,valor_liquidado) VALUES(v_receb.id,v_prev.id,v_valor);
  UPDATE public.comissao_previsoes_franquia SET valor_liquidado=v_novo,status=CASE WHEN v_novo=valor_previsto THEN 'liquidada' ELSE 'parcialmente_liquidada' END,updated_at=now() WHERE id=v_prev.id;
  UPDATE public.comissao_previsoes_participantes p SET
    valor_elegivel=round(p.valor_previsto*v_novo/v_prev.valor_previsto,2),
    status=CASE WHEN p.valor_pago>=p.valor_previsto THEN 'paga' WHEN p.valor_pago>0 THEN 'parcialmente_paga' WHEN round(p.valor_previsto*v_novo/v_prev.valor_previsto,2)=p.valor_previsto THEN 'elegivel' WHEN round(p.valor_previsto*v_novo/v_prev.valor_previsto,2)>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,
    updated_at=now()
   WHERE p.venda_id=v_prev.venda_id AND p.ordem_etapa=v_prev.ordem_etapa AND p.competencia=v_prev.competencia AND coalesce(p.snapshot_regra->>'modo','AUTOMATICA')<>'MANUAL';
 END LOOP;
 FOR v_class IN SELECT e FROM jsonb_array_elements(p_classificacoes)e LOOP
  v_valor:=(v_class->>'valor')::numeric;
  INSERT INTO public.financeiro_recebimento_classificacoes(empresa_id,recebimento_id,tipo,valor,descricao,created_by_usuario_id)
   VALUES(p_empresa_id,v_receb.id,v_class->>'tipo',v_valor,nullif(trim(coalesce(v_class->>'descricao','')),''),public.current_usuario_id());
 END LOOP;
 v_novo_total:=v_existente+v_novo_total;
 v_status:=CASE WHEN v_novo_total=v_receb.valor_total THEN 'CONCILIADO' WHEN v_novo_total>0 THEN 'PARCIALMENTE_CONCILIADO' ELSE 'PENDENTE_CLASSIFICACAO' END;
 UPDATE public.financeiro_recebimentos SET valor_classificado=v_novo_total,conciliacao_status=v_status,updated_at=now() WHERE id=v_receb.id;
 INSERT INTO public.financeiro_recebimento_conciliacoes(empresa_id,recebimento_id,idempotency_key,payload_hash,created_by_usuario_id) VALUES(p_empresa_id,v_receb.id,p_idempotency_key,v_hash,public.current_usuario_id());
 RETURN jsonb_build_object('recebimento_id',v_receb.id,'valor_classificado',v_novo_total,'saldo',v_receb.valor_total-v_novo_total,'status',v_status,'reused',false);
END $$;

CREATE TABLE public.cota_estrategias_lance (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 cota_definitiva_id uuid NOT NULL REFERENCES public.cotas_definitivas(id) ON DELETE RESTRICT,
 lance_fixo_ativo boolean NOT NULL DEFAULT false,lance_fixo_percentual numeric(8,4),lance_fixo_valor numeric(15,2),lance_fixo_inicio date,lance_fixo_fim date,
 lance_livre_ativo boolean NOT NULL DEFAULT false,lance_livre_valor numeric(15,2),lance_livre_percentual numeric(8,4),lance_livre_inicio date,lance_livre_fim date,
 recurso_proprio_valor numeric(15,2),lance_embutido_percentual numeric(8,4),lance_embutido_valor numeric(15,2),parcela_reduzida_ativa boolean NOT NULL DEFAULT false,
 observacoes text,ativa boolean NOT NULL DEFAULT true,updated_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cota_definitiva_id),UNIQUE(id,empresa_id),
 CHECK(lance_fixo_fim IS NULL OR lance_fixo_inicio IS NOT NULL AND lance_fixo_fim>=lance_fixo_inicio),
 CHECK(lance_livre_fim IS NULL OR lance_livre_inicio IS NOT NULL AND lance_livre_fim>=lance_livre_inicio),
 CHECK(coalesce(lance_fixo_percentual,0)>=0 AND coalesce(lance_fixo_valor,0)>=0 AND coalesce(lance_livre_valor,0)>=0 AND coalesce(lance_embutido_percentual,0)>=0)
);
CREATE TABLE public.cota_estrategias_lance_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 estrategia_id uuid NOT NULL REFERENCES public.cota_estrategias_lance(id) ON DELETE RESTRICT,cota_definitiva_id uuid NOT NULL REFERENCES public.cotas_definitivas(id) ON DELETE RESTRICT,
 estado_anterior jsonb,estado_novo jsonb NOT NULL,motivo text,usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.rpc_salvar_estrategia_lance(
 p_empresa_id uuid,p_cota_id uuid,p_dados jsonb,p_motivo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_cota record;v_grupo record;v_atual record;v_novo record;v_emb numeric;v_livre numeric;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id=p_cota_id AND empresa_id=p_empresa_id FOR UPDATE;
 IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Cota não encontrada no tenant';END IF;
 SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=v_cota.grupo_id;
 v_emb:=nullif(p_dados->>'lance_embutido_percentual','')::numeric;
 IF coalesce(v_emb,0)>0 AND (NOT coalesce(v_grupo.permite_lance_embutido,false) OR v_emb>coalesce(v_grupo.percentual_lance_embutido,0)) THEN RAISE EXCEPTION 'Lance embutido excede o limite permitido pelo Grupo';END IF;
 v_livre:=nullif(p_dados->>'lance_livre_valor','')::numeric;
 SELECT * INTO v_atual FROM public.cota_estrategias_lance WHERE cota_definitiva_id=p_cota_id FOR UPDATE;
 INSERT INTO public.cota_estrategias_lance(empresa_id,cota_definitiva_id,lance_fixo_ativo,lance_fixo_percentual,lance_fixo_valor,lance_fixo_inicio,lance_fixo_fim,lance_livre_ativo,lance_livre_valor,lance_livre_percentual,lance_livre_inicio,lance_livre_fim,recurso_proprio_valor,lance_embutido_percentual,lance_embutido_valor,parcela_reduzida_ativa,observacoes,ativa,updated_by_usuario_id)
 VALUES(p_empresa_id,p_cota_id,coalesce((p_dados->>'lance_fixo_ativo')::boolean,false),nullif(p_dados->>'lance_fixo_percentual','')::numeric,nullif(p_dados->>'lance_fixo_valor','')::numeric,nullif(p_dados->>'lance_fixo_inicio','')::date,nullif(p_dados->>'lance_fixo_fim','')::date,coalesce((p_dados->>'lance_livre_ativo')::boolean,false),v_livre,CASE WHEN v_livre IS NOT NULL AND v_cota.valor_credito>0 THEN round(v_livre/v_cota.valor_credito*100,4) END,nullif(p_dados->>'lance_livre_inicio','')::date,nullif(p_dados->>'lance_livre_fim','')::date,nullif(p_dados->>'recurso_proprio_valor','')::numeric,v_emb,CASE WHEN v_emb IS NOT NULL THEN round(v_cota.valor_credito*v_emb/100,2) END,coalesce((p_dados->>'parcela_reduzida_ativa')::boolean,false),nullif(trim(coalesce(p_dados->>'observacoes','')),''),coalesce((p_dados->>'ativa')::boolean,true),public.current_usuario_id())
 ON CONFLICT(cota_definitiva_id) DO UPDATE SET lance_fixo_ativo=excluded.lance_fixo_ativo,lance_fixo_percentual=excluded.lance_fixo_percentual,lance_fixo_valor=excluded.lance_fixo_valor,lance_fixo_inicio=excluded.lance_fixo_inicio,lance_fixo_fim=excluded.lance_fixo_fim,lance_livre_ativo=excluded.lance_livre_ativo,lance_livre_valor=excluded.lance_livre_valor,lance_livre_percentual=excluded.lance_livre_percentual,lance_livre_inicio=excluded.lance_livre_inicio,lance_livre_fim=excluded.lance_livre_fim,recurso_proprio_valor=excluded.recurso_proprio_valor,lance_embutido_percentual=excluded.lance_embutido_percentual,lance_embutido_valor=excluded.lance_embutido_valor,parcela_reduzida_ativa=excluded.parcela_reduzida_ativa,observacoes=excluded.observacoes,ativa=excluded.ativa,updated_by_usuario_id=excluded.updated_by_usuario_id,updated_at=now() RETURNING * INTO v_novo;
 INSERT INTO public.cota_estrategias_lance_historico(empresa_id,estrategia_id,cota_definitiva_id,estado_anterior,estado_novo,motivo,usuario_id) VALUES(p_empresa_id,v_novo.id,p_cota_id,CASE WHEN v_atual.id IS NULL THEN NULL ELSE to_jsonb(v_atual)-'id'-'empresa_id'-'cota_definitiva_id' END,to_jsonb(v_novo)-'id'-'empresa_id'-'cota_definitiva_id',nullif(trim(coalesce(p_motivo,'')),''),public.current_usuario_id());
 RETURN to_jsonb(v_novo);
END $$;

ALTER TABLE public.administradora_tipo_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_recebimento_classificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_recebimento_conciliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cota_estrategias_lance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cota_estrategias_lance_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY administradora_tipo_aliases_platform_read ON public.administradora_tipo_aliases FOR SELECT TO authenticated USING(public.is_platform_superadmin());
CREATE POLICY financeiro_recebimento_classificacoes_read ON public.financeiro_recebimento_classificacoes FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY financeiro_recebimento_conciliacoes_read ON public.financeiro_recebimento_conciliacoes FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY cota_estrategias_lance_read ON public.cota_estrategias_lance FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY cota_estrategias_lance_historico_read ON public.cota_estrategias_lance_historico FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));

REVOKE ALL ON TABLE public.administradora_tipo_aliases,public.financeiro_recebimento_classificacoes,public.financeiro_recebimento_conciliacoes,public.cota_estrategias_lance,public.cota_estrategias_lance_historico FROM PUBLIC,anon;
GRANT SELECT ON TABLE public.administradora_tipo_aliases,public.financeiro_recebimento_classificacoes,public.financeiro_recebimento_conciliacoes,public.cota_estrategias_lance,public.cota_estrategias_lance_historico TO authenticated;
GRANT ALL ON TABLE public.administradora_tipo_aliases,public.financeiro_recebimento_classificacoes,public.financeiro_recebimento_conciliacoes,public.cota_estrategias_lance,public.cota_estrategias_lance_historico TO service_role;
REVOKE ALL ON FUNCTION public.rpc_salvar_tipo_administradora(uuid,text,boolean,uuid),public.rpc_salvar_modalidade_administradora(uuid,text,text,boolean,uuid),public.rpc_salvar_curva_estorno(uuid,text,date,jsonb,uuid,boolean),public.rpc_salvar_configuracao_fiscal(uuid,numeric,date,date,boolean),public.rpc_registrar_recebimento_manual(uuid,uuid,text,numeric,date,text,text,uuid,text,date,text,text),public.rpc_conciliar_recebimento_manual(uuid,uuid,jsonb,jsonb,text),public.rpc_salvar_estrategia_lance(uuid,uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_tipo_administradora(uuid,text,boolean,uuid),public.rpc_salvar_modalidade_administradora(uuid,text,text,boolean,uuid),public.rpc_salvar_curva_estorno(uuid,text,date,jsonb,uuid,boolean),public.rpc_salvar_configuracao_fiscal(uuid,numeric,date,date,boolean),public.rpc_registrar_recebimento_manual(uuid,uuid,text,numeric,date,text,text,uuid,text,date,text,text),public.rpc_conciliar_recebimento_manual(uuid,uuid,jsonb,jsonb,text),public.rpc_salvar_estrategia_lance(uuid,uuid,jsonb,text) TO authenticated,service_role;

COMMIT;
