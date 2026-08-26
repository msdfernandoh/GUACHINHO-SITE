-- 134: quadro societário versionado por empresa e fechamento financeiro imutável.
-- Forward-only: preserva empresa_usuarios.socio_pagador e todos os fatos financeiros existentes.
BEGIN;

CREATE TABLE IF NOT EXISTS public.empresa_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (length(trim(nome)) >= 2),
  percentual_participacao numeric(7,4) NOT NULL
    CHECK (percentual_participacao > 0 AND percentual_participacao <= 100),
  vigencia_inicio date NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  observacao text,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio)
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_socios_usuario_ativo_uidx
  ON public.empresa_socios (empresa_id, usuario_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS empresa_socios_vigencia_idx
  ON public.empresa_socios (empresa_id, vigencia_inicio, vigencia_fim);

CREATE TABLE IF NOT EXISTS public.empresa_socio_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  banco_nome text,
  agencia text,
  conta text,
  tipo_chave_pix text CHECK (tipo_chave_pix IS NULL OR tipo_chave_pix IN ('CPF_CNPJ','EMAIL','TELEFONE','ALEATORIA')),
  chave_pix text,
  favorecido text NOT NULL,
  principal boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS empresa_socio_conta_principal_uidx
  ON public.empresa_socio_contas (socio_id) WHERE principal AND ativo;

CREATE TABLE IF NOT EXISTS public.financeiro_fechamentos_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  status text NOT NULL DEFAULT 'FECHADO' CHECK (status = 'FECHADO'),
  total_despesas_pessoais numeric(15,2) NOT NULL DEFAULT 0 CHECK (total_despesas_pessoais >= 0),
  idempotency_key text NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (periodo_fim >= periodo_inicio),
  UNIQUE (empresa_id, idempotency_key),
  UNIQUE (empresa_id, periodo_inicio, periodo_fim)
);

CREATE TABLE IF NOT EXISTS public.financeiro_fechamento_socios_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.financeiro_fechamentos_socios(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  nome_snapshot text NOT NULL,
  percentual_snapshot numeric(7,4) NOT NULL,
  total_pago_pessoalmente numeric(15,2) NOT NULL DEFAULT 0,
  responsabilidade_periodo numeric(15,2) NOT NULL DEFAULT 0,
  saldo_equalizacao numeric(15,2) NOT NULL DEFAULT 0,
  conta_recebimento_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fechamento_id, socio_id)
);

CREATE TABLE IF NOT EXISTS public.financeiro_fechamento_socios_instrucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.financeiro_fechamentos_socios(id) ON DELETE RESTRICT,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  devedor_socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  credor_socio_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  valor_transferencia numeric(15,2) NOT NULL CHECK (valor_transferencia > 0),
  valor_contas_alternativo numeric(15,2) NOT NULL CHECK (valor_contas_alternativo > 0),
  descricao text NOT NULL,
  conta_destino_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.validar_empresa_socio_conta()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_socios s
    WHERE s.id = NEW.socio_id AND s.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Conta e sócio precisam pertencer à mesma empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_socio_contas_validar_tenant ON public.empresa_socio_contas;
CREATE TRIGGER empresa_socio_contas_validar_tenant
BEFORE INSERT OR UPDATE OF empresa_id, socio_id ON public.empresa_socio_contas
FOR EACH ROW EXECUTE FUNCTION public.validar_empresa_socio_conta();

CREATE OR REPLACE FUNCTION public.bloquear_mutacao_fechamento_socios()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Fechamento societário é imutável; gere um novo fechamento para outro período';
END;
$$;

DO $$
DECLARE v_tabela text;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'financeiro_fechamentos_socios',
    'financeiro_fechamento_socios_itens',
    'financeiro_fechamento_socios_instrucoes'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || v_tabela || '_imutavel', v_tabela);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacao_fechamento_socios()',
      'trg_' || v_tabela || '_imutavel', v_tabela
    );
  END LOOP;
END;
$$;

-- Converte os vínculos legados em um quadro vigente, distribuindo igualmente
-- somente quando a empresa ainda não possui configuração societária canônica.
WITH candidatos AS (
  SELECT eu.empresa_id, eu.usuario_id, u.nome,
         row_number() OVER (PARTITION BY eu.empresa_id ORDER BY u.nome, u.id) AS ordem,
         count(*) OVER (PARTITION BY eu.empresa_id) AS quantidade
  FROM public.empresa_usuarios eu
  JOIN public.usuarios u ON u.id = eu.usuario_id
  WHERE eu.ativo AND eu.socio_pagador
    AND NOT EXISTS (SELECT 1 FROM public.empresa_socios s WHERE s.empresa_id = eu.empresa_id AND s.ativo)
)
INSERT INTO public.empresa_socios (
  empresa_id, usuario_id, nome, percentual_participacao, vigencia_inicio, ativo
)
SELECT empresa_id, usuario_id, nome,
       CASE WHEN ordem = quantidade
         THEN 100 - (quantidade - 1) * round(100::numeric / quantidade, 4)
         ELSE round(100::numeric / quantidade, 4)
       END,
       CURRENT_DATE, true
FROM candidatos;

CREATE OR REPLACE FUNCTION public.rpc_platform_salvar_quadro_societario(
  p_empresa_id uuid,
  p_socios jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_item jsonb;
  v_usuario_id uuid;
  v_socio_id uuid;
  v_total numeric;
  v_quantidade integer;
  v_usuario_atual uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Acesso restrito ao Platform Superadmin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id) THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;
  IF jsonb_typeof(p_socios) <> 'array' OR jsonb_array_length(p_socios) < 1 THEN
    RAISE EXCEPTION 'Informe ao menos um sócio';
  END IF;

  SELECT count(*), round(sum((x->>'percentual')::numeric), 4)
    INTO v_quantidade, v_total
  FROM jsonb_array_elements(p_socios) x;
  IF v_quantidade <> (SELECT count(DISTINCT (x->>'usuario_id')) FROM jsonb_array_elements(p_socios) x) THEN
    RAISE EXCEPTION 'O mesmo usuário não pode aparecer duas vezes no quadro societário';
  END IF;
  IF v_total <> 100 THEN
    RAISE EXCEPTION 'A soma dos percentuais deve ser exatamente 100 por cento (recebido: %)', v_total;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_socios) x
    WHERE (x->>'percentual')::numeric <= 0 OR (x->>'percentual')::numeric > 100
  ) THEN
    RAISE EXCEPTION 'Percentuais devem ser maiores que zero e menores ou iguais a 100%%';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_socios) x
    WHERE NOT EXISTS (
      SELECT 1 FROM public.empresa_usuarios eu
      WHERE eu.empresa_id = p_empresa_id
        AND eu.usuario_id = (x->>'usuario_id')::uuid
        AND eu.ativo
    )
  ) THEN
    RAISE EXCEPTION 'Todo sócio deve possuir vínculo ativo com a empresa';
  END IF;

  SELECT public.current_usuario_id() INTO v_usuario_atual;

  IF EXISTS (
    SELECT 1
    FROM public.empresa_socios s
    JOIN public.financeiro_fechamento_socios_itens i ON i.socio_id = s.id
    WHERE s.empresa_id = p_empresa_id AND s.ativo AND s.vigencia_inicio = CURRENT_DATE
  ) THEN
    RAISE EXCEPTION 'O quadro vigente já foi usado em um fechamento hoje; uma nova vigência só pode começar no próximo dia';
  END IF;

  DELETE FROM public.empresa_socio_contas c
  USING public.empresa_socios s
  WHERE c.socio_id = s.id AND s.empresa_id = p_empresa_id
    AND s.ativo AND s.vigencia_inicio = CURRENT_DATE;

  DELETE FROM public.empresa_socios
  WHERE empresa_id = p_empresa_id AND ativo AND vigencia_inicio = CURRENT_DATE;

  UPDATE public.empresa_socios
     SET ativo = false,
         vigencia_fim = CURRENT_DATE - 1,
         updated_at = now()
   WHERE empresa_id = p_empresa_id AND ativo AND vigencia_inicio < CURRENT_DATE;

  UPDATE public.empresa_usuarios
     SET socio_pagador = false, updated_at = now()
   WHERE empresa_id = p_empresa_id AND socio_pagador;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_socios) LOOP
    v_usuario_id := (v_item->>'usuario_id')::uuid;
    INSERT INTO public.empresa_socios (
      empresa_id, usuario_id, nome, percentual_participacao,
      vigencia_inicio, ativo, observacao, criado_por
    )
    SELECT p_empresa_id, u.id, u.nome, (v_item->>'percentual')::numeric,
           CURRENT_DATE, true, nullif(trim(v_item->>'observacao'), ''), v_usuario_atual
    FROM public.usuarios u WHERE u.id = v_usuario_id
    RETURNING id INTO v_socio_id;

    UPDATE public.empresa_usuarios
       SET socio_pagador = true, updated_at = now()
     WHERE empresa_id = p_empresa_id AND usuario_id = v_usuario_id AND ativo;

    IF nullif(trim(v_item->>'banco_nome'), '') IS NOT NULL
       OR nullif(trim(v_item->>'chave_pix'), '') IS NOT NULL THEN
      INSERT INTO public.empresa_socio_contas (
        empresa_id, socio_id, banco_nome, agencia, conta,
        tipo_chave_pix, chave_pix, favorecido, principal, ativo
      ) VALUES (
        p_empresa_id, v_socio_id, nullif(trim(v_item->>'banco_nome'), ''),
        nullif(trim(v_item->>'agencia'), ''), nullif(trim(v_item->>'conta'), ''),
        nullif(trim(v_item->>'tipo_chave_pix'), ''), nullif(trim(v_item->>'chave_pix'), ''),
        coalesce(nullif(trim(v_item->>'favorecido'), ''), trim(v_item->>'nome')), true, true
      );
    END IF;
  END LOOP;

  INSERT INTO public.plataforma_auditoria (usuario_id, acao, entidade_tipo, entidade_id, campos_alterados)
  VALUES (v_usuario_atual, 'ATUALIZAR_QUADRO_SOCIETARIO', 'empresas', p_empresa_id,
          jsonb_build_array('socios', 'percentuais', 'contas_recebimento', 'vigencia'));

  RETURN jsonb_build_object('empresa_id', p_empresa_id, 'socios', v_quantidade, 'percentual_total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_fechar_socios(
  p_empresa_id uuid,
  p_periodo_inicio date,
  p_periodo_fim date,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_fechamento_id uuid;
  v_total numeric(15,2);
  v_total_percentual numeric;
  v_usuario_atual uuid;
  v_resultado jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  IF p_periodo_inicio IS NULL OR p_periodo_fim IS NULL OR p_periodo_fim < p_periodo_inicio THEN
    RAISE EXCEPTION 'Período de fechamento inválido';
  END IF;
  IF length(trim(coalesce(p_idempotency_key, ''))) < 8 THEN
    RAISE EXCEPTION 'Chave de idempotência obrigatória';
  END IF;

  SELECT id INTO v_fechamento_id
  FROM public.financeiro_fechamentos_socios
  WHERE empresa_id = p_empresa_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN jsonb_build_object('fechamento_id', v_fechamento_id, 'reused', true);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_empresa_id::text || ':FECHAMENTO_SOCIOS:' || p_periodo_inicio::text || ':' || p_periodo_fim::text, 0));

  SELECT round(sum(percentual_participacao), 4) INTO v_total_percentual
  FROM public.empresa_socios
  WHERE empresa_id = p_empresa_id
    AND vigencia_inicio <= p_periodo_inicio
    AND (vigencia_fim IS NULL OR vigencia_fim >= p_periodo_fim);
  IF v_total_percentual IS DISTINCT FROM 100::numeric THEN
    RAISE EXCEPTION 'Não existe quadro societário de 100%% vigente durante todo o período';
  END IF;

  SELECT coalesce(round(sum(c.valor), 2), 0) INTO v_total
  FROM public.financeiro_contas_pagar c
  LEFT JOIN public.financeiro_centros_custo cc
    ON cc.id = c.centro_custo_id AND cc.empresa_id = p_empresa_id
  WHERE c.empresa_id = p_empresa_id
    AND c.status = 'paga' AND c.pago_pessoalmente
    AND c.pago_em BETWEEN p_periodo_inicio AND p_periodo_fim
    AND NOT (coalesce(c.descontado_comissao, false) OR coalesce(cc.descontado_comissao, false));

  SELECT public.current_usuario_id() INTO v_usuario_atual;
  INSERT INTO public.financeiro_fechamentos_socios (
    empresa_id, periodo_inicio, periodo_fim, total_despesas_pessoais,
    idempotency_key, criado_por
  ) VALUES (
    p_empresa_id, p_periodo_inicio, p_periodo_fim, v_total,
    p_idempotency_key, v_usuario_atual
  ) RETURNING id INTO v_fechamento_id;

  WITH quadro AS (
    SELECT s.*,
      row_number() OVER (ORDER BY s.nome, s.id) AS ordem,
      count(*) OVER () AS quantidade,
      coalesce((
        SELECT sum(c.valor) FROM public.financeiro_contas_pagar c
        LEFT JOIN public.financeiro_centros_custo cc
          ON cc.id = c.centro_custo_id AND cc.empresa_id = p_empresa_id
        WHERE c.empresa_id = p_empresa_id AND c.status = 'paga' AND c.pago_pessoalmente
          AND c.socio_pagador_usuario_id = s.usuario_id
          AND c.pago_em BETWEEN p_periodo_inicio AND p_periodo_fim
          AND NOT (coalesce(c.descontado_comissao, false) OR coalesce(cc.descontado_comissao, false))
      ), 0)::numeric(15,2) AS pago,
      round(v_total * s.percentual_participacao / 100, 2) AS responsabilidade_base
    FROM public.empresa_socios s
    WHERE s.empresa_id = p_empresa_id
      AND s.vigencia_inicio <= p_periodo_inicio
      AND (s.vigencia_fim IS NULL OR s.vigencia_fim >= p_periodo_fim)
  ), calculo AS (
    SELECT q.*,
      CASE WHEN ordem = quantidade
        THEN v_total - coalesce(sum(responsabilidade_base) OVER (ORDER BY ordem ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
        ELSE responsabilidade_base
      END::numeric(15,2) AS responsabilidade
    FROM quadro q
  )
  INSERT INTO public.financeiro_fechamento_socios_itens (
    fechamento_id, empresa_id, socio_id, usuario_id, nome_snapshot,
    percentual_snapshot, total_pago_pessoalmente, responsabilidade_periodo,
    saldo_equalizacao, conta_recebimento_snapshot
  )
  SELECT v_fechamento_id, p_empresa_id, c.id, c.usuario_id, c.nome,
         c.percentual_participacao, c.pago, c.responsabilidade,
         round(c.pago - c.responsabilidade, 2),
         (SELECT to_jsonb(ct) - 'empresa_id' - 'socio_id' - 'created_at' - 'updated_at'
          FROM public.empresa_socio_contas ct
          WHERE ct.socio_id = c.id AND ct.ativo AND ct.principal LIMIT 1)
  FROM calculo c;

  WITH devedores AS (
    SELECT i.*,
      sum(-saldo_equalizacao) OVER (ORDER BY nome_snapshot, id) AS fim,
      sum(-saldo_equalizacao) OVER (ORDER BY nome_snapshot, id) + saldo_equalizacao AS inicio
    FROM public.financeiro_fechamento_socios_itens i
    WHERE fechamento_id = v_fechamento_id AND saldo_equalizacao < 0
  ), credores AS (
    SELECT i.*,
      sum(saldo_equalizacao) OVER (ORDER BY nome_snapshot, id) AS fim,
      sum(saldo_equalizacao) OVER (ORDER BY nome_snapshot, id) - saldo_equalizacao AS inicio
    FROM public.financeiro_fechamento_socios_itens i
    WHERE fechamento_id = v_fechamento_id AND saldo_equalizacao > 0
  ), pares AS (
    SELECT d.socio_id devedor_id, d.nome_snapshot devedor_nome,
           c.socio_id credor_id, c.nome_snapshot credor_nome,
           d.percentual_snapshot devedor_percentual,
           round(least(d.fim, c.fim) - greatest(d.inicio, c.inicio), 2) valor,
           c.conta_recebimento_snapshot conta_destino
    FROM devedores d CROSS JOIN credores c
    WHERE least(d.fim, c.fim) > greatest(d.inicio, c.inicio)
  )
  INSERT INTO public.financeiro_fechamento_socios_instrucoes (
    fechamento_id, empresa_id, devedor_socio_id, credor_socio_id,
    valor_transferencia, valor_contas_alternativo, descricao, conta_destino_snapshot
  )
  SELECT v_fechamento_id, p_empresa_id, devedor_id, credor_id, valor,
         round(valor / nullif(1 - devedor_percentual / 100, 0), 2),
         devedor_nome || ' deve transferir R$ ' || replace(to_char(valor, 'FM999G999G990D00'), '.', ',') ||
         ' para ' || credor_nome || '. Após a transferência, esse valor reduz o adiantamento de ' ||
         credor_nome || ' e aumenta a participação efetivamente paga por ' || devedor_nome || '.',
         conta_destino
  FROM pares WHERE valor > 0;

  SELECT jsonb_build_object(
    'fechamento_id', f.id,
    'periodo_inicio', f.periodo_inicio,
    'periodo_fim', f.periodo_fim,
    'total_despesas_pessoais', f.total_despesas_pessoais,
    'itens', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.nome_snapshot) FROM public.financeiro_fechamento_socios_itens i WHERE i.fechamento_id=f.id), '[]'::jsonb),
    'instrucoes', coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at, x.id) FROM public.financeiro_fechamento_socios_instrucoes x WHERE x.fechamento_id=f.id), '[]'::jsonb),
    'reused', false
  ) INTO v_resultado
  FROM public.financeiro_fechamentos_socios f WHERE f.id = v_fechamento_id;
  RETURN v_resultado;
END;
$$;

DO $$
DECLARE v_tabela text;
BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'empresa_socios', 'empresa_socio_contas', 'financeiro_fechamentos_socios',
    'financeiro_fechamento_socios_itens', 'financeiro_fechamento_socios_instrucoes'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabela);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon', v_tabela);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', v_tabela);
  END LOOP;
END;
$$;

CREATE POLICY empresa_socios_select ON public.empresa_socios FOR SELECT TO authenticated
  USING (public.is_platform_superadmin() OR public.can_read_tenant_internal(empresa_id));
CREATE POLICY empresa_socio_contas_select ON public.empresa_socio_contas FOR SELECT TO authenticated
  USING (public.is_platform_superadmin() OR public.can_write_tenant_internal(empresa_id));
CREATE POLICY financeiro_fechamentos_socios_select ON public.financeiro_fechamentos_socios FOR SELECT TO authenticated
  USING (public.can_write_tenant_internal(empresa_id));
CREATE POLICY financeiro_fechamento_socios_itens_select ON public.financeiro_fechamento_socios_itens FOR SELECT TO authenticated
  USING (public.can_write_tenant_internal(empresa_id));
CREATE POLICY financeiro_fechamento_socios_instrucoes_select ON public.financeiro_fechamento_socios_instrucoes FOR SELECT TO authenticated
  USING (public.can_write_tenant_internal(empresa_id));

REVOKE ALL ON FUNCTION public.validar_empresa_socio_conta() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.bloquear_mutacao_fechamento_socios() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_salvar_quadro_societario(uuid,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_quadro_societario(uuid,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.rpc_fechar_socios(uuid,date,date,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_fechar_socios(uuid,date,date,text) TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
