-- Migration 057: auditoria independente Codex — hardening técnico inequívoco.
-- Escopo deliberadamente exclui sorteios e decisões de negócio de comissão/financeiro.

CREATE OR REPLACE FUNCTION public.can_manage_empresa(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_superadmin()
    OR EXISTS (
      SELECT 1
      FROM public.empresa_usuarios eu
      JOIN public.usuarios u ON u.id = eu.usuario_id
      WHERE eu.empresa_id = p_empresa_id
        AND eu.usuario_id = public.current_usuario_id()
        AND eu.ativo = true
        AND u.ativo = true
        AND u.perfil = 'master'
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_empresa(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_empresa(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_empresa_staff(p_empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.is_platform_superadmin()
    OR (
      public.is_staff()
      AND EXISTS (
        SELECT 1
        FROM public.empresa_usuarios eu
        WHERE eu.empresa_id = p_empresa_id
          AND eu.usuario_id = public.current_usuario_id()
          AND eu.ativo = true
      )
    );
$$;

REVOKE ALL ON FUNCTION public.can_read_empresa_staff(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_empresa_staff(UUID) TO authenticated, service_role;

-- Visualizador é leitura: remove todas as policies de escrita baseadas em is_staff().
DROP POLICY IF EXISTS vendas_staff_insert ON public.vendas;
DROP POLICY IF EXISTS vendas_staff_update ON public.vendas;
CREATE POLICY vendas_master_insert ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY vendas_master_update ON public.vendas FOR UPDATE TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS cotas_definitivas_staff_insert ON public.cotas_definitivas;
DROP POLICY IF EXISTS cotas_definitivas_staff_update ON public.cotas_definitivas;
CREATE POLICY cotas_definitivas_master_insert ON public.cotas_definitivas FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY cotas_definitivas_master_update ON public.cotas_definitivas FOR UPDATE TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS comissao_programas_staff_write ON public.comissao_programas;
DROP POLICY IF EXISTS comissao_regras_franquia_staff_write ON public.comissao_regras_franquia;
DROP POLICY IF EXISTS comissao_regras_part_staff_write ON public.comissao_regras_participantes;
DROP POLICY IF EXISTS comissao_prev_franq_staff_write ON public.comissao_previsoes_franquia;
DROP POLICY IF EXISTS comissao_prev_part_staff_write ON public.comissao_previsoes_participantes;
CREATE POLICY comissao_programas_master_write ON public.comissao_programas FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY comissao_regras_franquia_master_write ON public.comissao_regras_franquia FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY comissao_regras_part_master_write ON public.comissao_regras_participantes FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY comissao_prev_franq_master_write ON public.comissao_previsoes_franquia FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY comissao_prev_part_master_write ON public.comissao_previsoes_participantes FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

DROP POLICY IF EXISTS fin_rec_staff_write ON public.financeiro_recebimentos;
DROP POLICY IF EXISTS fin_rec_itens_staff_write ON public.financeiro_recebimento_itens;
DROP POLICY IF EXISTS fin_pag_staff_write ON public.financeiro_pagamentos;
DROP POLICY IF EXISTS fin_pag_itens_staff_write ON public.financeiro_pagamento_itens;
DROP POLICY IF EXISTS fin_comp_staff_write ON public.financeiro_compensacoes;
DROP POLICY IF EXISTS caixa_staff_write ON public.caixa_movimentos;
CREATE POLICY fin_rec_master_write ON public.financeiro_recebimentos FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY fin_rec_itens_master_write ON public.financeiro_recebimento_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financeiro_recebimentos r WHERE r.id = recebimento_id AND public.can_manage_empresa(r.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financeiro_recebimentos r WHERE r.id = recebimento_id AND public.can_manage_empresa(r.empresa_id)));
CREATE POLICY fin_pag_master_write ON public.financeiro_pagamentos FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY fin_pag_itens_master_write ON public.financeiro_pagamento_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.financeiro_pagamentos p WHERE p.id = pagamento_id AND public.can_manage_empresa(p.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.financeiro_pagamentos p WHERE p.id = pagamento_id AND public.can_manage_empresa(p.empresa_id)));
CREATE POLICY fin_comp_master_write ON public.financeiro_compensacoes FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));
CREATE POLICY caixa_master_insert ON public.caixa_movimentos FOR INSERT TO authenticated
  WITH CHECK (public.can_manage_empresa(empresa_id));

-- Substitui policies 056 que comparavam empresa_usuarios.usuario_id diretamente com auth.uid().
DROP POLICY IF EXISTS equipes_tenant_policy ON public.equipes;
DROP POLICY IF EXISTS equipe_membros_tenant_policy ON public.equipe_membros;
DROP POLICY IF EXISTS metas_tenant_policy ON public.metas_comerciais;
DROP POLICY IF EXISTS tarefas_tenant_policy ON public.tarefas_gestao;
DROP POLICY IF EXISTS audit_logs_central_tenant_policy ON public.audit_logs_central;

CREATE POLICY equipes_staff_read ON public.equipes FOR SELECT TO authenticated
  USING (public.can_read_empresa_staff(empresa_id));
CREATE POLICY equipes_master_write ON public.equipes FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

CREATE POLICY equipe_membros_staff_read ON public.equipe_membros FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.equipes e WHERE e.id = equipe_id AND public.can_read_empresa_staff(e.empresa_id)));
CREATE POLICY equipe_membros_master_write ON public.equipe_membros FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.equipes e WHERE e.id = equipe_id AND public.can_manage_empresa(e.empresa_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.equipes e WHERE e.id = equipe_id AND public.can_manage_empresa(e.empresa_id)));

CREATE POLICY metas_staff_read ON public.metas_comerciais FOR SELECT TO authenticated
  USING (public.can_read_empresa_staff(empresa_id));
CREATE POLICY metas_master_write ON public.metas_comerciais FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

CREATE POLICY tarefas_staff_read ON public.tarefas_gestao FOR SELECT TO authenticated
  USING (public.can_read_empresa_staff(empresa_id));
CREATE POLICY tarefas_master_write ON public.tarefas_gestao FOR ALL TO authenticated
  USING (public.can_manage_empresa(empresa_id)) WITH CHECK (public.can_manage_empresa(empresa_id));

CREATE POLICY audit_logs_central_staff_read ON public.audit_logs_central FOR SELECT TO authenticated
  USING (public.can_read_empresa_staff(empresa_id));

-- Integridade multi-tenant dos IDs polimórficos/indiretos do Macrobloco E.
CREATE OR REPLACE FUNCTION public.gestao_resource_belongs_to_empresa(
  p_tipo TEXT,
  p_id UUID,
  p_empresa_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_id IS NULL THEN RETURN true; END IF;
  CASE p_tipo
    WHEN 'equipe' THEN RETURN EXISTS (SELECT 1 FROM public.equipes WHERE id = p_id AND empresa_id = p_empresa_id);
    WHEN 'participante' THEN RETURN EXISTS (SELECT 1 FROM public.participantes_comerciais WHERE id = p_id AND empresa_id = p_empresa_id);
    WHEN 'parceiro' THEN RETURN EXISTS (SELECT 1 FROM public.organizacoes_parceiras WHERE id = p_id AND empresa_id = p_empresa_id);
    WHEN 'lead' THEN RETURN EXISTS (SELECT 1 FROM public.leads WHERE id = p_id AND empresa_id = p_empresa_id);
    WHEN 'proposta' THEN RETURN EXISTS (SELECT 1 FROM public.propostas WHERE id = p_id AND empresa_id = p_empresa_id);
    WHEN 'venda' THEN RETURN EXISTS (SELECT 1 FROM public.vendas WHERE id = p_id AND empresa_id = p_empresa_id);
    ELSE RETURN false;
  END CASE;
END;
$$;

REVOKE ALL ON FUNCTION public.gestao_resource_belongs_to_empresa(TEXT, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_resource_belongs_to_empresa(TEXT, UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_gestao_tenant_refs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'equipes' THEN
    IF NEW.gestor_id IS NOT NULL AND NOT public.gestao_resource_belongs_to_empresa('participante', NEW.gestor_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'gestor não pertence ao tenant' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'equipe_membros' THEN
    SELECT empresa_id INTO v_empresa_id FROM public.equipes WHERE id = NEW.equipe_id;
    IF v_empresa_id IS NULL OR NOT public.gestao_resource_belongs_to_empresa('participante', NEW.participante_id, v_empresa_id) THEN
      RAISE EXCEPTION 'membro não pertence ao tenant da equipe' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'metas_comerciais' THEN
    IF NEW.alvo_tipo = 'empresa' THEN
      IF NEW.alvo_id IS NOT NULL AND NEW.alvo_id <> NEW.empresa_id THEN
        RAISE EXCEPTION 'alvo empresa não pertence ao tenant' USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.alvo_id IS NULL OR NOT public.gestao_resource_belongs_to_empresa(NEW.alvo_tipo, NEW.alvo_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'alvo da meta não pertence ao tenant' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'tarefas_gestao' THEN
    IF NEW.responsavel_id IS NOT NULL AND NOT public.gestao_resource_belongs_to_empresa('participante', NEW.responsavel_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'responsável não pertence ao tenant' USING ERRCODE = '23514';
    END IF;
    IF NEW.equipe_id IS NOT NULL AND NOT public.gestao_resource_belongs_to_empresa('equipe', NEW.equipe_id, NEW.empresa_id) THEN
      RAISE EXCEPTION 'equipe não pertence ao tenant' USING ERRCODE = '23514';
    END IF;
    IF NEW.origem_tipo = 'interna' AND NEW.origem_id IS NOT NULL THEN
      RAISE EXCEPTION 'tarefa interna não aceita origem_id' USING ERRCODE = '23514';
    END IF;
    IF NEW.origem_tipo IS NOT NULL AND NEW.origem_tipo <> 'interna'
       AND (NEW.origem_id IS NULL OR NOT public.gestao_resource_belongs_to_empresa(NEW.origem_tipo, NEW.origem_id, NEW.empresa_id)) THEN
      RAISE EXCEPTION 'origem da tarefa não pertence ao tenant' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_gestao_tenant_refs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_gestao_tenant_refs() TO authenticated, service_role;

DROP TRIGGER IF EXISTS equipes_validate_tenant_refs ON public.equipes;
CREATE TRIGGER equipes_validate_tenant_refs BEFORE INSERT OR UPDATE ON public.equipes
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_refs();
DROP TRIGGER IF EXISTS equipe_membros_validate_tenant_refs ON public.equipe_membros;
CREATE TRIGGER equipe_membros_validate_tenant_refs BEFORE INSERT OR UPDATE ON public.equipe_membros
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_refs();
DROP TRIGGER IF EXISTS metas_validate_tenant_refs ON public.metas_comerciais;
CREATE TRIGGER metas_validate_tenant_refs BEFORE INSERT OR UPDATE ON public.metas_comerciais
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_refs();
DROP TRIGGER IF EXISTS tarefas_validate_tenant_refs ON public.tarefas_gestao;
CREATE TRIGGER tarefas_validate_tenant_refs BEFORE INSERT OR UPDATE ON public.tarefas_gestao
FOR EACH ROW EXECUTE FUNCTION public.validate_gestao_tenant_refs();

-- Ledger e trilha central são append-only. Estornos devem ser novos eventos/movimentos.
CREATE OR REPLACE FUNCTION public.prevent_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'registro append-only: UPDATE/DELETE não permitido em %', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_append_only_mutation() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_append_only_mutation() TO authenticated, service_role;

DROP TRIGGER IF EXISTS caixa_movimentos_append_only ON public.caixa_movimentos;
CREATE TRIGGER caixa_movimentos_append_only
BEFORE UPDATE OR DELETE ON public.caixa_movimentos
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

DROP TRIGGER IF EXISTS audit_logs_central_append_only ON public.audit_logs_central;
CREATE TRIGGER audit_logs_central_append_only
BEFORE UPDATE OR DELETE ON public.audit_logs_central
FOR EACH ROW EXECUTE FUNCTION public.prevent_append_only_mutation();

-- Checks NOT VALID protegem novas gravações sem fingir validação retroativa de Produção.
ALTER TABLE public.vendas ADD CONSTRAINT vendas_valores_positivos_ck
  CHECK (valor_credito > 0 AND prazo > 0 AND parcela > 0) NOT VALID;
ALTER TABLE public.cotas_definitivas ADD CONSTRAINT cotas_definitivas_valores_positivos_ck
  CHECK (valor_credito > 0 AND prazo > 0 AND parcela > 0) NOT VALID;
ALTER TABLE public.financeiro_recebimentos ADD CONSTRAINT financeiro_recebimentos_valor_positivo_ck
  CHECK (valor_total > 0) NOT VALID;
ALTER TABLE public.financeiro_recebimento_itens ADD CONSTRAINT financeiro_recebimento_itens_valor_positivo_ck
  CHECK (valor_liquidado > 0) NOT VALID;
ALTER TABLE public.financeiro_pagamentos ADD CONSTRAINT financeiro_pagamentos_valores_validos_ck
  CHECK (valor_bruto >= 0 AND valor_compensado >= 0 AND valor_liquido >= 0 AND valor_liquido = valor_bruto - valor_compensado) NOT VALID;
ALTER TABLE public.financeiro_pagamento_itens ADD CONSTRAINT financeiro_pagamento_itens_valor_positivo_ck
  CHECK (valor_liquidado > 0) NOT VALID;
ALTER TABLE public.financeiro_compensacoes ADD CONSTRAINT financeiro_compensacoes_valores_validos_ck
  CHECK (valor_original > 0 AND valor_saldo >= 0 AND valor_saldo <= valor_original) NOT VALID;
ALTER TABLE public.caixa_movimentos ADD CONSTRAINT caixa_movimentos_valor_positivo_ck
  CHECK (valor > 0) NOT VALID;
