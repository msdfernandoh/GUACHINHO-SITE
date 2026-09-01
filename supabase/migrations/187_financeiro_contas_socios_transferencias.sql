-- 187 — Saldos por conta, pagamento bancário de comissões e conta interna dos sócios.
-- Forward-only: livros financeiros e fechamentos permanecem append-only.
BEGIN;

CREATE TABLE public.financeiro_conta_movimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_bancaria_id uuid NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  tipo text NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  categoria text NOT NULL CHECK (categoria IN (
    'SALDO_INICIAL','REPASSE_ADMINISTRADORA','COMISSAO_SOCIO','COMISSAO_PARTICIPANTE',
    'APORTE_SOCIO','EMPRESTIMO','RECEITA_DIVERSA','DESPESA','TRANSFERENCIA_INTERNA','AJUSTE','ESTORNO'
  )),
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  data_movimento date NOT NULL DEFAULT CURRENT_DATE,
  descricao text NOT NULL CHECK (length(trim(descricao)) >= 3),
  recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE RESTRICT,
  pagamento_id uuid REFERENCES public.financeiro_pagamentos(id) ON DELETE RESTRICT,
  caixa_movimento_id uuid REFERENCES public.caixa_movimentos(id) ON DELETE RESTRICT,
  transferencia_conta_id uuid,
  comprovante_referencia text,
  idempotency_key text NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (num_nonnulls(recebimento_id,pagamento_id,caixa_movimento_id,transferencia_conta_id) <= 1)
);

CREATE TABLE public.financeiro_transferencias_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  conta_origem_id uuid NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  conta_destino_id uuid NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  descricao text NOT NULL,
  comprovante_referencia text,
  idempotency_key text NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (conta_origem_id <> conta_destino_id)
);

ALTER TABLE public.financeiro_conta_movimentos
  ADD CONSTRAINT financeiro_conta_movimentos_transferencia_fkey
  FOREIGN KEY (transferencia_conta_id) REFERENCES public.financeiro_transferencias_contas(id) ON DELETE RESTRICT;

CREATE TABLE public.financeiro_pagamento_contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  pagamento_id uuid NOT NULL UNIQUE REFERENCES public.financeiro_pagamentos(id) ON DELETE RESTRICT,
  conta_origem_id uuid NOT NULL REFERENCES public.financeiro_contas_bancarias(id) ON DELETE RESTRICT,
  conta_destino_snapshot jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.financeiro_transferencias_socios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  fechamento_id uuid REFERENCES public.financeiro_fechamentos_socios(id) ON DELETE RESTRICT,
  instrucao_id uuid REFERENCES public.financeiro_fechamento_socios_instrucoes(id) ON DELETE RESTRICT,
  socio_origem_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  socio_destino_id uuid NOT NULL REFERENCES public.empresa_socios(id) ON DELETE RESTRICT,
  valor numeric(15,2) NOT NULL CHECK (valor > 0),
  data_transferencia date NOT NULL DEFAULT CURRENT_DATE,
  comprovante_referencia text,
  observacao text,
  idempotency_key text NOT NULL,
  criado_por uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, idempotency_key),
  CHECK (socio_origem_id <> socio_destino_id),
  CHECK ((fechamento_id IS NULL) = (instrucao_id IS NULL))
);

CREATE INDEX financeiro_conta_movimentos_saldo_idx
  ON public.financeiro_conta_movimentos (empresa_id, conta_bancaria_id, data_movimento, created_at);
CREATE INDEX financeiro_transferencias_socios_fechamento_idx
  ON public.financeiro_transferencias_socios (empresa_id, fechamento_id, created_at);

CREATE OR REPLACE FUNCTION public.bloquear_mutacao_financeira_187()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  RAISE EXCEPTION '% é append-only; registre um lançamento compensatório', TG_TABLE_NAME;
END $$;

DO $$ DECLARE v_tabela text; BEGIN
  FOREACH v_tabela IN ARRAY ARRAY[
    'financeiro_conta_movimentos','financeiro_transferencias_contas',
    'financeiro_pagamento_contas','financeiro_transferencias_socios'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bloquear_mutacao_financeira_187()',
      'trg_'||v_tabela||'_append_only',v_tabela
    );
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_tabela);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',v_tabela);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',v_tabela);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id))',v_tabela||'_select',v_tabela);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.financeiro_contas_saldos
WITH (security_invoker=true) AS
SELECT c.id,c.empresa_id,c.nome,c.banco,c.agencia,c.conta_mascarada,c.tipo_conta,c.chave_pix,c.ativo,
  round(coalesce(c.saldo_inicial,0)+coalesce(sum(CASE WHEN m.tipo='ENTRADA' THEN m.valor ELSE -m.valor END),0),2) AS saldo_atual,
  coalesce(sum(m.valor) FILTER (WHERE m.tipo='ENTRADA'),0)::numeric(15,2) AS total_entradas,
  coalesce(sum(m.valor) FILTER (WHERE m.tipo='SAIDA'),0)::numeric(15,2) AS total_saidas
FROM public.financeiro_contas_bancarias c
LEFT JOIN public.financeiro_conta_movimentos m ON m.conta_bancaria_id=c.id AND m.empresa_id=c.empresa_id
GROUP BY c.id;

CREATE OR REPLACE VIEW public.financeiro_socios_extrato
WITH (security_invoker=true) AS
SELECT ('COMISSAO:'||p.id::text) chave,p.empresa_id,s.id socio_id,p.data_pagamento data_movimento,
  'COMISSAO_RECEBIDA'::text tipo,p.valor_liquido::numeric(15,2) credito,0::numeric(15,2) debito,
  'Comissão recebida - '||p.competencia descricao,p.id origem_id,p.created_at
FROM public.financeiro_pagamentos p
JOIN public.participantes_comerciais pc ON pc.id=p.participante_comercial_id AND pc.empresa_id=p.empresa_id
JOIN public.empresa_socios s ON s.empresa_id=p.empresa_id AND s.usuario_id=pc.usuario_id
  AND s.vigencia_inicio<=p.data_pagamento AND (s.vigencia_fim IS NULL OR s.vigencia_fim>=p.data_pagamento)
WHERE p.status='confirmado' AND p.valor_liquido>0
  AND NOT EXISTS(SELECT 1 FROM public.financeiro_estornos e WHERE e.pagamento_id=p.id AND e.tipo='pagamento')
UNION ALL
SELECT ('DESPESA:'||c.id::text),c.empresa_id,s.id,c.pago_em,'DESPESA_PAGA_PESSOALMENTE',c.valor,0,
  'Despesa da empresa: '||c.descricao,c.id,c.updated_at
FROM public.financeiro_contas_pagar c
JOIN public.empresa_socios s ON s.empresa_id=c.empresa_id AND s.usuario_id=c.socio_pagador_usuario_id
  AND s.vigencia_inicio<=c.pago_em AND (s.vigencia_fim IS NULL OR s.vigencia_fim>=c.pago_em)
WHERE c.status='paga' AND c.pago_pessoalmente
UNION ALL
SELECT ('TRANSF-SAIDA:'||t.id::text),t.empresa_id,t.socio_origem_id,t.data_transferencia,'TRANSFERENCIA_ENVIADA',0,t.valor,
  coalesce(t.observacao,'Transferência para equalização societária'),t.id,t.created_at
FROM public.financeiro_transferencias_socios t
UNION ALL
SELECT ('TRANSF-ENTRADA:'||t.id::text),t.empresa_id,t.socio_destino_id,t.data_transferencia,'TRANSFERENCIA_RECEBIDA',t.valor,0,
  coalesce(t.observacao,'Transferência para equalização societária'),t.id,t.created_at
FROM public.financeiro_transferencias_socios t;

CREATE OR REPLACE VIEW public.financeiro_socios_saldos
WITH (security_invoker=true) AS
SELECT s.id socio_id,s.empresa_id,s.usuario_id,s.nome,s.percentual_participacao,
  coalesce(sum(e.credito-e.debito),0)::numeric(15,2) saldo_interno
FROM public.empresa_socios s
LEFT JOIN public.financeiro_socios_extrato e ON e.socio_id=s.id AND e.empresa_id=s.empresa_id
WHERE s.ativo
GROUP BY s.id;

REVOKE ALL ON public.financeiro_contas_saldos,public.financeiro_socios_extrato,public.financeiro_socios_saldos FROM PUBLIC,anon;
GRANT SELECT ON public.financeiro_contas_saldos,public.financeiro_socios_extrato,public.financeiro_socios_saldos TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_recebimento_em_conta_187()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.conta_bancaria_id IS NOT NULL THEN
    INSERT INTO public.financeiro_conta_movimentos(
      empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,
      recebimento_id,idempotency_key,criado_por
    ) VALUES(
      NEW.empresa_id,NEW.conta_bancaria_id,'ENTRADA','REPASSE_ADMINISTRADORA',NEW.valor_total,
      NEW.data_recebimento,'Repasse recebido - '||NEW.competencia,NEW.id,
      'recebimento:'||NEW.id::text,public.current_usuario_id()
    ) ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_recebimento_em_conta_187 AFTER INSERT ON public.financeiro_recebimentos
FOR EACH ROW EXECUTE FUNCTION public.registrar_recebimento_em_conta_187();

CREATE OR REPLACE FUNCTION public.registrar_estorno_em_conta_187()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_mov public.financeiro_conta_movimentos%ROWTYPE;v_pag public.financeiro_pagamentos%ROWTYPE;
BEGIN
  IF NEW.tipo='recebimento' THEN
    SELECT * INTO v_mov FROM public.financeiro_conta_movimentos
    WHERE recebimento_id=NEW.recebimento_id AND tipo='ENTRADA' ORDER BY created_at LIMIT 1;
    IF v_mov.id IS NOT NULL THEN
      INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,idempotency_key,criado_por)
      VALUES(NEW.empresa_id,v_mov.conta_bancaria_id,'SAIDA','ESTORNO',NEW.valor,CURRENT_DATE,'Estorno de recebimento: '||NEW.motivo,'estorno:'||NEW.id::text,public.current_usuario_id())
      ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;
    END IF;
  ELSIF NEW.tipo='pagamento' THEN
    SELECT p.* INTO v_pag FROM public.financeiro_pagamentos p WHERE p.id=NEW.pagamento_id;
    SELECT m.* INTO v_mov FROM public.financeiro_conta_movimentos m
    WHERE m.pagamento_id=NEW.pagamento_id AND m.tipo='SAIDA' ORDER BY m.created_at LIMIT 1;
    IF v_mov.id IS NOT NULL AND v_pag.valor_liquido>0 THEN
      INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,idempotency_key,criado_por)
      VALUES(NEW.empresa_id,v_mov.conta_bancaria_id,'ENTRADA','ESTORNO',v_pag.valor_liquido,CURRENT_DATE,'Estorno de pagamento: '||NEW.motivo,'estorno:'||NEW.id::text,public.current_usuario_id())
      ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_estorno_em_conta_187 AFTER INSERT ON public.financeiro_estornos
FOR EACH ROW EXECUTE FUNCTION public.registrar_estorno_em_conta_187();

INSERT INTO public.financeiro_conta_movimentos(
  empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,
  recebimento_id,idempotency_key,criado_por
)
SELECT r.empresa_id,r.conta_bancaria_id,'ENTRADA','REPASSE_ADMINISTRADORA',r.valor_total,r.data_recebimento,
  'Repasse recebido - '||r.competencia,r.id,'recebimento:'||r.id::text,NULL
FROM public.financeiro_recebimentos r
WHERE r.conta_bancaria_id IS NOT NULL AND r.status='confirmado'
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

INSERT INTO public.financeiro_conta_movimentos(
  empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,idempotency_key,criado_por
)
SELECT e.empresa_id,m.conta_bancaria_id,'SAIDA','ESTORNO',e.valor,e.created_at::date,
  'Estorno de recebimento: '||e.motivo,'estorno:'||e.id::text,NULL
FROM public.financeiro_estornos e
JOIN public.financeiro_conta_movimentos m ON m.recebimento_id=e.recebimento_id AND m.tipo='ENTRADA'
WHERE e.tipo='recebimento'
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_registrar_movimento_bancario(
  p_empresa_id uuid,p_conta_id uuid,p_tipo text,p_categoria text,p_valor numeric,
  p_data date,p_descricao text,p_comprovante text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_conta record;v_caixa_id uuid;v_mov record;v_saldo numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira';END IF;
  IF p_tipo NOT IN ('ENTRADA','SAIDA') OR p_categoria NOT IN ('APORTE_SOCIO','EMPRESTIMO','RECEITA_DIVERSA','DESPESA','AJUSTE') THEN RAISE EXCEPTION 'Tipo ou categoria inválida';END IF;
  IF p_valor<=0 OR round(p_valor,2)<>p_valor OR length(trim(coalesce(p_descricao,'')))<3 THEN RAISE EXCEPTION 'Dados do lançamento inválidos';END IF;
  SELECT * INTO v_conta FROM public.financeiro_contas_bancarias WHERE id=p_conta_id AND empresa_id=p_empresa_id AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancária inválida';END IF;
  SELECT * INTO v_mov FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('movimento',to_jsonb(v_mov),'reused',true);END IF;
  IF p_tipo='SAIDA' THEN
    SELECT saldo_atual INTO v_saldo FROM public.financeiro_contas_saldos WHERE id=p_conta_id;
    IF coalesce(v_saldo,0)<p_valor THEN RAISE EXCEPTION 'Saldo insuficiente na conta bancária';END IF;
  END IF;
  INSERT INTO public.caixa_movimentos(empresa_id,tipo_movimento,origem_tipo,origem_id,data_movimento,competencia,valor,descricao)
  VALUES(p_empresa_id,lower(p_tipo), 'ajuste_caixa',NULL,p_data,to_char(p_data,'YYYY-MM'),p_valor,trim(p_descricao)) RETURNING id INTO v_caixa_id;
  INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,caixa_movimento_id,comprovante_referencia,idempotency_key,criado_por)
  VALUES(p_empresa_id,p_conta_id,p_tipo,p_categoria,p_valor,p_data,trim(p_descricao),v_caixa_id,nullif(trim(coalesce(p_comprovante,'')),''),p_idempotency_key,public.current_usuario_id()) RETURNING * INTO v_mov;
  RETURN jsonb_build_object('movimento',to_jsonb(v_mov),'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_transferir_entre_contas(
  p_empresa_id uuid,p_conta_origem_id uuid,p_conta_destino_id uuid,p_valor numeric,
  p_data date,p_descricao text,p_comprovante text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_trans record;v_saldo numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira';END IF;
  IF p_conta_origem_id=p_conta_destino_id OR p_valor<=0 OR round(p_valor,2)<>p_valor THEN RAISE EXCEPTION 'Transferência inválida';END IF;
  PERFORM 1 FROM public.financeiro_contas_bancarias WHERE empresa_id=p_empresa_id AND id IN(p_conta_origem_id,p_conta_destino_id) AND ativo ORDER BY id FOR UPDATE;
  IF (SELECT count(*) FROM public.financeiro_contas_bancarias WHERE empresa_id=p_empresa_id AND id IN(p_conta_origem_id,p_conta_destino_id) AND ativo)<>2 THEN RAISE EXCEPTION 'Contas inválidas';END IF;
  SELECT * INTO v_trans FROM public.financeiro_transferencias_contas WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('transferencia',to_jsonb(v_trans),'reused',true);END IF;
  SELECT saldo_atual INTO v_saldo FROM public.financeiro_contas_saldos WHERE id=p_conta_origem_id;
  IF v_saldo<p_valor THEN RAISE EXCEPTION 'Saldo insuficiente na conta de origem';END IF;
  INSERT INTO public.financeiro_transferencias_contas(empresa_id,conta_origem_id,conta_destino_id,valor,data_transferencia,descricao,comprovante_referencia,idempotency_key,criado_por)
  VALUES(p_empresa_id,p_conta_origem_id,p_conta_destino_id,p_valor,p_data,trim(p_descricao),nullif(trim(coalesce(p_comprovante,'')),''),p_idempotency_key,public.current_usuario_id()) RETURNING * INTO v_trans;
  INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,transferencia_conta_id,idempotency_key,criado_por)
  VALUES
    (p_empresa_id,p_conta_origem_id,'SAIDA','TRANSFERENCIA_INTERNA',p_valor,p_data,trim(p_descricao),v_trans.id,'transferencia-saida:'||v_trans.id::text,public.current_usuario_id()),
    (p_empresa_id,p_conta_destino_id,'ENTRADA','TRANSFERENCIA_INTERNA',p_valor,p_data,trim(p_descricao),v_trans.id,'transferencia-entrada:'||v_trans.id::text,public.current_usuario_id());
  RETURN jsonb_build_object('transferencia',to_jsonb(v_trans),'reused',false);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_registrar_pagamento_bancario(
  p_empresa_id uuid,p_conta_origem_id uuid,p_competencia text,p_valor_bruto numeric,p_itens jsonb,
  p_idempotency_key text,p_data_pagamento date DEFAULT CURRENT_DATE,p_forma_pagamento text DEFAULT 'pix',
  p_referencia_documento text DEFAULT NULL,p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_result jsonb;v_pag public.financeiro_pagamentos%ROWTYPE;v_saldo numeric;v_socio record;v_conta_destino jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira';END IF;
  PERFORM 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_origem_id AND empresa_id=p_empresa_id AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancária de origem inválida';END IF;
  v_result:=public.rpc_registrar_pagamento(p_empresa_id,p_competencia,p_valor_bruto,p_itens,p_idempotency_key,p_data_pagamento,p_forma_pagamento,p_referencia_documento,p_observacoes);
  SELECT * INTO v_pag FROM public.financeiro_pagamentos WHERE id=(v_result#>>'{pagamento,id}')::uuid;
  IF v_pag.id IS NULL THEN RAISE EXCEPTION 'Pagamento não retornado pelo motor financeiro';END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key='pagamento:'||v_pag.id::text) THEN
    RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'reused',true);
  END IF;
  SELECT saldo_atual INTO v_saldo FROM public.financeiro_contas_saldos WHERE id=p_conta_origem_id;
  IF coalesce(v_saldo,0)<v_pag.valor_liquido THEN RAISE EXCEPTION 'Saldo bancário insuficiente';END IF;
  SELECT s.*,to_jsonb(c)-'empresa_id'-'socio_id'-'created_at'-'updated_at' conta INTO v_socio
  FROM public.participantes_comerciais pc JOIN public.empresa_socios s ON s.empresa_id=pc.empresa_id AND s.usuario_id=pc.usuario_id AND s.ativo
  LEFT JOIN public.empresa_socio_contas c ON c.socio_id=s.id AND c.ativo AND c.principal
  WHERE pc.id=v_pag.participante_comercial_id AND pc.empresa_id=p_empresa_id LIMIT 1;
  v_conta_destino:=CASE WHEN v_socio.id IS NULL THEN NULL ELSE v_socio.conta END;
  INSERT INTO public.financeiro_pagamento_contas(empresa_id,pagamento_id,conta_origem_id,conta_destino_snapshot)
  VALUES(p_empresa_id,v_pag.id,p_conta_origem_id,v_conta_destino) ON CONFLICT (pagamento_id) DO NOTHING;
  IF v_pag.valor_liquido>0 THEN
    INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
    VALUES(p_empresa_id,p_conta_origem_id,'SAIDA',CASE WHEN v_socio.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,v_pag.valor_liquido,p_data_pagamento,
      'Pagamento de comissão - '||p_competencia,v_pag.id,'pagamento:'||v_pag.id::text,public.current_usuario_id())
    ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;
  END IF;
  RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'socio_destino_id',v_socio.id);
END $$;

CREATE OR REPLACE FUNCTION public.rpc_registrar_transferencia_socios(
  p_empresa_id uuid,p_socio_origem_id uuid,p_socio_destino_id uuid,p_valor numeric,p_data date,
  p_instrucao_id uuid,p_comprovante text,p_observacao text,p_idempotency_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_origem public.empresa_socios%ROWTYPE;v_destino public.empresa_socios%ROWTYPE;v_instr public.financeiro_fechamento_socios_instrucoes%ROWTYPE;v_trans record;v_usuario uuid;v_pago numeric;
BEGIN
  SELECT public.current_usuario_id() INTO v_usuario;
  SELECT * INTO v_origem FROM public.empresa_socios WHERE id=p_socio_origem_id AND empresa_id=p_empresa_id AND ativo;
  SELECT * INTO v_destino FROM public.empresa_socios WHERE id=p_socio_destino_id AND empresa_id=p_empresa_id AND ativo;
  IF v_origem.id IS NULL OR v_destino.id IS NULL OR v_origem.id=v_destino.id THEN RAISE EXCEPTION 'Sócios inválidos';END IF;
  IF auth.uid() IS NULL OR (v_origem.usuario_id<>v_usuario AND NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro')) THEN RAISE EXCEPTION 'Sem permissão para registrar a transferência';END IF;
  IF p_valor<=0 OR round(p_valor,2)<>p_valor THEN RAISE EXCEPTION 'Valor inválido';END IF;
  IF p_instrucao_id IS NOT NULL THEN
    SELECT * INTO v_instr FROM public.financeiro_fechamento_socios_instrucoes WHERE id=p_instrucao_id AND empresa_id=p_empresa_id AND devedor_socio_id=p_socio_origem_id AND credor_socio_id=p_socio_destino_id;
    IF v_instr.id IS NULL THEN RAISE EXCEPTION 'Instrução de fechamento inválida';END IF;
    SELECT coalesce(sum(valor),0) INTO v_pago FROM public.financeiro_transferencias_socios WHERE instrucao_id=v_instr.id;
    IF v_pago+p_valor>v_instr.valor_transferencia THEN RAISE EXCEPTION 'Transferência excede o saldo da instrução';END IF;
  END IF;
  SELECT * INTO v_trans FROM public.financeiro_transferencias_socios WHERE empresa_id=p_empresa_id AND idempotency_key=p_idempotency_key;
  IF FOUND THEN RETURN jsonb_build_object('transferencia',to_jsonb(v_trans),'reused',true);END IF;
  INSERT INTO public.financeiro_transferencias_socios(empresa_id,fechamento_id,instrucao_id,socio_origem_id,socio_destino_id,valor,data_transferencia,comprovante_referencia,observacao,idempotency_key,criado_por)
  VALUES(p_empresa_id,v_instr.fechamento_id,p_instrucao_id,p_socio_origem_id,p_socio_destino_id,p_valor,p_data,nullif(trim(coalesce(p_comprovante,'')),''),nullif(trim(coalesce(p_observacao,'')),''),p_idempotency_key,v_usuario) RETURNING * INTO v_trans;
  RETURN jsonb_build_object('transferencia',to_jsonb(v_trans),'reused',false);
END $$;

REVOKE ALL ON FUNCTION public.bloquear_mutacao_financeira_187(),public.registrar_recebimento_em_conta_187(),public.registrar_estorno_em_conta_187() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.rpc_registrar_movimento_bancario(uuid,uuid,text,text,numeric,date,text,text,text),public.rpc_transferir_entre_contas(uuid,uuid,uuid,numeric,date,text,text,text),public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text),public.rpc_registrar_transferencia_socios(uuid,uuid,uuid,numeric,date,uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_movimento_bancario(uuid,uuid,text,text,numeric,date,text,text,text),public.rpc_transferir_entre_contas(uuid,uuid,uuid,numeric,date,text,text,text),public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text),public.rpc_registrar_transferencia_socios(uuid,uuid,uuid,numeric,date,uuid,text,text,text) TO authenticated;

NOTIFY pgrst,'reload schema';
COMMIT;
