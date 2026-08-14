-- 076: ERP — comissões, grupos, contemplação e governança V2.
-- Forward-only. Estende 060–063; fatos históricos e vendas sem configuração V2
-- continuam no motor legado original.

BEGIN;

CREATE TABLE public.administradora_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (administradora_id, codigo),
  CHECK (codigo = upper(trim(codigo)) AND length(trim(nome)) > 0)
);

CREATE TABLE public.administradora_modalidades_comissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (administradora_id, codigo),
  CHECK (codigo = upper(trim(codigo)) AND length(trim(nome)) > 0)
);

CREATE TABLE public.empresa_configuracoes_fiscais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  percentual_imposto numeric(7,4) NOT NULL CHECK (percentual_imposto >= 0 AND percentual_imposto < 100),
  participante_exibe_detalhes_fiscais boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE TABLE public.administradora_curvas_estorno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  nome text NOT NULL,
  versao integer NOT NULL CHECK (versao > 0),
  vigencia_inicio date NOT NULL,
  vigencia_fim date,
  ativa boolean NOT NULL DEFAULT true,
  encerra_na_contemplacao boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio),
  UNIQUE (administradora_id, nome, versao)
);

CREATE TABLE public.administradora_curva_estorno_faixas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curva_id uuid NOT NULL REFERENCES public.administradora_curvas_estorno(id) ON DELETE RESTRICT,
  mes_relativo integer NOT NULL CHECK (mes_relativo > 0),
  percentual_estorno numeric(7,4) NOT NULL CHECK (percentual_estorno >= 0 AND percentual_estorno <= 100),
  UNIQUE (curva_id, mes_relativo)
);

ALTER TABLE public.comissao_programas
  ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'RASCUNHO',
  ADD COLUMN IF NOT EXISTS programa_origem_id uuid REFERENCES public.comissao_programas(id) ON DELETE RESTRICT;
ALTER TABLE public.metas_comerciais DROP CONSTRAINT IF EXISTS metas_comerciais_indicador_check;
ALTER TABLE public.metas_comerciais ADD CONSTRAINT metas_comerciais_indicador_check CHECK(indicador IN ('valor_credito_vendido','quantidade_vendas','propostas_criadas','receita_prevista_franquia','receita_recebida','comissao_liquida_participante'));
ALTER TABLE public.comissao_programas DROP CONSTRAINT IF EXISTS comissao_programas_status_v2_check;
ALTER TABLE public.comissao_programas ADD CONSTRAINT comissao_programas_status_v2_check
  CHECK (status IN ('RASCUNHO','ATIVO','INATIVO'));

ALTER TABLE public.comissao_regras_franquia
  ADD COLUMN IF NOT EXISTS tipo_administradora_id uuid REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS modalidade_comissao_id uuid REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_regras_participantes
  ADD COLUMN IF NOT EXISTS tipo_administradora_id uuid REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS modalidade_comissao_id uuid REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS modo_regra text NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS base_v2 text,
  ADD COLUMN IF NOT EXISTS fonte_comissao text NOT NULL DEFAULT 'FRANQUEADORA';
ALTER TABLE public.comissao_regras_participantes DROP CONSTRAINT IF EXISTS comissao_regra_participante_modo_v2_check;
ALTER TABLE public.comissao_regras_participantes ADD CONSTRAINT comissao_regra_participante_modo_v2_check CHECK (
  modo_regra IN ('AUTOMATICA','MANUAL') AND
  (base_v2 IS NULL OR base_v2 IN ('COMISSAO_FRANQUEADORA_LIQUIDA','VALOR_VENDIDO')) AND
  fonte_comissao IN ('FRANQUEADORA','PARTICIPANTE_PRINCIPAL')
);

CREATE TABLE public.comissao_regra_etapas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_franquia_id uuid NOT NULL REFERENCES public.comissao_regras_franquia(id) ON DELETE RESTRICT,
  ordem integer NOT NULL CHECK (ordem > 0),
  tipo_gatilho text NOT NULL CHECK (tipo_gatilho IN ('MES_RELATIVO','CONTEMPLACAO')),
  mes_relativo integer,
  nome text NOT NULL,
  percentual_venda numeric(7,4) NOT NULL CHECK (percentual_venda > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regra_franquia_id, ordem),
  CHECK (
    (tipo_gatilho = 'MES_RELATIVO' AND mes_relativo > 0) OR
    (tipo_gatilho = 'CONTEMPLACAO' AND mes_relativo IS NULL)
  )
);
CREATE UNIQUE INDEX comissao_regra_etapa_contemplacao_uidx
  ON public.comissao_regra_etapas(regra_franquia_id) WHERE tipo_gatilho = 'CONTEMPLACAO';

ALTER TABLE public.grupos_consorcio
  ADD COLUMN IF NOT EXISTS empresa_origem_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS tipo_administradora_id uuid REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS modalidade_comissao_id uuid REFERENCES public.administradora_modalidades_comissao(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS origem_governanca text NOT NULL DEFAULT 'LEGADO',
  ADD COLUMN IF NOT EXISTS status_governanca text NOT NULL DEFAULT 'CONFIGURACAO_PENDENTE',
  ADD COLUMN IF NOT EXISTS usar_regra_personalizada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regra_personalizada_vigencia_inicio date,
  ADD COLUMN IF NOT EXISTS regra_personalizada_vigencia_fim date,
  ADD COLUMN IF NOT EXISTS regra_personalizada_versao integer;
ALTER TABLE public.grupos_consorcio DROP CONSTRAINT IF EXISTS grupos_governanca_v2_check;
ALTER TABLE public.grupos_consorcio ADD CONSTRAINT grupos_governanca_v2_check CHECK (
  origem_governanca IN ('LEGADO','LOCAL','GLOBAL') AND
  status_governanca IN ('CONFIGURACAO_PENDENTE','PENDENTE_PLATFORM','LOCAL','GLOBAL') AND
  ((origem_governanca='LOCAL' AND empresa_origem_id IS NOT NULL) OR (origem_governanca IN ('LEGADO','GLOBAL') AND empresa_origem_id IS NULL)) AND
  (regra_personalizada_vigencia_fim IS NULL OR regra_personalizada_vigencia_fim >= regra_personalizada_vigencia_inicio)
);

CREATE TABLE public.grupos_governanca_historico (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
 empresa_origem_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT, evento text NOT NULL CHECK(evento IN ('CRIADO_LOCAL','PROMOVIDO_GLOBAL','MANTIDO_LOCAL')),
 usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL, observacao text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.grupo_governanca_v2_before_write()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$ BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.origem_governanca='GLOBAL' AND NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform cria grupo global'; END IF;
  IF NEW.origem_governanca='LOCAL' AND NOT public.can_write_tenant_internal(NEW.empresa_origem_id) THEN RAISE EXCEPTION 'Grupo local pertence a outro tenant'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER grupos_governanca_v2_guard BEFORE INSERT OR UPDATE OF empresa_origem_id,origem_governanca,status_governanca ON public.grupos_consorcio FOR EACH ROW EXECUTE FUNCTION public.grupo_governanca_v2_before_write();

CREATE OR REPLACE FUNCTION public.rpc_decidir_governanca_grupo(p_grupo_id uuid,p_decisao text,p_observacao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE v_grupo record; BEGIN
 IF NOT public.is_platform_superadmin() THEN RAISE EXCEPTION 'Somente Platform decide governança de grupos'; END IF;
 SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=p_grupo_id FOR UPDATE;
 IF v_grupo.id IS NULL OR v_grupo.origem_governanca<>'LOCAL' THEN RAISE EXCEPTION 'Grupo local não encontrado'; END IF;
 IF upper(p_decisao)='PROMOVER_GLOBAL' THEN
  UPDATE public.grupos_consorcio SET origem_governanca='GLOBAL',status_governanca='GLOBAL',empresa_origem_id=NULL,updated_at=now() WHERE id=p_grupo_id;
  INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao) VALUES(p_grupo_id,v_grupo.empresa_origem_id,'PROMOVIDO_GLOBAL',public.current_usuario_id(),p_observacao);
 ELSIF upper(p_decisao)='MANTER_LOCAL' THEN
  UPDATE public.grupos_consorcio SET status_governanca='LOCAL',updated_at=now() WHERE id=p_grupo_id;
  INSERT INTO public.grupos_governanca_historico(grupo_id,empresa_origem_id,evento,usuario_id,observacao) VALUES(p_grupo_id,v_grupo.empresa_origem_id,'MANTIDO_LOCAL',public.current_usuario_id(),p_observacao);
 ELSE RAISE EXCEPTION 'Decisão inválida'; END IF;
 RETURN (SELECT to_jsonb(g) FROM public.grupos_consorcio g WHERE id=p_grupo_id);
END $$;

ALTER TABLE public.cotas_definitivas
  ADD COLUMN IF NOT EXISTS contemplada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_contemplacao date,
  ADD COLUMN IF NOT EXISTS valor_credito_contemplacao numeric(15,2),
  ADD COLUMN IF NOT EXISTS tipo_contemplacao text,
  ADD COLUMN IF NOT EXISTS observacao_contemplacao text,
  ADD COLUMN IF NOT EXISTS contemplacao_atualizada_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contemplacao_atualizada_em timestamptz;
ALTER TABLE public.cotas_definitivas DROP CONSTRAINT IF EXISTS cotas_contemplacao_v2_check;
ALTER TABLE public.cotas_definitivas ADD CONSTRAINT cotas_contemplacao_v2_check CHECK (
  (NOT contemplada AND data_contemplacao IS NULL AND valor_credito_contemplacao IS NULL AND tipo_contemplacao IS NULL)
  OR
  (contemplada AND data_contemplacao IS NOT NULL AND valor_credito_contemplacao > 0 AND tipo_contemplacao IN ('SORTEIO','LANCE','OUTRO'))
);

CREATE TABLE public.cota_contemplacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cota_definitiva_id uuid NOT NULL REFERENCES public.cotas_definitivas(id) ON DELETE RESTRICT,
  venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE RESTRICT,
  data_contemplacao date NOT NULL,
  tipo_contemplacao text NOT NULL CHECK (tipo_contemplacao IN ('SORTEIO','LANCE','OUTRO')),
  valor_credito_contemplacao numeric(15,2) NOT NULL CHECK (valor_credito_contemplacao > 0),
  observacao text,
  registrado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cota_definitiva_id),
  UNIQUE (id, empresa_id)
);

CREATE TABLE public.financeiro_estornos_curva (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 venda_id uuid NOT NULL REFERENCES public.vendas(id) ON DELETE RESTRICT, beneficiario_tipo text NOT NULL CHECK(beneficiario_tipo IN ('FRANQUEADORA','PARTICIPANTE','ORGANIZACAO')),
 participante_comercial_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT, organizacao_parceira_id uuid REFERENCES public.organizacoes_parceiras(id) ON DELETE RESTRICT,
 previsao_franquia_id uuid REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT, previsao_participante_id uuid REFERENCES public.comissao_previsoes_participantes(id) ON DELETE RESTRICT,
 mes_relativo integer NOT NULL, percentual_curva numeric(7,4) NOT NULL, valor_efetivamente_recebido numeric(15,2) NOT NULL, valor_estorno numeric(15,2) NOT NULL,
 motivo text NOT NULL,idempotency_key text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(empresa_id,idempotency_key),
 CHECK(valor_estorno>=0 AND valor_estorno<=valor_efetivamente_recebido)
);

-- Pendencias preservam a competencia original. Transferencias e compensacoes sao
-- movimentos append-only; o saldo e sempre derivado da soma dos movimentos.
CREATE TABLE public.financeiro_pendencias_recebimento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
 previsao_franquia_id uuid NOT NULL REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT,
 competencia_original text NOT NULL, competencia_destino text NOT NULL,
 valor_original numeric(15,2) NOT NULL CHECK(valor_original>0), motivo text NOT NULL,
 criada_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
 idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,idempotency_key), CHECK(competencia_original ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 CHECK(competencia_destino ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
CREATE UNIQUE INDEX financeiro_pendencia_previsao_aberta_uidx
 ON public.financeiro_pendencias_recebimento(previsao_franquia_id);

CREATE TABLE public.financeiro_pendencia_movimentos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 pendencia_id uuid NOT NULL REFERENCES public.financeiro_pendencias_recebimento(id) ON DELETE RESTRICT,
 tipo text NOT NULL CHECK(tipo IN ('TRANSFERENCIA','COMPENSACAO')),
 valor numeric(15,2) NOT NULL CHECK(valor>0), recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
 divergencia_id uuid, observacao text, idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,idempotency_key)
);

CREATE TABLE public.financeiro_divergencias_recebimento (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
 administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
 previsao_franquia_id uuid NOT NULL REFERENCES public.comissao_previsoes_franquia(id) ON DELETE RESTRICT,
 recebimento_base_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
 competencia text NOT NULL, valor_previsto_saldo numeric(15,2) NOT NULL CHECK(valor_previsto_saldo>=0),
 valor_recebido numeric(15,2) NOT NULL CHECK(valor_recebido>0), valor_excedente numeric(15,2) NOT NULL CHECK(valor_excedente>0),
 valor_compensado_pendencia numeric(15,2) NOT NULL DEFAULT 0 CHECK(valor_compensado_pendencia>=0),
 motivo text NOT NULL, observacao text NOT NULL, pendencia_compensada_id uuid REFERENCES public.financeiro_pendencias_recebimento(id) ON DELETE RESTRICT,
 registrado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
 idempotency_key text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(empresa_id,idempotency_key), CHECK(competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
ALTER TABLE public.financeiro_pendencia_movimentos
 ADD CONSTRAINT financeiro_pendencia_movimentos_divergencia_fkey FOREIGN KEY(divergencia_id)
 REFERENCES public.financeiro_divergencias_recebimento(id) ON DELETE RESTRICT;

ALTER TABLE public.comissao_previsoes_franquia
  ADD COLUMN IF NOT EXISTS tipo_gatilho text NOT NULL DEFAULT 'MES_RELATIVO',
  ADD COLUMN IF NOT EXISTS evento_origem_id uuid REFERENCES public.cota_contemplacoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS valor_bruto numeric(15,2),
  ADD COLUMN IF NOT EXISTS percentual_imposto numeric(7,4),
  ADD COLUMN IF NOT EXISTS valor_imposto numeric(15,2),
  ADD COLUMN IF NOT EXISTS valor_liquido numeric(15,2);
ALTER TABLE public.comissao_previsoes_franquia DROP CONSTRAINT IF EXISTS comissao_previsao_franquia_gatilho_v2_check;
ALTER TABLE public.comissao_previsoes_franquia ADD CONSTRAINT comissao_previsao_franquia_gatilho_v2_check CHECK (
  tipo_gatilho IN ('MES_RELATIVO','CONTEMPLACAO') AND
  ((tipo_gatilho = 'MES_RELATIVO' AND evento_origem_id IS NULL) OR (tipo_gatilho = 'CONTEMPLACAO' AND evento_origem_id IS NOT NULL))
);
CREATE UNIQUE INDEX comissao_previsao_franquia_contemplacao_uidx
  ON public.comissao_previsoes_franquia(venda_id) WHERE tipo_gatilho = 'CONTEMPLACAO';

ALTER TABLE public.comissao_previsoes_participantes
  ADD COLUMN IF NOT EXISTS tipo_gatilho text NOT NULL DEFAULT 'MES_RELATIVO',
  ADD COLUMN IF NOT EXISTS evento_origem_id uuid REFERENCES public.cota_contemplacoes(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS conferido_por_participante boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS conferido_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX comissao_previsao_participante_contemplacao_uidx
  ON public.comissao_previsoes_participantes(venda_id, participante_comercial_id)
  WHERE tipo_gatilho = 'CONTEMPLACAO' AND participante_comercial_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.comissao_v2_gerar_participante_automatico(p_previsao_franquia_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_f record; v_venda record; v_regra record; v_count integer; v_valor numeric;
BEGIN
  SELECT * INTO v_f FROM public.comissao_previsoes_franquia WHERE id=p_previsao_franquia_id;
  IF v_f.id IS NULL THEN RAISE EXCEPTION 'Previsão da Franqueadora não encontrada'; END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id=v_f.venda_id;
  IF v_venda.participante_comercial_id IS NULL THEN RETURN; END IF;
  SELECT r.* INTO v_regra FROM public.comissao_regras_participantes r
  WHERE r.empresa_id=v_f.empresa_id AND r.programa_id=(SELECT programa_id FROM public.comissao_regras_franquia WHERE id=v_f.regra_franquia_id)
    AND r.ativa AND r.configuracao_homologada AND r.modo_regra='AUTOMATICA'
    AND r.base_v2='COMISSAO_FRANQUEADORA_LIQUIDA'
    AND (r.participante_comercial_id IS NULL OR r.participante_comercial_id=v_venda.participante_comercial_id)
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id=(v_venda.snapshot_venda->>'tipo_administradora_id')::uuid)
    AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id=(v_venda.snapshot_venda->>'modalidade_comissao_id')::uuid)
    AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date)
  ORDER BY (r.participante_comercial_id IS NOT NULL) DESC,(r.tipo_administradora_id IS NOT NULL) DESC,(r.modalidade_comissao_id IS NOT NULL) DESC,r.versao DESC LIMIT 1;
  IF v_regra.id IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_count FROM public.comissao_regras_participantes r
  WHERE r.empresa_id=v_f.empresa_id AND r.programa_id=v_regra.programa_id AND r.ativa AND r.configuracao_homologada
    AND r.modo_regra='AUTOMATICA' AND r.base_v2='COMISSAO_FRANQUEADORA_LIQUIDA'
    AND COALESCE(r.participante_comercial_id,v_venda.participante_comercial_id)=v_venda.participante_comercial_id
    AND (r.participante_comercial_id IS NOT NULL)=(v_regra.participante_comercial_id IS NOT NULL)
    AND COALESCE(r.tipo_administradora_id,(v_venda.snapshot_venda->>'tipo_administradora_id')::uuid)=(v_venda.snapshot_venda->>'tipo_administradora_id')::uuid
    AND (r.tipo_administradora_id IS NOT NULL)=(v_regra.tipo_administradora_id IS NOT NULL)
    AND COALESCE(r.modalidade_comissao_id,(v_venda.snapshot_venda->>'modalidade_comissao_id')::uuid)=(v_venda.snapshot_venda->>'modalidade_comissao_id')::uuid
    AND (r.modalidade_comissao_id IS NOT NULL)=(v_regra.modalidade_comissao_id IS NOT NULL)
    AND r.versao=v_regra.versao AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date);
  IF v_count<>1 THEN RAISE EXCEPTION 'Regras automáticas de participante ambíguas'; END IF;
  v_valor:=round(COALESCE(v_f.valor_liquido,v_f.valor_previsto)*v_regra.percentual_comissao/100,2);
  INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho,evento_origem_id)
  VALUES(v_f.empresa_id,v_f.venda_id,v_f.cota_definitiva_id,v_venda.participante_comercial_id,v_regra.id,v_f.ordem_etapa,v_f.nome_etapa,v_f.competencia,COALESCE(v_f.valor_liquido,v_f.valor_previsto),v_regra.percentual_comissao,v_valor,'prevista',jsonb_build_object('fonte_previsao_franquia_id',v_f.id,'fonte_liquida',true,'imposto_antes_divisao',v_f.valor_imposto,'regra_id',v_regra.id),v_f.tipo_gatilho,v_f.evento_origem_id);
END $$;

CREATE OR REPLACE FUNCTION public.comissao_v2_gerar_participante_manual(p_venda_id uuid,p_regra_franquia_id uuid,p_imposto numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_venda record;v_grupo record;v_principal record;v_secundario record;v_regra record;v_regra_sec record;
 v_count integer;v_fonte_potencial numeric;v_total_bruto numeric;v_total_principal numeric;v_total_sec numeric:=0;
 v_etapa jsonb;v_valor numeric;v_comp text;v_ordem integer;
BEGIN
 SELECT * INTO v_venda FROM public.vendas WHERE id=p_venda_id;
 SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=v_venda.grupo_id;
 SELECT * INTO v_principal FROM public.venda_participantes WHERE venda_id=p_venda_id AND papel='MICROFRANQUIA_PRINCIPAL';
 IF v_principal.id IS NULL THEN v_principal.participante_comercial_id:=v_venda.participante_comercial_id;END IF;
 IF v_principal.participante_comercial_id IS NULL OR EXISTS(SELECT 1 FROM public.comissao_previsoes_participantes WHERE venda_id=p_venda_id) THEN RETURN;END IF;
 SELECT r.* INTO v_regra FROM public.comissao_regras_participantes r
 WHERE r.empresa_id=v_venda.empresa_id AND r.programa_id=(SELECT programa_id FROM public.comissao_regras_franquia WHERE id=p_regra_franquia_id)
  AND r.ativa AND r.configuracao_homologada AND r.modo_regra='MANUAL'
  AND (r.participante_comercial_id IS NULL OR r.participante_comercial_id=v_principal.participante_comercial_id)
  AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id=v_grupo.tipo_administradora_id)
  AND (r.modalidade_comissao_id IS NULL OR r.modalidade_comissao_id=v_grupo.modalidade_comissao_id)
  AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date)
 ORDER BY (r.participante_comercial_id IS NOT NULL) DESC,(r.tipo_administradora_id IS NOT NULL) DESC,(r.modalidade_comissao_id IS NOT NULL) DESC,r.versao DESC LIMIT 1;
 IF v_regra.id IS NULL THEN RETURN;END IF;
 SELECT count(*) INTO v_count FROM public.comissao_regras_participantes r WHERE r.empresa_id=v_venda.empresa_id AND r.programa_id=v_regra.programa_id
  AND r.ativa AND r.configuracao_homologada AND r.modo_regra='MANUAL' AND r.versao=v_regra.versao
  AND COALESCE(r.participante_comercial_id,v_principal.participante_comercial_id)=v_principal.participante_comercial_id
  AND (r.participante_comercial_id IS NOT NULL)=(v_regra.participante_comercial_id IS NOT NULL)
  AND COALESCE(r.tipo_administradora_id,v_grupo.tipo_administradora_id)=v_grupo.tipo_administradora_id
  AND (r.tipo_administradora_id IS NOT NULL)=(v_regra.tipo_administradora_id IS NOT NULL)
  AND COALESCE(r.modalidade_comissao_id,v_grupo.modalidade_comissao_id)=v_grupo.modalidade_comissao_id
  AND (r.modalidade_comissao_id IS NOT NULL)=(v_regra.modalidade_comissao_id IS NOT NULL)
  AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date);
 IF v_count<>1 THEN RAISE EXCEPTION 'Regras manuais de participante ambiguas';END IF;
 SELECT round(v_venda.valor_credito*sum(e.percentual_venda)/100*(100-p_imposto)/100,2) INTO v_fonte_potencial
 FROM public.comissao_regra_etapas e WHERE e.regra_franquia_id=p_regra_franquia_id;
 v_total_bruto:=round(CASE WHEN v_regra.base_v2='VALOR_VENDIDO' THEN v_venda.valor_credito ELSE v_fonte_potencial END*v_regra.percentual_comissao/100,2);
 SELECT * INTO v_secundario FROM public.venda_participantes WHERE venda_id=p_venda_id AND papel='PARTICIPANTE_SECUNDARIO';
 IF v_secundario.id IS NOT NULL THEN
  SELECT r.* INTO v_regra_sec FROM public.comissao_regras_participantes r WHERE r.empresa_id=v_venda.empresa_id AND r.programa_id=v_regra.programa_id
   AND r.ativa AND r.configuracao_homologada AND r.modo_regra='MANUAL' AND r.fonte_comissao='PARTICIPANTE_PRINCIPAL'
   AND r.participante_comercial_id=v_secundario.participante_comercial_id
   AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date)
   ORDER BY r.versao DESC LIMIT 1;
  IF v_regra_sec.id IS NOT NULL THEN v_total_sec:=round(v_total_bruto*v_regra_sec.percentual_comissao/100,2);
  ELSE v_total_sec:=round(v_total_bruto*COALESCE(v_secundario.fracao_comissao_percentual,0)/100,2);END IF;
 END IF;
 v_total_principal:=v_total_bruto-v_total_sec;
 FOR v_etapa IN SELECT value FROM jsonb_array_elements(v_regra.etapas_cronograma) LOOP
  v_ordem:=(v_etapa->>'ordem')::integer;v_valor:=round(v_total_principal*(v_etapa->>'percentual_etapa')::numeric/100,2);
  v_comp:=to_char(date_trunc('month',v_venda.data_venda)+make_interval(months=>(v_etapa->>'mes_relativo')::integer-1),'YYYY-MM');
  INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
  VALUES(v_venda.empresa_id,p_venda_id,(SELECT id FROM public.cotas_definitivas WHERE venda_id=p_venda_id),v_principal.participante_comercial_id,v_regra.id,v_ordem,COALESCE(v_etapa->>'nome',v_ordem||'a parcela'),v_comp,CASE WHEN v_regra.base_v2='VALOR_VENDIDO' THEN v_venda.valor_credito ELSE v_fonte_potencial END,v_regra.percentual_comissao,v_valor,'prevista',jsonb_build_object('modo','MANUAL','base_v2',v_regra.base_v2,'fonte_total_potencial',v_fonte_potencial,'total_principal_antes_secundario',v_total_bruto,'reparticao_comercial','aplicada'),'MES_RELATIVO');
 END LOOP;
 IF v_total_sec>0 THEN
  FOR v_etapa IN SELECT value FROM jsonb_array_elements(COALESCE(v_regra_sec.etapas_cronograma,v_regra.etapas_cronograma)) LOOP
   v_ordem:=(v_etapa->>'ordem')::integer;v_valor:=round(v_total_sec*(v_etapa->>'percentual_etapa')::numeric/100,2);
   v_comp:=to_char(date_trunc('month',v_venda.data_venda)+make_interval(months=>(v_etapa->>'mes_relativo')::integer-1),'YYYY-MM');
   INSERT INTO public.comissao_previsoes_participantes(empresa_id,venda_id,cota_definitiva_id,participante_comercial_id,regra_participante_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho)
   VALUES(v_venda.empresa_id,p_venda_id,(SELECT id FROM public.cotas_definitivas WHERE venda_id=p_venda_id),v_secundario.participante_comercial_id,v_regra_sec.id,v_ordem,COALESCE(v_etapa->>'nome',v_ordem||'a parcela'),v_comp,v_total_bruto,COALESCE(v_regra_sec.percentual_comissao,v_secundario.fracao_comissao_percentual),v_valor,'prevista',jsonb_build_object('modo','MANUAL','fonte','PARTICIPANTE_PRINCIPAL','fonte_total_potencial',v_fonte_potencial,'reparticao_comercial','aplicada'),'MES_RELATIVO');
  END LOOP;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION public.comissao_v2_recalcular_elegibilidade_manual(p_venda_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_benef record;v_prev record;v_recebido numeric;v_fonte numeric;v_total numeric;v_pool numeric;v_anterior numeric;
BEGIN
 SELECT COALESCE(sum(valor_liquidado),0) INTO v_recebido FROM public.comissao_previsoes_franquia WHERE venda_id=p_venda_id;
 FOR v_benef IN
  SELECT participante_comercial_id,COALESCE(snapshot_regra->>'fonte_total_potencial','0')::numeric fonte,
   sum(valor_previsto) total FROM public.comissao_previsoes_participantes
  WHERE venda_id=p_venda_id AND snapshot_regra->>'modo'='MANUAL' GROUP BY participante_comercial_id,snapshot_regra->>'fonte_total_potencial'
 LOOP
  v_fonte:=v_benef.fonte;v_total:=v_benef.total;
  v_pool:=CASE WHEN v_fonte>0 THEN least(v_total,round(v_total*v_recebido/v_fonte,2)) ELSE 0 END;v_anterior:=0;
  FOR v_prev IN SELECT * FROM public.comissao_previsoes_participantes WHERE venda_id=p_venda_id AND participante_comercial_id=v_benef.participante_comercial_id AND snapshot_regra->>'modo'='MANUAL' ORDER BY competencia,ordem_etapa FOR UPDATE LOOP
   UPDATE public.comissao_previsoes_participantes SET valor_elegivel=least(v_prev.valor_previsto,greatest(v_pool-v_anterior,0)),
    status=CASE WHEN v_prev.valor_pago>=v_prev.valor_previsto THEN 'paga' WHEN v_prev.valor_pago>0 THEN 'parcialmente_paga'
      WHEN least(v_prev.valor_previsto,greatest(v_pool-v_anterior,0))=v_prev.valor_previsto THEN 'elegivel'
      WHEN least(v_prev.valor_previsto,greatest(v_pool-v_anterior,0))>0 THEN 'parcialmente_elegivel' ELSE 'prevista' END,updated_at=now()
   WHERE id=v_prev.id;
   v_anterior:=v_anterior+v_prev.valor_previsto;
  END LOOP;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.comissao_v2_franquia_liquidacao_recalcular()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN
 IF NEW.valor_liquidado IS DISTINCT FROM OLD.valor_liquidado THEN PERFORM public.comissao_v2_recalcular_elegibilidade_manual(NEW.venda_id);END IF;RETURN NEW;
END $$;
CREATE TRIGGER comissao_v2_franquia_liquidacao AFTER UPDATE OF valor_liquidado ON public.comissao_previsoes_franquia
FOR EACH ROW EXECUTE FUNCTION public.comissao_v2_franquia_liquidacao_recalcular();

CREATE OR REPLACE FUNCTION public.comissao_v2_enriquecer_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
DECLARE v_grupo record; v_tipo record; v_modalidade record;
BEGIN
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = NEW.grupo_id;
  IF v_grupo.tipo_administradora_id IS NULL OR v_grupo.modalidade_comissao_id IS NULL THEN
    RAISE EXCEPTION 'Grupo com CONFIGURAÇÃO PENDENTE: Tipo e Modalidade são obrigatórios para nova venda';
  END IF;
  SELECT * INTO v_tipo FROM public.administradora_tipos WHERE id=v_grupo.tipo_administradora_id AND administradora_id=NEW.administradora_id AND ativo;
  SELECT * INTO v_modalidade FROM public.administradora_modalidades_comissao WHERE id=v_grupo.modalidade_comissao_id AND administradora_id=NEW.administradora_id AND ativo;
  IF v_tipo.id IS NULL OR v_modalidade.id IS NULL THEN RAISE EXCEPTION 'Tipo/Modalidade não pertencem à administradora da venda'; END IF;
  NEW.snapshot_venda := COALESCE(NEW.snapshot_venda,'{}'::jsonb) || jsonb_build_object(
    'tipo_administradora_id',v_tipo.id,'tipo_administradora_codigo',v_tipo.codigo,
    'modalidade_comissao_id',v_modalidade.id,'modalidade_comissao_codigo',v_modalidade.codigo,
    'plano_condicao',lower(v_modalidade.codigo));
  RETURN NEW;
END $$;
CREATE TRIGGER vendas_comissao_v2_enriquecer BEFORE INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.comissao_v2_enriquecer_venda();

-- Preserva a função 061 integralmente e despacha somente grupos configurados ao V2.
ALTER FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text)
  RENAME TO rpc_gerar_previsoes_comissao_legado;

CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao_v2(p_empresa_id uuid,p_venda_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_venda record; v_cota record; v_grupo record; v_regra record; v_etapa record;
  v_imposto numeric := 0; v_bruto numeric; v_tax numeric; v_liquido numeric; v_comp text;
  v_count integer; v_result jsonb; v_prev_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':GERACAO_PREVISOES_V2:'||p_idempotency_key,0));
  SELECT * INTO v_venda FROM public.vendas WHERE id=p_venda_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF v_venda.id IS NULL THEN RAISE EXCEPTION 'Venda não encontrada no tenant'; END IF;
  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id=p_venda_id;
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=v_venda.grupo_id;
  IF EXISTS (SELECT 1 FROM public.comissao_previsoes_franquia WHERE venda_id=p_venda_id) THEN
    SELECT jsonb_build_object('franquia',COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa),'[]'::jsonb),'participantes','[]'::jsonb,'reused',true)
      INTO v_result FROM public.comissao_previsoes_franquia f WHERE venda_id=p_venda_id;
    RETURN v_result;
  END IF;
  SELECT r.*,p.nome programa_nome INTO v_regra
  FROM public.comissao_regras_franquia r JOIN public.comissao_programas p ON p.id=r.programa_id
  WHERE r.empresa_id=p_empresa_id AND p.administradora_id=v_venda.administradora_id AND p.ativo
    AND r.ativa AND r.configuracao_homologada
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id=v_grupo.tipo_administradora_id)
    AND r.modalidade_comissao_id=v_grupo.modalidade_comissao_id
    AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date)
  ORDER BY (r.tipo_administradora_id IS NOT NULL) DESC, r.versao DESC LIMIT 1;
  IF v_regra.id IS NULL THEN RAISE EXCEPTION 'Nenhuma regra V2 homologada para Tipo/Modalidade/Vigência'; END IF;
  SELECT count(*) INTO v_count FROM public.comissao_regras_franquia r JOIN public.comissao_programas p ON p.id=r.programa_id
  WHERE r.empresa_id=p_empresa_id AND p.administradora_id=v_venda.administradora_id AND p.ativo AND r.ativa AND r.configuracao_homologada
    AND COALESCE(r.tipo_administradora_id,v_grupo.tipo_administradora_id)=v_grupo.tipo_administradora_id
    AND (r.tipo_administradora_id IS NOT NULL)=(v_regra.tipo_administradora_id IS NOT NULL)
    AND r.modalidade_comissao_id=v_grupo.modalidade_comissao_id AND r.versao=v_regra.versao
    AND r.vigencia_inicio<=v_venda.data_venda::date AND (r.vigencia_fim IS NULL OR r.vigencia_fim>=v_venda.data_venda::date);
  IF v_count<>1 THEN RAISE EXCEPTION 'Regras V2 ambíguas na mesma precedência/vigência'; END IF;
  SELECT f.percentual_imposto INTO v_imposto FROM public.empresa_configuracoes_fiscais f
   WHERE f.empresa_id=p_empresa_id AND f.ativo AND f.vigencia_inicio<=v_venda.data_venda::date
     AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=v_venda.data_venda::date)
   ORDER BY f.vigencia_inicio DESC LIMIT 1;
  v_imposto:=COALESCE(v_imposto,0);
  FOR v_etapa IN SELECT * FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_regra.id AND tipo_gatilho='MES_RELATIVO' ORDER BY ordem LOOP
    v_bruto:=round(v_venda.valor_credito*v_etapa.percentual_venda/100,2); v_tax:=round(v_bruto*v_imposto/100,2); v_liquido:=v_bruto-v_tax;
    v_comp:=to_char(date_trunc('month',v_venda.data_venda)+make_interval(months=>v_etapa.mes_relativo-1),'YYYY-MM');
    INSERT INTO public.comissao_previsoes_franquia(empresa_id,venda_id,cota_definitiva_id,administradora_id,regra_franquia_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho,valor_bruto,percentual_imposto,valor_imposto,valor_liquido)
    VALUES(p_empresa_id,p_venda_id,v_cota.id,v_venda.administradora_id,v_regra.id,v_etapa.ordem,v_etapa.nome,v_comp,v_venda.valor_credito,v_etapa.percentual_venda,v_bruto,'prevista',jsonb_build_object('regra_id',v_regra.id,'programa_id',v_regra.programa_id,'versao',v_regra.versao,'base_original_venda',v_venda.valor_credito,'etapa_id',v_etapa.id,'tipo_id',v_grupo.tipo_administradora_id,'modalidade_id',v_grupo.modalidade_comissao_id),'MES_RELATIVO',v_bruto,v_imposto,v_tax,v_liquido) RETURNING id INTO v_prev_id;
    PERFORM public.comissao_v2_gerar_participante_automatico(v_prev_id);
  END LOOP;
  PERFORM public.comissao_v2_gerar_participante_manual(p_venda_id,v_regra.id,v_imposto);
  SELECT jsonb_build_object('franquia',COALESCE(jsonb_agg(to_jsonb(f) ORDER BY ordem_etapa),'[]'::jsonb),'participantes','[]'::jsonb,'reused',false)
    INTO v_result FROM public.comissao_previsoes_franquia f WHERE venda_id=p_venda_id;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_gerar_previsoes_comissao(p_empresa_id uuid,p_venda_id uuid,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_v2 boolean;
BEGIN
  SELECT g.tipo_administradora_id IS NOT NULL AND g.modalidade_comissao_id IS NOT NULL INTO v_v2
  FROM public.vendas v JOIN public.grupos_consorcio g ON g.id=v.grupo_id
  WHERE v.id=p_venda_id AND v.empresa_id=p_empresa_id;
  IF COALESCE(v_v2,false) THEN RETURN public.rpc_gerar_previsoes_comissao_v2(p_empresa_id,p_venda_id,p_idempotency_key); END IF;
  RETURN public.rpc_gerar_previsoes_comissao_legado(p_empresa_id,p_venda_id,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_marcar_cota_contemplada(p_empresa_id uuid,p_cota_id uuid,p_data date,p_tipo text,p_valor_credito numeric,p_observacao text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_cota record; v_venda record; v_evento record; v_regra_id uuid; v_etapa record; v_ordem integer;
  v_imposto numeric:=0; v_bruto numeric; v_tax numeric; v_liquido numeric; v_prev_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatória'; END IF;
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant'; END IF;
  IF upper(trim(p_tipo)) NOT IN ('SORTEIO','LANCE','OUTRO') OR p_data IS NULL OR p_valor_credito<=0 THEN RAISE EXCEPTION 'Dados da contemplação inválidos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CONTEMPLACAO:'||p_cota_id::text,0));
  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id=p_cota_id FOR UPDATE;
  IF v_cota.id IS NULL OR v_cota.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Cota não encontrada no tenant'; END IF;
  SELECT * INTO v_evento FROM public.cota_contemplacoes WHERE cota_definitiva_id=p_cota_id;
  IF v_evento.id IS NOT NULL THEN RETURN jsonb_build_object('contemplacao',to_jsonb(v_evento),'previsao_id',(SELECT id FROM public.comissao_previsoes_franquia WHERE evento_origem_id=v_evento.id),'reused',true); END IF;
  SELECT * INTO v_venda FROM public.vendas WHERE id=v_cota.venda_id AND empresa_id=p_empresa_id;
  INSERT INTO public.cota_contemplacoes(empresa_id,cota_definitiva_id,venda_id,data_contemplacao,tipo_contemplacao,valor_credito_contemplacao,observacao,registrado_por_usuario_id)
  VALUES(p_empresa_id,p_cota_id,v_venda.id,p_data,upper(trim(p_tipo)),p_valor_credito,NULLIF(trim(COALESCE(p_observacao,'')),''),public.current_usuario_id()) RETURNING * INTO v_evento;
  UPDATE public.cotas_definitivas SET contemplada=true,status='contemplada',data_contemplacao=p_data,valor_credito_contemplacao=p_valor_credito,tipo_contemplacao=upper(trim(p_tipo)),observacao_contemplacao=v_evento.observacao,contemplacao_atualizada_por_usuario_id=public.current_usuario_id(),contemplacao_atualizada_em=now(),updated_at=now() WHERE id=p_cota_id;
  SELECT regra_franquia_id INTO v_regra_id FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda.id ORDER BY created_at LIMIT 1;
  SELECT * INTO v_etapa FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_regra_id AND tipo_gatilho='CONTEMPLACAO';
  IF v_etapa.id IS NOT NULL THEN
    SELECT COALESCE(max(ordem_etapa),0)+1 INTO v_ordem FROM public.comissao_previsoes_franquia WHERE venda_id=v_venda.id;
    SELECT f.percentual_imposto INTO v_imposto FROM public.empresa_configuracoes_fiscais f WHERE f.empresa_id=p_empresa_id AND f.ativo AND f.vigencia_inicio<=p_data AND (f.vigencia_fim IS NULL OR f.vigencia_fim>=p_data) ORDER BY f.vigencia_inicio DESC LIMIT 1;
    v_imposto:=COALESCE(v_imposto,0); v_bruto:=round(v_venda.valor_credito*v_etapa.percentual_venda/100,2); v_tax:=round(v_bruto*v_imposto/100,2); v_liquido:=v_bruto-v_tax;
    INSERT INTO public.comissao_previsoes_franquia(empresa_id,venda_id,cota_definitiva_id,administradora_id,regra_franquia_id,ordem_etapa,nome_etapa,competencia,base_calculo_valor,percentual_aplicado,valor_previsto,status,snapshot_regra,tipo_gatilho,evento_origem_id,valor_bruto,percentual_imposto,valor_imposto,valor_liquido)
    VALUES(p_empresa_id,v_venda.id,p_cota_id,v_venda.administradora_id,v_regra_id,v_ordem,'CONTEMPLAÇÃO',to_char(p_data,'YYYY-MM'),v_venda.valor_credito,v_etapa.percentual_venda,v_bruto,'prevista',jsonb_build_object('base_original_venda',v_venda.valor_credito,'valor_credito_contemplacao_historico',p_valor_credito,'etapa_id',v_etapa.id),'CONTEMPLACAO',v_evento.id,v_bruto,v_imposto,v_tax,v_liquido) RETURNING id INTO v_prev_id;
    PERFORM public.comissao_v2_gerar_participante_automatico(v_prev_id);
  END IF;
  RETURN jsonb_build_object('contemplacao',to_jsonb(v_evento),'previsao_id',v_prev_id,'reused',false);
END $$;

ALTER FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text)
  RENAME TO rpc_cancelar_venda_comissoes_legado;

CREATE OR REPLACE FUNCTION public.rpc_cancelar_venda_comissoes_v2(p_empresa_id uuid,p_venda_id uuid,p_motivo text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_venda record;v_cota record;v_curva record;v_percentual numeric:=0;v_mes integer;v_prev record;v_valor numeric;v_response jsonb;v_hash text;v_idem record;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF length(trim(COALESCE(p_motivo,'')))=0 OR length(trim(COALESCE(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Motivo e idempotency key são obrigatórios';END IF;
 v_hash:=md5(p_venda_id::text||'|'||trim(p_motivo));PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':CANCELAMENTO_V2:'||p_idempotency_key,0));
 SELECT * INTO v_idem FROM public.operacoes_idempotentes WHERE empresa_id=p_empresa_id AND operacao='CANCELAMENTO_VENDA' AND idempotency_key=p_idempotency_key;
 IF v_idem.id IS NOT NULL THEN IF v_idem.payload_hash<>v_hash THEN RAISE EXCEPTION 'Idempotency key reutilizada com payload diferente';END IF;RETURN v_idem.resposta;END IF;
 SELECT * INTO v_venda FROM public.vendas WHERE id=p_venda_id FOR UPDATE;IF v_venda.id IS NULL OR v_venda.empresa_id<>p_empresa_id THEN RAISE EXCEPTION 'Venda inexistente ou de outro tenant';END IF;
 SELECT * INTO v_cota FROM public.cotas_definitivas WHERE venda_id=p_venda_id FOR UPDATE;
 v_mes:=greatest(1,(date_part('year',age(current_date,v_venda.data_venda::date))*12+date_part('month',age(current_date,v_venda.data_venda::date)))::integer+1);
 IF NOT v_cota.contemplada THEN
  SELECT c.*,f.percentual_estorno INTO v_curva FROM public.administradora_curvas_estorno c JOIN public.administradora_curva_estorno_faixas f ON f.curva_id=c.id AND f.mes_relativo=v_mes
  WHERE c.administradora_id=v_venda.administradora_id AND c.ativa AND c.vigencia_inicio<=current_date AND(c.vigencia_fim IS NULL OR c.vigencia_fim>=current_date) ORDER BY c.versao DESC LIMIT 1;
  v_percentual:=COALESCE(v_curva.percentual_estorno,0);
  FOR v_prev IN SELECT * FROM public.comissao_previsoes_franquia WHERE venda_id=p_venda_id AND valor_liquidado>0 ORDER BY id FOR UPDATE LOOP
   v_valor:=round(v_prev.valor_liquidado*v_percentual/100,2);
   INSERT INTO public.financeiro_estornos_curva(empresa_id,venda_id,beneficiario_tipo,previsao_franquia_id,mes_relativo,percentual_curva,valor_efetivamente_recebido,valor_estorno,motivo,idempotency_key)
   VALUES(p_empresa_id,p_venda_id,'FRANQUEADORA',v_prev.id,v_mes,v_percentual,v_prev.valor_liquidado,v_valor,trim(p_motivo),p_idempotency_key||':f:'||v_prev.id);
  END LOOP;
  FOR v_prev IN SELECT * FROM public.comissao_previsoes_participantes WHERE venda_id=p_venda_id AND valor_pago>0 ORDER BY id FOR UPDATE LOOP
   v_valor:=round(v_prev.valor_pago*v_percentual/100,2);
   INSERT INTO public.financeiro_estornos_curva(empresa_id,venda_id,beneficiario_tipo,participante_comercial_id,organizacao_parceira_id,previsao_participante_id,mes_relativo,percentual_curva,valor_efetivamente_recebido,valor_estorno,motivo,idempotency_key)
   VALUES(p_empresa_id,p_venda_id,CASE WHEN v_prev.participante_comercial_id IS NOT NULL THEN 'PARTICIPANTE' ELSE 'ORGANIZACAO' END,v_prev.participante_comercial_id,v_prev.organizacao_parceira_id,v_prev.id,v_mes,v_percentual,v_prev.valor_pago,v_valor,trim(p_motivo),p_idempotency_key||':p:'||v_prev.id);
   IF v_valor>0 THEN PERFORM public.rpc_gerar_compensacao(p_empresa_id,'Curva de estorno: '||trim(p_motivo),v_valor,p_idempotency_key||':comp:'||v_prev.id,v_prev.participante_comercial_id,v_prev.organizacao_parceira_id,p_venda_id,v_prev.id);END IF;
  END LOOP;
 END IF;
 UPDATE public.comissao_previsoes_franquia SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';
 UPDATE public.comissao_previsoes_participantes SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';
 UPDATE public.cotas_definitivas SET status='cancelada',updated_at=now() WHERE venda_id=p_venda_id AND status<>'cancelada';UPDATE public.vendas SET status='cancelada',updated_at=now() WHERE id=p_venda_id;
 v_response:=jsonb_build_object('venda_id',p_venda_id,'status','cancelada','mes_curva',v_mes,'percentual_curva',v_percentual,'exposicao_encerrada_por_contemplacao',v_cota.contemplada,'reused',false);
 INSERT INTO public.operacoes_idempotentes(empresa_id,operacao,idempotency_key,payload_hash,recurso_id,resposta)VALUES(p_empresa_id,'CANCELAMENTO_VENDA',p_idempotency_key,v_hash,p_venda_id,v_response);RETURN v_response;
END $$;

CREATE OR REPLACE FUNCTION public.rpc_cancelar_venda_comissoes(p_empresa_id uuid,p_venda_id uuid,p_motivo text,p_idempotency_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE v_v2 boolean;BEGIN
 SELECT EXISTS(SELECT 1 FROM public.comissao_previsoes_franquia f WHERE f.venda_id=p_venda_id AND f.empresa_id=p_empresa_id AND f.snapshot_regra ? 'tipo_id') INTO v_v2;
 IF COALESCE(v_v2,false) THEN RETURN public.rpc_cancelar_venda_comissoes_v2(p_empresa_id,p_venda_id,p_motivo,p_idempotency_key);END IF;
 RETURN public.rpc_cancelar_venda_comissoes_legado(p_empresa_id,p_venda_id,p_motivo,p_idempotency_key);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_conferir_pagamento_participante(p_empresa_id uuid,p_previsao_participante_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ DECLARE v_prev record;BEGIN
 SELECT p.*,pc.usuario_id INTO v_prev FROM public.comissao_previsoes_participantes p JOIN public.participantes_comerciais pc ON pc.id=p.participante_comercial_id AND pc.empresa_id=p.empresa_id WHERE p.id=p_previsao_participante_id FOR UPDATE;
 IF v_prev.id IS NULL OR v_prev.empresa_id<>p_empresa_id OR v_prev.usuario_id IS DISTINCT FROM public.current_usuario_id() THEN RAISE EXCEPTION 'Previsão não pertence ao participante autenticado';END IF;
 IF v_prev.valor_pago<=0 THEN RAISE EXCEPTION 'A empresa ainda não registrou pagamento para esta previsão';END IF;
 IF v_prev.conferido_por_participante THEN RETURN jsonb_build_object('previsao_id',v_prev.id,'reused',true);END IF;
 UPDATE public.comissao_previsoes_participantes SET conferido_por_participante=true,conferido_em=now(),conferido_por_usuario_id=public.current_usuario_id(),updated_at=now() WHERE id=v_prev.id;
 RETURN jsonb_build_object('previsao_id',v_prev.id,'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_transferir_pendencia_recebimento(
 p_empresa_id uuid,p_previsao_franquia_id uuid,p_competencia_destino text,p_motivo text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_prev public.comissao_previsoes_franquia%ROWTYPE;v_pend public.financeiro_pendencias_recebimento%ROWTYPE;v_saldo numeric;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF length(trim(COALESCE(p_motivo,'')))=0 THEN RAISE EXCEPTION 'Motivo obrigatorio';END IF;
 IF length(trim(COALESCE(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatoria';END IF;
 IF p_competencia_destino !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN RAISE EXCEPTION 'Competencia destino invalida';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':PENDENCIA:'||p_idempotency_key,0));
 SELECT * INTO v_pend FROM public.financeiro_pendencias_recebimento WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN RETURN jsonb_build_object('pendencia',to_jsonb(v_pend),'reused',true);END IF;
 SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
 IF v_prev.id IS NULL THEN RAISE EXCEPTION 'Previsao nao encontrada no tenant';END IF;
 v_saldo:=round(v_prev.valor_previsto-v_prev.valor_liquidado,2);
 IF v_saldo<=0 THEN RAISE EXCEPTION 'Previsao nao possui saldo pendente';END IF;
 IF p_competencia_destino<=v_prev.competencia THEN RAISE EXCEPTION 'Competencia destino deve ser posterior a original';END IF;
 INSERT INTO public.financeiro_pendencias_recebimento(empresa_id,administradora_id,previsao_franquia_id,competencia_original,competencia_destino,valor_original,motivo,criada_por_usuario_id,idempotency_key)
 VALUES(p_empresa_id,v_prev.administradora_id,v_prev.id,v_prev.competencia,p_competencia_destino,v_saldo,trim(p_motivo),public.current_usuario_id(),p_idempotency_key) RETURNING * INTO v_pend;
 INSERT INTO public.financeiro_pendencia_movimentos(empresa_id,pendencia_id,tipo,valor,observacao,idempotency_key)
 VALUES(p_empresa_id,v_pend.id,'TRANSFERENCIA',v_saldo,'Transferencia operacional; competencia original preservada',p_idempotency_key||':mov');
 INSERT INTO public.audit_logs_central(empresa_id,usuario_id,modulo,acao,entidade_tipo,entidade_id,detalhes,correlation_id)
 VALUES(p_empresa_id,public.current_usuario_id(),'financeiro','TRANSFERIR_PENDENCIA','financeiro_pendencias_recebimento',v_pend.id,jsonb_build_object('competencia_original',v_prev.competencia,'competencia_destino',p_competencia_destino,'valor',v_saldo,'motivo',trim(p_motivo)),p_idempotency_key);
 RETURN jsonb_build_object('pendencia',to_jsonb(v_pend),'reused',false);
END $$;

-- Extensao positiva do recebimento 062. O saldo previsto e liquidado pelo RPC
-- canonico; somente o excedente entra como ajuste de caixa e divergencia auditada.
CREATE OR REPLACE FUNCTION public.rpc_registrar_recebimento_com_divergencia(
 p_empresa_id uuid,p_administradora_id uuid,p_competencia text,p_valor_total numeric,
 p_previsao_franquia_id uuid,p_motivo text,p_observacao text,p_idempotency_key text,
 p_pendencia_id uuid DEFAULT NULL,p_data_recebimento date DEFAULT CURRENT_DATE,
 p_forma_pagamento text DEFAULT 'pix',p_referencia_documento text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_prev public.comissao_previsoes_franquia%ROWTYPE;v_div public.financeiro_divergencias_recebimento%ROWTYPE;
 v_pend public.financeiro_pendencias_recebimento%ROWTYPE;v_base jsonb;v_receb_id uuid;v_saldo numeric;v_excedente numeric;v_compensado numeric:=0;v_pend_saldo numeric;
BEGIN
 IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN RAISE EXCEPTION 'Acesso negado ao tenant';END IF;
 IF length(trim(COALESCE(p_motivo,'')))=0 OR length(trim(COALESCE(p_observacao,'')))=0 THEN RAISE EXCEPTION 'Diferenca positiva exige motivo e observacao';END IF;
 IF length(trim(COALESCE(p_idempotency_key,'')))<8 THEN RAISE EXCEPTION 'Idempotency key obrigatoria';END IF;
 IF p_valor_total IS NULL OR p_valor_total<=0 OR round(p_valor_total,2)<>p_valor_total THEN RAISE EXCEPTION 'Valor total invalido';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text||':DIVERGENCIA:'||p_idempotency_key,0));
 SELECT * INTO v_div FROM public.financeiro_divergencias_recebimento WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
 IF FOUND THEN RETURN jsonb_build_object('divergencia',to_jsonb(v_div),'reused',true);END IF;
 SELECT * INTO v_prev FROM public.comissao_previsoes_franquia WHERE id=p_previsao_franquia_id AND empresa_id=p_empresa_id FOR UPDATE;
 IF v_prev.id IS NULL OR v_prev.administradora_id<>p_administradora_id OR v_prev.competencia<>p_competencia THEN RAISE EXCEPTION 'Previsao nao corresponde ao tenant, administradora ou competencia';END IF;
 v_saldo:=round(v_prev.valor_previsto-v_prev.valor_liquidado,2);v_excedente:=round(p_valor_total-v_saldo,2);
 IF v_excedente<=0 THEN RAISE EXCEPTION 'Use o recebimento canonico quando nao houver diferenca positiva';END IF;
 IF v_saldo>0 THEN
  v_base:=public.rpc_registrar_recebimento(p_empresa_id,p_administradora_id,p_competencia,v_saldo,jsonb_build_array(jsonb_build_object('previsao_franquia_id',p_previsao_franquia_id,'valor_liquidado',v_saldo)),p_idempotency_key||':previsto',p_data_recebimento,p_forma_pagamento,p_referencia_documento,p_observacao);
  v_receb_id:=(v_base->'recebimento'->>'id')::uuid;
 END IF;
 IF p_pendencia_id IS NOT NULL THEN
  SELECT * INTO v_pend FROM public.financeiro_pendencias_recebimento WHERE id=p_pendencia_id AND empresa_id=p_empresa_id AND administradora_id=p_administradora_id FOR UPDATE;
  IF v_pend.id IS NULL THEN RAISE EXCEPTION 'Pendencia nao encontrada no tenant/administradora';END IF;
  SELECT round(v_pend.valor_original-COALESCE(sum(m.valor) FILTER(WHERE m.tipo='COMPENSACAO'),0),2) INTO v_pend_saldo FROM public.financeiro_pendencia_movimentos m WHERE m.pendencia_id=v_pend.id;
  v_compensado:=least(v_excedente,v_pend_saldo);
 END IF;
 INSERT INTO public.financeiro_divergencias_recebimento(empresa_id,administradora_id,previsao_franquia_id,recebimento_base_id,competencia,valor_previsto_saldo,valor_recebido,valor_excedente,valor_compensado_pendencia,motivo,observacao,pendencia_compensada_id,registrado_por_usuario_id,idempotency_key)
 VALUES(p_empresa_id,p_administradora_id,p_previsao_franquia_id,v_receb_id,p_competencia,v_saldo,p_valor_total,v_excedente,v_compensado,trim(p_motivo),trim(p_observacao),p_pendencia_id,public.current_usuario_id(),p_idempotency_key) RETURNING * INTO v_div;
 IF v_compensado>0 THEN
  INSERT INTO public.financeiro_pendencia_movimentos(empresa_id,pendencia_id,tipo,valor,recebimento_id,divergencia_id,observacao,idempotency_key)
  VALUES(p_empresa_id,v_pend.id,'COMPENSACAO',v_compensado,v_receb_id,v_div.id,p_observacao,p_idempotency_key||':comp');
 END IF;
 INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
 VALUES(p_empresa_id,'entrada','ajuste_caixa',v_div.id,p_data_recebimento,p_competencia,v_excedente,'Diferenca positiva de recebimento: '||trim(p_motivo));
 INSERT INTO public.audit_logs_central(empresa_id,usuario_id,modulo,acao,entidade_tipo,entidade_id,detalhes,correlation_id)
 VALUES(p_empresa_id,public.current_usuario_id(),'financeiro','RECEBIMENTO_DIVERGENCIA_POSITIVA','financeiro_divergencias_recebimento',v_div.id,jsonb_build_object('previsao_id',p_previsao_franquia_id,'saldo_previsto',v_saldo,'valor_recebido',p_valor_total,'excedente',v_excedente,'pendencia_compensada_id',p_pendencia_id,'valor_compensado',v_compensado,'motivo',trim(p_motivo),'observacao',trim(p_observacao)),p_idempotency_key);
 RETURN jsonb_build_object('recebimento',v_base->'recebimento','divergencia',to_jsonb(v_div),'reused',false);
END $$;

-- RLS: catálogos globais são leitura autenticada e escrita Platform; fatos são tenant-aware.
ALTER TABLE public.administradora_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradora_modalidades_comissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresa_configuracoes_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradora_curvas_estorno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administradora_curva_estorno_faixas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissao_regra_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cota_contemplacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos_governanca_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_estornos_curva ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pendencias_recebimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_pendencia_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_divergencias_recebimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY administradora_tipos_read ON public.administradora_tipos FOR SELECT TO authenticated USING (true);
CREATE POLICY administradora_tipos_platform_write ON public.administradora_tipos FOR ALL TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY administradora_modalidades_read ON public.administradora_modalidades_comissao FOR SELECT TO authenticated USING (true);
CREATE POLICY administradora_modalidades_platform_write ON public.administradora_modalidades_comissao FOR ALL TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY fiscal_tenant_read ON public.empresa_configuracoes_fiscais FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY fiscal_tenant_write ON public.empresa_configuracoes_fiscais FOR ALL TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY curvas_read ON public.administradora_curvas_estorno FOR SELECT TO authenticated USING (true);
CREATE POLICY curvas_platform_write ON public.administradora_curvas_estorno FOR ALL TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY curvas_faixas_read ON public.administradora_curva_estorno_faixas FOR SELECT TO authenticated USING (true);
CREATE POLICY curvas_faixas_platform_write ON public.administradora_curva_estorno_faixas FOR ALL TO authenticated USING (public.is_platform_superadmin()) WITH CHECK (public.is_platform_superadmin());
CREATE POLICY regra_etapas_read ON public.comissao_regra_etapas FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.comissao_regras_franquia r WHERE r.id=regra_franquia_id AND public.can_read_tenant_internal(r.empresa_id)));
CREATE POLICY regra_etapas_write ON public.comissao_regra_etapas FOR ALL TO authenticated USING (EXISTS(SELECT 1 FROM public.comissao_regras_franquia r WHERE r.id=regra_franquia_id AND public.can_write_tenant_internal(r.empresa_id))) WITH CHECK (EXISTS(SELECT 1 FROM public.comissao_regras_franquia r WHERE r.id=regra_franquia_id AND public.can_write_tenant_internal(r.empresa_id)));
CREATE POLICY contemplacoes_read ON public.cota_contemplacoes FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY contemplacoes_insert ON public.cota_contemplacoes FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY grupos_governanca_historico_read ON public.grupos_governanca_historico FOR SELECT TO authenticated USING (public.is_platform_superadmin() OR (empresa_origem_id IS NOT NULL AND public.can_read_tenant_internal(empresa_origem_id)));
CREATE POLICY grupos_governanca_historico_insert ON public.grupos_governanca_historico FOR INSERT TO authenticated WITH CHECK (public.is_platform_superadmin() OR (empresa_origem_id IS NOT NULL AND public.can_write_tenant_internal(empresa_origem_id)));
CREATE POLICY financeiro_estornos_curva_read ON public.financeiro_estornos_curva FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY financeiro_pendencias_read ON public.financeiro_pendencias_recebimento FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY financeiro_pendencia_movimentos_read ON public.financeiro_pendencia_movimentos FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));
CREATE POLICY financeiro_divergencias_read ON public.financeiro_divergencias_recebimento FOR SELECT TO authenticated USING(public.can_read_tenant_internal(empresa_id));

-- Seeds configuráveis Racon. Integral e 60–99 possuem somente meses; abaixo de 59
-- possui a etapa de negócio CONTEMPLACAO que completa o total.
INSERT INTO public.administradora_tipos(administradora_id,codigo,nome) SELECT id,'IMOVEL','Imóvel' FROM public.administradoras WHERE slug='racon' ON CONFLICT(administradora_id,codigo) DO UPDATE SET nome=EXCLUDED.nome,ativo=true;
INSERT INTO public.administradora_tipos(administradora_id,codigo,nome) SELECT id,'AUTOMOVEIS','Automóveis' FROM public.administradoras WHERE slug='racon' ON CONFLICT(administradora_id,codigo) DO UPDATE SET nome=EXCLUDED.nome,ativo=true;
INSERT INTO public.administradora_modalidades_comissao(administradora_id,codigo,nome) SELECT id,'INTEGRAL','Integral' FROM public.administradoras WHERE slug='racon' ON CONFLICT(administradora_id,codigo) DO UPDATE SET nome=EXCLUDED.nome,ativo=true;
INSERT INTO public.administradora_modalidades_comissao(administradora_id,codigo,nome) SELECT id,'REDUZIDA_60_99','Reduzida 60% a 99%' FROM public.administradoras WHERE slug='racon' ON CONFLICT(administradora_id,codigo) DO UPDATE SET nome=EXCLUDED.nome,ativo=true;
INSERT INTO public.administradora_modalidades_comissao(administradora_id,codigo,nome) SELECT id,'REDUZIDA_ABAIXO_59','Reduzida abaixo de 59%' FROM public.administradoras WHERE slug='racon' ON CONFLICT(administradora_id,codigo) DO UPDATE SET nome=EXCLUDED.nome,ativo=true;

WITH curva AS (
 INSERT INTO public.administradora_curvas_estorno(administradora_id,nome,versao,vigencia_inicio,ativa,encerra_na_contemplacao)
 SELECT id,'Curva Racon revisada',1,DATE '2026-01-01',true,true FROM public.administradoras WHERE slug='racon'
 ON CONFLICT(administradora_id,nome,versao) DO UPDATE SET ativa=true RETURNING id
)
INSERT INTO public.administradora_curva_estorno_faixas(curva_id,mes_relativo,percentual_estorno)
SELECT curva.id,v.mes,v.percentual FROM curva CROSS JOIN (VALUES(1,80::numeric),(2,70),(3,70),(4,70),(5,60),(6,60),(7,50),(8,50)) v(mes,percentual)
ON CONFLICT(curva_id,mes_relativo) DO UPDATE SET percentual_estorno=EXCLUDED.percentual_estorno;

-- Regras Racon são rascunhos configuráveis: homologação continua exclusiva da Platform.
DO $$
DECLARE v_empresa uuid; v_admin uuid; v_tipo record; v_mod record; v_programa uuid; v_regra uuid; v_total numeric; v_json jsonb; v_item jsonb;
BEGIN
 SELECT id INTO v_empresa FROM public.empresas WHERE slug='gauchinho'; SELECT id INTO v_admin FROM public.administradoras WHERE slug='racon';
 IF v_empresa IS NULL OR v_admin IS NULL THEN RAISE EXCEPTION 'Seed 076 exige Gauchinho e Racon canônicos'; END IF;
 FOR v_tipo IN SELECT * FROM public.administradora_tipos WHERE administradora_id=v_admin ORDER BY codigo LOOP
  INSERT INTO public.comissao_programas(empresa_id,nome,descricao,administradora_id,ativo,versao,status)
  VALUES(v_empresa,'Racon '||v_tipo.nome||' — Comissão V2','Tabela oficial configurável; requer homologação Platform.',v_admin,true,1,'RASCUNHO') RETURNING id INTO v_programa;
  FOR v_mod IN SELECT * FROM public.administradora_modalidades_comissao WHERE administradora_id=v_admin ORDER BY codigo LOOP
   IF v_tipo.codigo='IMOVEL' THEN
    v_total:=4; v_json:=CASE v_mod.codigo
      WHEN 'INTEGRAL' THEN '[[1,1],[2,0.5],[3,0.5],[4,0.5],[5,0.25],[6,0.25],[12,0.25],[18,0.5],[27,0.25]]'::jsonb
      WHEN 'REDUZIDA_60_99' THEN '[[1,0.75],[2,0.5],[3,0.5],[4,0.5],[5,0.25],[6,0.25],[12,0.25],[18,0.5],[24,0.25],[30,0.25]]'::jsonb
      ELSE '[[1,0.5],[2,0.25],[3,0.25],[4,0.25],[5,0.25],[6,0.25],[12,0.5],[18,0.5]]'::jsonb END;
   ELSE
    v_total:=3.5; v_json:=CASE v_mod.codigo
      WHEN 'INTEGRAL' THEN '[[1,0.75],[2,0.5],[3,0.5],[4,0.25],[5,0.25],[6,0.25],[12,0.5],[18,0.25],[30,0.25]]'::jsonb
      WHEN 'REDUZIDA_60_99' THEN '[[1,0.5],[2,0.25],[3,0.5],[4,0.5],[5,0.25],[6,0.25],[12,0.5],[18,0.25],[30,0.5]]'::jsonb
      ELSE '[[1,0.5],[2,0.25],[4,0.25],[5,0.25],[6,0.25],[12,0.5],[18,0.25]]'::jsonb END;
   END IF;
   -- JSON legado contém somente meses e distribui o subtotal; o dispatcher V2 usa as etapas normalizadas.
   INSERT INTO public.comissao_regras_franquia(empresa_id,programa_id,versao,percentual_total_comissao,base_calculo,vigencia_inicio,ativa,etapas_cronograma,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id)
   VALUES(v_empresa,v_programa,1,v_total,'credito',DATE '2026-01-01',true,(
     WITH parts AS (
       SELECT x,row_number() over() ord,count(*) over() cnt,
         round(((x->>1)::numeric/(SELECT sum((z->>1)::numeric) FROM jsonb_array_elements(v_json) z))*100,8) pct
       FROM jsonb_array_elements(v_json) x
     ), balanced AS (
       SELECT *,CASE WHEN ord=cnt THEN 100-COALESCE(sum(pct) OVER(ORDER BY ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) ELSE pct END pct_final
       FROM parts
     )
     SELECT jsonb_agg(jsonb_build_object('ordem',ord,'mes_relativo',(x->>0)::int,'percentual_etapa',pct_final,'nome',(x->>0)||'ª parcela') ORDER BY ord) FROM balanced
   ),false,'RACON_TABELA_OFICIAL_V2',v_tipo.id,v_mod.id) RETURNING id INTO v_regra;
   FOR v_item IN SELECT value FROM jsonb_array_elements(v_json) LOOP
    INSERT INTO public.comissao_regra_etapas(regra_franquia_id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda)
    VALUES(v_regra,(SELECT COALESCE(max(ordem),0)+1 FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_regra),'MES_RELATIVO',(v_item->>0)::int,(v_item->>0)||'ª parcela',(v_item->>1)::numeric);
   END LOOP;
   IF v_mod.codigo='REDUZIDA_ABAIXO_59' THEN INSERT INTO public.comissao_regra_etapas(regra_franquia_id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda) VALUES(v_regra,99,'CONTEMPLACAO',NULL,'CONTEMPLAÇÃO',1.25); END IF;
   IF (SELECT sum(percentual_venda) FROM public.comissao_regra_etapas WHERE regra_franquia_id=v_regra)<>v_total THEN RAISE EXCEPTION 'Tabela Racon não fecha: tipo %, modalidade %',v_tipo.codigo,v_mod.codigo; END IF;
  END LOOP;
 END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.rpc_marcar_cota_contemplada(uuid,uuid,date,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_marcar_cota_contemplada(uuid,uuid,date,text,numeric,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_decidir_governanca_grupo(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_conferir_pagamento_participante(uuid,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_transferir_pendencia_recebimento(uuid,uuid,text,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recebimento_com_divergencia(uuid,uuid,text,numeric,uuid,text,text,text,uuid,date,text,text) TO authenticated,service_role;

COMMIT;
