-- 194 — Pagamento de comissão como transferência bancária entre contas da empresa.
-- Forward-only e idempotente: fatos anteriores permanecem e movimentos ausentes são acrescentados.
BEGIN;

ALTER TABLE public.financeiro_contas_bancarias
  ADD COLUMN IF NOT EXISTS participante_comercial_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS financeiro_conta_participante_ativa_uidx
  ON public.financeiro_contas_bancarias(empresa_id, participante_comercial_id)
  WHERE participante_comercial_id IS NOT NULL AND ativo;

CREATE OR REPLACE FUNCTION public.validar_conta_bancaria_participante_194()
RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais p
    WHERE p.id=NEW.participante_comercial_id AND p.empresa_id=NEW.empresa_id
  ) THEN RAISE EXCEPTION 'Conta bancária e participante pertencem a empresas diferentes'; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_conta_bancaria_participante_194 ON public.financeiro_contas_bancarias;
CREATE TRIGGER trg_conta_bancaria_participante_194
BEFORE INSERT OR UPDATE OF empresa_id,participante_comercial_id ON public.financeiro_contas_bancarias
FOR EACH ROW EXECUTE FUNCTION public.validar_conta_bancaria_participante_194();

-- Vincula contas pessoais já cadastradas quando empresa + nome identificam exatamente
-- um participante ativo e uma conta ativa ainda sem proprietário.
WITH candidatos AS (
  SELECT c.id conta_id,(array_agg(p.id))[1] participante_id
  FROM public.financeiro_contas_bancarias c
  JOIN public.participantes_comerciais p ON p.empresa_id=c.empresa_id AND p.status='ATIVO'
    AND lower(trim(p.nome))=lower(trim(c.nome))
  WHERE c.ativo AND c.participante_comercial_id IS NULL
  GROUP BY c.id HAVING count(*)=1
)
UPDATE public.financeiro_contas_bancarias c SET participante_comercial_id=x.participante_id,updated_at=now()
FROM candidatos x WHERE c.id=x.conta_id;

CREATE OR REPLACE FUNCTION public.rpc_registrar_pagamento_bancario(
  p_empresa_id uuid,p_conta_origem_id uuid,p_competencia text,p_valor_bruto numeric,p_itens jsonb,
  p_idempotency_key text,p_data_pagamento date DEFAULT CURRENT_DATE,p_forma_pagamento text DEFAULT 'pix',
  p_referencia_documento text DEFAULT NULL,p_observacoes text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE v_result jsonb;v_pag public.financeiro_pagamentos%ROWTYPE;v_saldo numeric;v_socio record;
  v_conta_destino jsonb;v_conta_destino_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id,'gerenciar_financeiro') THEN RAISE EXCEPTION 'Sem permissão financeira';END IF;
  PERFORM 1 FROM public.financeiro_contas_bancarias WHERE id=p_conta_origem_id AND empresa_id=p_empresa_id AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta bancária de origem inválida';END IF;
  v_result:=public.rpc_registrar_pagamento(p_empresa_id,p_competencia,p_valor_bruto,p_itens,p_idempotency_key,p_data_pagamento,p_forma_pagamento,p_referencia_documento,p_observacoes);
  SELECT * INTO v_pag FROM public.financeiro_pagamentos WHERE id=(v_result#>>'{pagamento,id}')::uuid;
  IF v_pag.id IS NULL THEN RAISE EXCEPTION 'Pagamento não retornado pelo motor financeiro';END IF;
  IF EXISTS(SELECT 1 FROM public.financeiro_conta_movimentos WHERE empresa_id=p_empresa_id AND idempotency_key='pagamento-saida:'||v_pag.id::text) THEN
    RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'reused',true);
  END IF;
  SELECT saldo_atual INTO v_saldo FROM public.financeiro_contas_saldos WHERE id=p_conta_origem_id;
  IF coalesce(v_saldo,0)<v_pag.valor_liquido THEN RAISE EXCEPTION 'Saldo bancário insuficiente';END IF;
  SELECT id INTO v_conta_destino_id FROM public.financeiro_contas_bancarias
  WHERE empresa_id=p_empresa_id AND participante_comercial_id=v_pag.participante_comercial_id AND ativo LIMIT 1 FOR UPDATE;
  IF v_conta_destino_id=p_conta_origem_id THEN RAISE EXCEPTION 'Conta de origem e destino da comissão não podem ser iguais';END IF;
  SELECT s.*,to_jsonb(c)-'empresa_id'-'socio_id'-'created_at'-'updated_at' conta INTO v_socio
  FROM public.participantes_comerciais pc JOIN public.empresa_socios s ON s.empresa_id=pc.empresa_id AND s.usuario_id=pc.usuario_id AND s.ativo
  LEFT JOIN public.empresa_socio_contas c ON c.socio_id=s.id AND c.ativo AND c.principal
  WHERE pc.id=v_pag.participante_comercial_id AND pc.empresa_id=p_empresa_id LIMIT 1;
  v_conta_destino:=CASE WHEN v_socio.id IS NULL THEN NULL ELSE v_socio.conta END;
  INSERT INTO public.financeiro_pagamento_contas(empresa_id,pagamento_id,conta_origem_id,conta_destino_snapshot)
  VALUES(p_empresa_id,v_pag.id,p_conta_origem_id,coalesce(v_conta_destino,jsonb_build_object('conta_bancaria_id',v_conta_destino_id))) ON CONFLICT (pagamento_id) DO NOTHING;
  IF v_pag.valor_liquido>0 THEN
    INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
    VALUES(p_empresa_id,p_conta_origem_id,'SAIDA',CASE WHEN v_socio.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,v_pag.valor_liquido,p_data_pagamento,'Pagamento de comissão - '||p_competencia,v_pag.id,'pagamento-saida:'||v_pag.id::text,public.current_usuario_id());
    IF v_conta_destino_id IS NOT NULL THEN
      INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
      VALUES(p_empresa_id,v_conta_destino_id,'ENTRADA',CASE WHEN v_socio.id IS NULL THEN 'COMISSAO_PARTICIPANTE' ELSE 'COMISSAO_SOCIO' END,v_pag.valor_liquido,p_data_pagamento,'Comissão recebida - '||p_competencia,v_pag.id,'pagamento-entrada:'||v_pag.id::text,public.current_usuario_id());
    END IF;
  END IF;
  RETURN v_result||jsonb_build_object('conta_origem_id',p_conta_origem_id,'conta_destino_id',v_conta_destino_id,'socio_destino_id',v_socio.id);
END $$;

REVOKE ALL ON FUNCTION public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pagamento_bancario(uuid,uuid,text,numeric,jsonb,text,date,text,text,text) TO authenticated,service_role;

-- Backfill fechado dos pagamentos confirmados sem lançamento: a origem é a única
-- conta ativa com saldo suficiente e sem proprietário; o destino é a conta vinculada
-- ao participante. Ambiguidades permanecem sem alteração para correção assistida.
WITH faltantes AS (
  SELECT p.*,dest.id destino_id,
    (SELECT orig.id FROM public.financeiro_contas_saldos orig
     JOIN public.financeiro_contas_bancarias ob ON ob.id=orig.id
     WHERE orig.empresa_id=p.empresa_id AND ob.ativo AND ob.participante_comercial_id IS NULL
       AND orig.saldo_atual>=p.valor_liquido
       AND (SELECT count(*) FROM public.financeiro_contas_saldos z JOIN public.financeiro_contas_bancarias zb ON zb.id=z.id
            WHERE z.empresa_id=p.empresa_id AND zb.ativo AND zb.participante_comercial_id IS NULL AND z.saldo_atual>=p.valor_liquido)=1
     LIMIT 1) origem_id
  FROM public.financeiro_pagamentos p
  JOIN public.financeiro_contas_bancarias dest ON dest.empresa_id=p.empresa_id
    AND dest.participante_comercial_id=p.participante_comercial_id AND dest.ativo
  WHERE p.status='confirmado' AND p.valor_liquido>0
    AND NOT EXISTS(SELECT 1 FROM public.financeiro_estornos e WHERE e.pagamento_id=p.id AND e.tipo='pagamento')
    AND NOT EXISTS(SELECT 1 FROM public.financeiro_conta_movimentos m WHERE m.pagamento_id=p.id)
), links AS (
  INSERT INTO public.financeiro_pagamento_contas(empresa_id,pagamento_id,conta_origem_id,conta_destino_snapshot)
  SELECT f.empresa_id,f.id,f.origem_id,jsonb_build_object('conta_bancaria_id',f.destino_id,'origem','BACKFILL_194')
  FROM faltantes f WHERE f.origem_id IS NOT NULL
  ON CONFLICT (pagamento_id) DO NOTHING RETURNING pagamento_id
)
INSERT INTO public.financeiro_conta_movimentos(empresa_id,conta_bancaria_id,tipo,categoria,valor,data_movimento,descricao,pagamento_id,idempotency_key,criado_por)
SELECT f.empresa_id,v.conta_id,v.tipo,'COMISSAO_SOCIO',f.valor_liquido,f.data_pagamento,v.descricao,f.id,v.chave,NULL
FROM faltantes f JOIN links l ON l.pagamento_id=f.id
CROSS JOIN LATERAL (VALUES
  (f.origem_id,'SAIDA'::text,'Pagamento de comissão - '||f.competencia,'pagamento-saida:'||f.id::text),
  (f.destino_id,'ENTRADA'::text,'Comissão recebida - '||f.competencia,'pagamento-entrada:'||f.id::text)
) v(conta_id,tipo,descricao,chave)
ON CONFLICT (empresa_id,idempotency_key) DO NOTHING;

COMMIT;
