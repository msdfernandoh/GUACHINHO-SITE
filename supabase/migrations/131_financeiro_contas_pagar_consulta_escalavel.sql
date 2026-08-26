-- 131: consulta escalável de Contas a Pagar
-- Paginação, filtros, totais, caixa e auditoria são calculados no banco sobre o conjunto completo.

BEGIN;

CREATE INDEX IF NOT EXISTS financeiro_cp_empresa_status_vencimento_idx
  ON public.financeiro_contas_pagar (empresa_id, status, vencimento, id)
  WHERE status <> 'cancelada';
CREATE INDEX IF NOT EXISTS financeiro_cp_empresa_status_pago_em_idx
  ON public.financeiro_contas_pagar (empresa_id, status, pago_em DESC, id)
  WHERE status = 'paga';
CREATE INDEX IF NOT EXISTS financeiro_cp_empresa_banco_centro_idx
  ON public.financeiro_contas_pagar (empresa_id, conta_bancaria_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS financeiro_cp_empresa_socio_idx
  ON public.financeiro_contas_pagar (empresa_id, socio_pagador_usuario_id)
  WHERE socio_pagador_usuario_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rpc_consultar_contas_pagar(
  p_empresa_id uuid,
  p_status text DEFAULT 'todas',
  p_data_tipo text DEFAULT 'vencimento',
  p_inicio date DEFAULT NULL,
  p_fim date DEFAULT NULL,
  p_banco_id uuid DEFAULT NULL,
  p_centro_id uuid DEFAULT NULL,
  p_socio_id uuid DEFAULT NULL,
  p_busca text DEFAULT NULL,
  p_card text DEFAULT NULL,
  p_ordenacao text DEFAULT 'vencimento_asc',
  p_pagina integer DEFAULT 1,
  p_por_pagina integer DEFAULT 25,
  p_log_acao text DEFAULT NULL,
  p_log_busca text DEFAULT NULL,
  p_log_inicio date DEFAULT NULL,
  p_log_fim date DEFAULT NULL,
  p_log_pagina integer DEFAULT 1,
  p_logs_por_pagina integer DEFAULT 50
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_pagina integer := greatest(coalesce(p_pagina, 1), 1);
  v_por_pagina integer := least(greatest(coalesce(p_por_pagina, 25), 10), 100);
  v_log_pagina integer := greatest(coalesce(p_log_pagina, 1), 1);
  v_logs_por_pagina integer := least(greatest(coalesce(p_logs_por_pagina, 50), 10), 100);
  v_inicio_mes date := date_trunc('month', current_date)::date;
  v_proximo_mes date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_read_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Sem acesso financeiro à empresa';
  END IF;
  IF p_status NOT IN ('todas', 'abertas', 'pagas') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  IF p_data_tipo NOT IN ('vencimento', 'pagamento') THEN RAISE EXCEPTION 'Tipo de data inválido'; END IF;
  IF p_card IS NOT NULL AND p_card NOT IN ('pagas_mes','a_pagar_mes','futuras','entradas_mes') THEN
    RAISE EXCEPTION 'Card inválido';
  END IF;

  WITH contas_base AS MATERIALIZED (
    SELECT c.*,
      CASE WHEN p_data_tipo = 'pagamento' THEN c.pago_em ELSE c.vencimento END AS data_filtro
    FROM public.financeiro_contas_pagar c
    WHERE c.empresa_id = p_empresa_id AND c.status <> 'cancelada'
      AND (p_banco_id IS NULL OR c.conta_bancaria_id = p_banco_id)
      AND (p_centro_id IS NULL OR c.centro_custo_id = p_centro_id)
      AND (p_socio_id IS NULL OR c.socio_pagador_usuario_id = p_socio_id)
  ), contas_filtradas AS MATERIALIZED (
    SELECT c.* FROM contas_base c
    WHERE (p_status = 'todas' OR (p_status = 'abertas' AND c.status = 'aberta') OR (p_status = 'pagas' AND c.status = 'paga'))
      AND (p_inicio IS NULL OR c.data_filtro >= p_inicio)
      AND (p_fim IS NULL OR c.data_filtro <= p_fim)
      AND (nullif(trim(coalesce(p_busca,'')), '') IS NULL OR
        c.descricao ILIKE '%' || trim(p_busca) || '%' OR
        coalesce(c.fornecedor,'') ILIKE '%' || trim(p_busca) || '%' OR
        coalesce(c.observacao,'') ILIKE '%' || trim(p_busca) || '%')
      AND (p_card IS NULL
        OR (p_card='pagas_mes' AND c.status='paga' AND c.pago_em >= v_inicio_mes AND c.pago_em < v_proximo_mes)
        OR (p_card='a_pagar_mes' AND c.status='aberta' AND c.vencimento >= v_inicio_mes AND c.vencimento < v_proximo_mes)
        OR (p_card='futuras' AND c.status='aberta' AND c.vencimento >= v_proximo_mes))
  ), contas_ordenadas AS MATERIALIZED (
    SELECT c.* FROM contas_filtradas c
    ORDER BY
      CASE WHEN p_ordenacao='vencimento_asc' THEN c.vencimento END ASC,
      CASE WHEN p_ordenacao='vencimento_desc' THEN c.vencimento END DESC,
      CASE WHEN p_ordenacao='pagamento_asc' THEN coalesce(c.pago_em,c.vencimento) END ASC,
      CASE WHEN p_ordenacao='pagamento_desc' THEN coalesce(c.pago_em,c.vencimento) END DESC,
      CASE WHEN p_ordenacao IN ('nome_asc','fornecedor_asc') THEN coalesce(c.fornecedor,c.descricao) END ASC,
      CASE WHEN p_ordenacao IN ('nome_desc','fornecedor_desc') THEN coalesce(c.fornecedor,c.descricao) END DESC,
      CASE WHEN p_ordenacao='valor_asc' THEN c.valor END ASC,
      CASE WHEN p_ordenacao='valor_desc' THEN c.valor END DESC,
      c.vencimento ASC, c.id ASC
  ), contas_pagina AS (
    SELECT * FROM contas_ordenadas OFFSET (v_pagina - 1) * v_por_pagina LIMIT v_por_pagina
  ), pagas_periodo AS MATERIALIZED (
    SELECT c.*,
      coalesce(c.descontado_comissao,false) OR coalesce(cc.descontado_comissao,false) AS descontada
    FROM contas_base c LEFT JOIN public.financeiro_centros_custo cc ON cc.id=c.centro_custo_id AND cc.empresa_id=p_empresa_id
    WHERE c.status='paga'
      AND (p_inicio IS NULL OR c.data_filtro >= p_inicio) AND (p_fim IS NULL OR c.data_filtro <= p_fim)
  ), socios AS MATERIALIZED (
    SELECT eu.usuario_id, u.nome, row_number() over(order by u.nome,u.id) AS ordem
    FROM public.empresa_usuarios eu JOIN public.usuarios u ON u.id=eu.usuario_id
    WHERE eu.empresa_id=p_empresa_id AND eu.ativo AND eu.socio_pagador AND u.ativo
  ), socio_totais AS MATERIALIZED (
    SELECT s.usuario_id,s.nome,s.ordem,
      coalesce((SELECT sum(p.valor) FROM pagas_periodo p WHERE p.socio_pagador_usuario_id=s.usuario_id AND NOT p.descontada),0) AS pago,
      (SELECT count(*) FROM pagas_periodo p WHERE p.socio_pagador_usuario_id=s.usuario_id AND NOT p.descontada) AS contas_pagas,
      coalesce((SELECT sum(c.valor) FROM contas_base c WHERE c.status='aberta' AND c.socio_pagador_usuario_id=s.usuario_id
        AND (p_inicio IS NULL OR c.vencimento>=p_inicio) AND (p_fim IS NULL OR c.vencimento<=p_fim)),0) AS aberto,
      (SELECT count(*) FROM contas_base c WHERE c.status='aberta' AND c.socio_pagador_usuario_id=s.usuario_id
        AND (p_inicio IS NULL OR c.vencimento>=p_inicio) AND (p_fim IS NULL OR c.vencimento<=p_fim)) AS contas_abertas
    FROM socios s
  ), logs_filtrados AS MATERIALIZED (
    SELECT l.*, jsonb_build_object('nome',u.nome,'email',u.email) AS usuario
    FROM public.financeiro_contas_pagar_logs l LEFT JOIN public.usuarios u ON u.id=l.usuario_id
    WHERE l.empresa_id=p_empresa_id
      AND (nullif(trim(coalesce(p_log_acao,'')),'') IS NULL OR l.acao=p_log_acao)
      AND (p_log_inicio IS NULL OR l.created_at::date >= p_log_inicio)
      AND (p_log_fim IS NULL OR l.created_at::date <= p_log_fim)
      AND (nullif(trim(coalesce(p_log_busca,'')),'') IS NULL OR l.descricao ILIKE '%'||trim(p_log_busca)||'%'
        OR coalesce(l.fornecedor,'') ILIKE '%'||trim(p_log_busca)||'%' OR coalesce(l.motivo,'') ILIKE '%'||trim(p_log_busca)||'%'
        OR coalesce(u.nome,'') ILIKE '%'||trim(p_log_busca)||'%' OR coalesce(u.email,'') ILIKE '%'||trim(p_log_busca)||'%')
  ), logs_pagina AS (
    SELECT * FROM logs_filtrados ORDER BY created_at DESC,id DESC
    OFFSET (v_log_pagina-1)*v_logs_por_pagina LIMIT v_logs_por_pagina
  )
  SELECT jsonb_build_object(
    'contas', coalesce((SELECT jsonb_agg(to_jsonb(x) - 'data_filtro') FROM contas_pagina x),'[]'::jsonb),
    'total_contas', (SELECT count(*) FROM contas_filtradas),
    'pagina', v_pagina, 'por_pagina', v_por_pagina,
    'saldo_caixa', coalesce((SELECT sum(CASE WHEN tipo_movimento='entrada' THEN valor ELSE -valor END) FROM public.caixa_movimentos WHERE empresa_id=p_empresa_id),0),
    'cards', jsonb_build_object(
      'pagas_mes',coalesce((SELECT sum(valor) FROM contas_base WHERE status='paga' AND pago_em>=v_inicio_mes AND pago_em<v_proximo_mes),0),
      'a_pagar_mes',coalesce((SELECT sum(valor) FROM contas_base WHERE status='aberta' AND vencimento>=v_inicio_mes AND vencimento<v_proximo_mes),0),
      'futuras',coalesce((SELECT sum(valor) FROM contas_base WHERE status='aberta' AND vencimento>=v_proximo_mes),0),
      'entradas_mes',coalesce((SELECT sum(valor) FROM public.caixa_movimentos WHERE empresa_id=p_empresa_id AND tipo_movimento='entrada' AND data_movimento>=v_inicio_mes AND data_movimento<v_proximo_mes),0)
    ),
    'entradas_mes',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY data_movimento DESC,id DESC) FROM (SELECT id,tipo_movimento,valor,data_movimento,descricao FROM public.caixa_movimentos WHERE empresa_id=p_empresa_id AND tipo_movimento='entrada' AND data_movimento>=v_inicio_mes AND data_movimento<v_proximo_mes ORDER BY data_movimento DESC,id DESC LIMIT 100) m),'[]'::jsonb),
    'balanco',jsonb_build_object(
      'socios',coalesce((SELECT jsonb_agg(jsonb_build_object('id',usuario_id,'nome',nome,'pago',pago,'contas_pagas',contas_pagas,'aberto',aberto,'contas_abertas',contas_abertas) ORDER BY ordem) FROM socio_totais),'[]'::jsonb),
      'pago_empresa',coalesce((SELECT sum(valor) FROM pagas_periodo WHERE NOT descontada AND NOT pago_pessoalmente AND socio_pagador_usuario_id IS NULL),0),
      'contas_pagas_empresa',(SELECT count(*) FROM pagas_periodo WHERE NOT descontada AND NOT pago_pessoalmente AND socio_pagador_usuario_id IS NULL),
      'impostos_descontados',coalesce((SELECT sum(valor) FROM pagas_periodo WHERE descontada),0),
      'contas_descontadas',(SELECT count(*) FROM pagas_periodo WHERE descontada)
    ),
    'logs',coalesce((SELECT jsonb_agg(to_jsonb(x) ORDER BY created_at DESC,id DESC) FROM logs_pagina x),'[]'::jsonb),
    'total_logs',(SELECT count(*) FROM logs_filtrados),
    'fornecedores_uso',coalesce((SELECT jsonb_agg(jsonb_build_object('nome',fornecedor,'total',total) ORDER BY fornecedor) FROM (SELECT fornecedor,count(*) total FROM contas_base WHERE nullif(trim(fornecedor),'') IS NOT NULL GROUP BY fornecedor) f),'[]'::jsonb)
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_consultar_contas_pagar(uuid,text,text,date,date,uuid,uuid,uuid,text,text,text,integer,integer,text,text,date,date,integer,integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_consultar_contas_pagar(uuid,text,text,date,date,uuid,uuid,uuid,text,text,text,integer,integer,text,text,date,date,integer,integer)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
