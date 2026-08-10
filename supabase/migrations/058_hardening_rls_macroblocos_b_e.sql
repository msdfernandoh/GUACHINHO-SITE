-- Hardening A/B: substitui policies 053-056 por operações explícitas.
-- visualizador é somente leitura; escrita tenant exige admin_empresa.

DO $$
DECLARE
  v_table text;
  v_policy record;
  v_direct_crud text[] := ARRAY[
    'comissao_programas',
    'comissao_regras_franquia',
    'comissao_regras_participantes',
    'comissao_previsoes_franquia',
    'comissao_previsoes_participantes',
    'financeiro_recebimentos',
    'financeiro_pagamentos',
    'financeiro_compensacoes',
    'equipes',
    'metas_comerciais',
    'tarefas_gestao'
  ];
  v_direct_superadmin_delete text[] := ARRAY['vendas', 'cotas_definitivas'];
  v_append_only text[] := ARRAY['caixa_movimentos', 'audit_logs_central'];
  v_all_tables text[] := v_direct_crud
    || v_direct_superadmin_delete
    || v_append_only
    || ARRAY['financeiro_recebimento_itens', 'financeiro_pagamento_itens', 'equipe_membros'];
BEGIN
  -- O remoto está alinhado a 001-056; todas as policies atuais destes alvos
  -- são substituídas atomicamente pelas policies abaixo.
  FOREACH v_table IN ARRAY v_all_tables LOOP
    FOR v_policy IN
      SELECT policyname
      FROM pg_catalog.pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;

  FOREACH v_table IN ARRAY v_direct_crud LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))',
      v_table || '_tenant_select', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_insert', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_update', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_delete', v_table
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
  END LOOP;

  FOREACH v_table IN ARRAY v_direct_superadmin_delete LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))',
      v_table || '_tenant_select', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_insert', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_write_tenant_internal(empresa_id)) WITH CHECK (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_update', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.is_platform_superadmin())',
      v_table || '_superadmin_delete', v_table
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
  END LOOP;

  FOREACH v_table IN ARRAY v_append_only LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))',
      v_table || '_tenant_select', v_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id))',
      v_table || '_tenant_insert', v_table
    );
    EXECUTE format('REVOKE UPDATE, DELETE ON TABLE public.%I FROM authenticated', v_table);
    EXECUTE format('GRANT SELECT, INSERT ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END
$$;

-- Tabelas cujo tenant é derivado do registro pai.
CREATE POLICY financeiro_recebimento_itens_tenant_select
ON public.financeiro_recebimento_itens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_recebimentos AS r
  WHERE r.id = recebimento_id AND public.can_read_tenant_internal(r.empresa_id)
));

CREATE POLICY financeiro_recebimento_itens_tenant_insert
ON public.financeiro_recebimento_itens FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.financeiro_recebimentos AS r
  WHERE r.id = recebimento_id AND public.can_write_tenant_internal(r.empresa_id)
));

CREATE POLICY financeiro_recebimento_itens_tenant_update
ON public.financeiro_recebimento_itens FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_recebimentos AS r
  WHERE r.id = recebimento_id AND public.can_write_tenant_internal(r.empresa_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.financeiro_recebimentos AS r
  WHERE r.id = recebimento_id AND public.can_write_tenant_internal(r.empresa_id)
));

CREATE POLICY financeiro_recebimento_itens_tenant_delete
ON public.financeiro_recebimento_itens FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_recebimentos AS r
  WHERE r.id = recebimento_id AND public.can_write_tenant_internal(r.empresa_id)
));

CREATE POLICY financeiro_pagamento_itens_tenant_select
ON public.financeiro_pagamento_itens FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_pagamentos AS p
  WHERE p.id = pagamento_id AND public.can_read_tenant_internal(p.empresa_id)
));

CREATE POLICY financeiro_pagamento_itens_tenant_insert
ON public.financeiro_pagamento_itens FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.financeiro_pagamentos AS p
  WHERE p.id = pagamento_id AND public.can_write_tenant_internal(p.empresa_id)
));

CREATE POLICY financeiro_pagamento_itens_tenant_update
ON public.financeiro_pagamento_itens FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_pagamentos AS p
  WHERE p.id = pagamento_id AND public.can_write_tenant_internal(p.empresa_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.financeiro_pagamentos AS p
  WHERE p.id = pagamento_id AND public.can_write_tenant_internal(p.empresa_id)
));

CREATE POLICY financeiro_pagamento_itens_tenant_delete
ON public.financeiro_pagamento_itens FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.financeiro_pagamentos AS p
  WHERE p.id = pagamento_id AND public.can_write_tenant_internal(p.empresa_id)
));

CREATE POLICY equipe_membros_tenant_select
ON public.equipe_membros FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.equipes AS e
  WHERE e.id = equipe_id AND public.can_read_tenant_internal(e.empresa_id)
));

CREATE POLICY equipe_membros_tenant_insert
ON public.equipe_membros FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.equipes AS e
  WHERE e.id = equipe_id AND public.can_write_tenant_internal(e.empresa_id)
));

CREATE POLICY equipe_membros_tenant_update
ON public.equipe_membros FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.equipes AS e
  WHERE e.id = equipe_id AND public.can_write_tenant_internal(e.empresa_id)
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.equipes AS e
  WHERE e.id = equipe_id AND public.can_write_tenant_internal(e.empresa_id)
));

CREATE POLICY equipe_membros_tenant_delete
ON public.equipe_membros FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.equipes AS e
  WHERE e.id = equipe_id AND public.can_write_tenant_internal(e.empresa_id)
));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.financeiro_recebimento_itens,
  public.financeiro_pagamento_itens,
  public.equipe_membros
TO authenticated;
