-- Hardening B: integridade cross-tenant inequívoca e históricos append-only.
-- Não altera cálculos, elegibilidade, compensação, comissão ou FKs históricas.

CREATE OR REPLACE FUNCTION public.validate_comercial_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_TABLE_NAME = 'vendas' THEN
    IF NEW.lead_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.leads x WHERE x.id = NEW.lead_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'lead não pertence ao tenant da venda'; END IF;
    IF NEW.proposta_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.propostas x WHERE x.id = NEW.proposta_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'proposta não pertence ao tenant da venda'; END IF;
    IF NEW.contratacao_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.contratacoes_online x WHERE x.id = NEW.contratacao_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'contratação não pertence ao tenant da venda'; END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da venda'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant da venda'; END IF;
  ELSIF TG_TABLE_NAME = 'cotas_definitivas' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'venda não pertence ao tenant da cota'; END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da cota'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant da cota'; END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_comissao_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_TABLE_NAME = 'comissao_regras_franquia' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissao_programas x WHERE x.id = NEW.programa_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'programa não pertence ao tenant da regra de franquia'; END IF;
  ELSIF TG_TABLE_NAME = 'comissao_regras_participantes' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.comissao_programas x WHERE x.id = NEW.programa_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'programa não pertence ao tenant da regra de participante'; END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da regra'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant da regra'; END IF;
  ELSIF TG_TABLE_NAME = 'comissao_previsoes_franquia' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'venda não pertence ao tenant da previsão de franquia'; END IF;
    IF NEW.cota_definitiva_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas x WHERE x.id = NEW.cota_definitiva_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'cota não pertence ao tenant da previsão de franquia'; END IF;
    IF NEW.regra_franquia_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_regras_franquia x WHERE x.id = NEW.regra_franquia_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'regra não pertence ao tenant da previsão de franquia'; END IF;
  ELSIF TG_TABLE_NAME = 'comissao_previsoes_participantes' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'venda não pertence ao tenant da previsão de participante'; END IF;
    IF NEW.cota_definitiva_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas x WHERE x.id = NEW.cota_definitiva_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'cota não pertence ao tenant da previsão de participante'; END IF;
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da previsão'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant da previsão'; END IF;
    IF NEW.regra_participante_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.comissao_regras_participantes x WHERE x.id = NEW.regra_participante_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'regra não pertence ao tenant da previsão de participante'; END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_financeiro_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_empresa_pai uuid;
  v_empresa_referencia uuid;
BEGIN
  IF TG_TABLE_NAME = 'financeiro_recebimento_itens' THEN
    SELECT x.empresa_id INTO v_empresa_pai FROM public.financeiro_recebimentos x WHERE x.id = NEW.recebimento_id;
    SELECT x.empresa_id INTO v_empresa_referencia FROM public.comissao_previsoes_franquia x WHERE x.id = NEW.previsao_franquia_id;
    IF v_empresa_pai IS NULL OR v_empresa_referencia IS DISTINCT FROM v_empresa_pai THEN
      RAISE EXCEPTION 'recebimento e previsão de franquia pertencem a tenants distintos';
    END IF;
  ELSIF TG_TABLE_NAME = 'financeiro_pagamentos' THEN
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant do pagamento'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant do pagamento'; END IF;
  ELSIF TG_TABLE_NAME = 'financeiro_pagamento_itens' THEN
    SELECT x.empresa_id INTO v_empresa_pai FROM public.financeiro_pagamentos x WHERE x.id = NEW.pagamento_id;
    SELECT x.empresa_id INTO v_empresa_referencia FROM public.comissao_previsoes_participantes x WHERE x.id = NEW.previsao_participante_id;
    IF v_empresa_pai IS NULL OR v_empresa_referencia IS DISTINCT FROM v_empresa_pai THEN
      RAISE EXCEPTION 'pagamento e previsão de participante pertencem a tenants distintos';
    END IF;
  ELSIF TG_TABLE_NAME = 'financeiro_compensacoes' THEN
    IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.participante_comercial_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da compensação'; END IF;
    IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.organizacao_parceira_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'organização parceira não pertence ao tenant da compensação'; END IF;
    IF NEW.venda_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.venda_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'venda não pertence ao tenant da compensação'; END IF;
  ELSIF TG_TABLE_NAME = 'caixa_movimentos' AND NEW.origem_id IS NOT NULL THEN
    IF NEW.origem_tipo IN ('recebimento_administradora', 'estorno_recebimento') AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_recebimentos x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'recebimento de origem não pertence ao tenant do caixa'; END IF;
    IF NEW.origem_tipo IN ('pagamento_participante', 'estorno_pagamento') AND NOT EXISTS (
      SELECT 1 FROM public.financeiro_pagamentos x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'pagamento de origem não pertence ao tenant do caixa'; END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.validate_gestao_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_TABLE_NAME = 'equipes' THEN
    IF NEW.gestor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.gestor_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'gestor não pertence ao tenant da equipe'; END IF;
  ELSIF TG_TABLE_NAME = 'equipe_membros' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.equipes e
      JOIN public.participantes_comerciais p ON p.id = NEW.participante_id
      WHERE e.id = NEW.equipe_id AND p.empresa_id = e.empresa_id
    ) THEN RAISE EXCEPTION 'membro não pertence ao tenant da equipe'; END IF;
  ELSIF TG_TABLE_NAME = 'metas_comerciais' THEN
    IF NEW.alvo_tipo = 'empresa' THEN
      IF NEW.alvo_id IS NOT NULL AND NEW.alvo_id <> NEW.empresa_id THEN
        RAISE EXCEPTION 'alvo empresa não pertence ao tenant da meta';
      END IF;
    ELSIF NEW.alvo_id IS NULL THEN
      RAISE EXCEPTION 'alvo_id é obrigatório para o tipo de meta';
    ELSIF NEW.alvo_tipo = 'equipe' AND NOT EXISTS (
      SELECT 1 FROM public.equipes x WHERE x.id = NEW.alvo_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'equipe não pertence ao tenant da meta';
    ELSIF NEW.alvo_tipo = 'participante' AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.alvo_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da meta';
    ELSIF NEW.alvo_tipo = 'parceiro' AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.alvo_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'parceiro não pertence ao tenant da meta';
    END IF;
  ELSIF TG_TABLE_NAME = 'tarefas_gestao' THEN
    IF NEW.responsavel_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.responsavel_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'responsável não pertence ao tenant da tarefa'; END IF;
    IF NEW.equipe_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.equipes x WHERE x.id = NEW.equipe_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'equipe não pertence ao tenant da tarefa'; END IF;
    IF NEW.origem_tipo IS NULL OR NEW.origem_tipo = 'interna' THEN
      IF NEW.origem_id IS NOT NULL THEN RAISE EXCEPTION 'origem interna não aceita origem_id'; END IF;
    ELSIF NEW.origem_id IS NULL THEN
      RAISE EXCEPTION 'origem_id é obrigatório para a tarefa';
    ELSIF NEW.origem_tipo = 'lead' AND NOT EXISTS (
      SELECT 1 FROM public.leads x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'lead não pertence ao tenant da tarefa';
    ELSIF NEW.origem_tipo = 'proposta' AND NOT EXISTS (
      SELECT 1 FROM public.propostas x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'proposta não pertence ao tenant da tarefa';
    ELSIF NEW.origem_tipo = 'venda' AND NOT EXISTS (
      SELECT 1 FROM public.vendas x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'venda não pertence ao tenant da tarefa';
    ELSIF NEW.origem_tipo = 'participante' AND NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'participante não pertence ao tenant da tarefa';
    ELSIF NEW.origem_tipo = 'parceiro' AND NOT EXISTS (
      SELECT 1 FROM public.organizacoes_parceiras x WHERE x.id = NEW.origem_id AND x.empresa_id = NEW.empresa_id
    ) THEN RAISE EXCEPTION 'parceiro não pertence ao tenant da tarefa';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION public.block_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% é append-only; registre reversão em novo lançamento', TG_TABLE_NAME;
END
$$;

DROP TRIGGER IF EXISTS trg_vendas_tenant_integrity ON public.vendas;
CREATE TRIGGER trg_vendas_tenant_integrity BEFORE INSERT OR UPDATE ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.validate_comercial_tenant_integrity();
DROP TRIGGER IF EXISTS trg_cotas_tenant_integrity ON public.cotas_definitivas;
CREATE TRIGGER trg_cotas_tenant_integrity BEFORE INSERT OR UPDATE ON public.cotas_definitivas
FOR EACH ROW EXECUTE FUNCTION public.validate_comercial_tenant_integrity();

DROP TRIGGER IF EXISTS trg_regra_franquia_tenant_integrity ON public.comissao_regras_franquia;
CREATE TRIGGER trg_regra_franquia_tenant_integrity BEFORE INSERT OR UPDATE ON public.comissao_regras_franquia
FOR EACH ROW EXECUTE FUNCTION public.validate_comissao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_regra_participante_tenant_integrity ON public.comissao_regras_participantes;
CREATE TRIGGER trg_regra_participante_tenant_integrity BEFORE INSERT OR UPDATE ON public.comissao_regras_participantes
FOR EACH ROW EXECUTE FUNCTION public.validate_comissao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_previsao_franquia_tenant_integrity ON public.comissao_previsoes_franquia;
CREATE TRIGGER trg_previsao_franquia_tenant_integrity BEFORE INSERT OR UPDATE ON public.comissao_previsoes_franquia
FOR EACH ROW EXECUTE FUNCTION public.validate_comissao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_previsao_participante_tenant_integrity ON public.comissao_previsoes_participantes;
CREATE TRIGGER trg_previsao_participante_tenant_integrity BEFORE INSERT OR UPDATE ON public.comissao_previsoes_participantes
FOR EACH ROW EXECUTE FUNCTION public.validate_comissao_tenant_integrity();

DROP TRIGGER IF EXISTS trg_recebimento_item_tenant_integrity ON public.financeiro_recebimento_itens;
CREATE TRIGGER trg_recebimento_item_tenant_integrity BEFORE INSERT OR UPDATE ON public.financeiro_recebimento_itens
FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_tenant_integrity();
DROP TRIGGER IF EXISTS trg_pagamento_tenant_integrity ON public.financeiro_pagamentos;
CREATE TRIGGER trg_pagamento_tenant_integrity BEFORE INSERT OR UPDATE ON public.financeiro_pagamentos
FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_tenant_integrity();
DROP TRIGGER IF EXISTS trg_pagamento_item_tenant_integrity ON public.financeiro_pagamento_itens;
CREATE TRIGGER trg_pagamento_item_tenant_integrity BEFORE INSERT OR UPDATE ON public.financeiro_pagamento_itens
FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_tenant_integrity();
DROP TRIGGER IF EXISTS trg_compensacao_tenant_integrity ON public.financeiro_compensacoes;
CREATE TRIGGER trg_compensacao_tenant_integrity BEFORE INSERT OR UPDATE ON public.financeiro_compensacoes
FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_tenant_integrity();
DROP TRIGGER IF EXISTS trg_caixa_tenant_integrity ON public.caixa_movimentos;
CREATE TRIGGER trg_caixa_tenant_integrity BEFORE INSERT ON public.caixa_movimentos
FOR EACH ROW EXECUTE FUNCTION public.validate_financeiro_tenant_integrity();

DROP TRIGGER IF EXISTS trg_equipe_tenant_integrity ON public.equipes;
CREATE TRIGGER trg_equipe_tenant_integrity BEFORE INSERT OR UPDATE ON public.equipes
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_equipe_membro_tenant_integrity ON public.equipe_membros;
CREATE TRIGGER trg_equipe_membro_tenant_integrity BEFORE INSERT OR UPDATE ON public.equipe_membros
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_meta_tenant_integrity ON public.metas_comerciais;
CREATE TRIGGER trg_meta_tenant_integrity BEFORE INSERT OR UPDATE ON public.metas_comerciais
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_integrity();
DROP TRIGGER IF EXISTS trg_tarefa_tenant_integrity ON public.tarefas_gestao;
CREATE TRIGGER trg_tarefa_tenant_integrity BEFORE INSERT OR UPDATE ON public.tarefas_gestao
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_integrity();

DROP TRIGGER IF EXISTS trg_caixa_append_only ON public.caixa_movimentos;
CREATE TRIGGER trg_caixa_append_only BEFORE UPDATE OR DELETE ON public.caixa_movimentos
FOR EACH ROW EXECUTE FUNCTION public.block_append_only_mutation();
DROP TRIGGER IF EXISTS trg_audit_log_append_only ON public.audit_logs_central;
CREATE TRIGGER trg_audit_log_append_only BEFORE UPDATE OR DELETE ON public.audit_logs_central
FOR EACH ROW EXECUTE FUNCTION public.block_append_only_mutation();

REVOKE ALL ON FUNCTION public.validate_comercial_tenant_integrity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_comissao_tenant_integrity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_financeiro_tenant_integrity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.validate_gestao_tenant_integrity() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.block_append_only_mutation() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.validate_comercial_tenant_integrity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_comissao_tenant_integrity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_financeiro_tenant_integrity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_gestao_tenant_integrity() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_append_only_mutation() TO authenticated, service_role;
