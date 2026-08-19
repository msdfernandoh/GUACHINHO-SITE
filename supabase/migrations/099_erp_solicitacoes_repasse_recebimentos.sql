-- Migration 099: ERP Solicitações de Repasse da Franquia & Integração com Recebimentos Financeiros
-- Criação de tabelas de solicitações de repasse, pedidos vinculados, histórico de auditoria e RPC de recebimento atômico.

-- 1. BUCKET DE STORAGE PRIVADO PARA DOCUMENTOS DE REPASSE (NF e Pedidos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'repasse-documentos',
  'repasse-documentos',
  false,
  15728640, -- 15MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 15728640,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- RLS para repasse-documentos
DO $$
BEGIN
  DROP POLICY IF EXISTS "repasse_documentos_auth_read" ON storage.objects;
  DROP POLICY IF EXISTS "repasse_documentos_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "repasse_documentos_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "repasse_documentos_auth_delete" ON storage.objects;

  CREATE POLICY "repasse_documentos_auth_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'repasse-documentos');

  CREATE POLICY "repasse_documentos_auth_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'repasse-documentos');

  CREATE POLICY "repasse_documentos_auth_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'repasse-documentos');

  CREATE POLICY "repasse_documentos_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'repasse-documentos');
END $$;

-- 2. SEQUÊNCIA PARA NÚMERO DE SOLICITAÇÃO DE REPASSE
CREATE SEQUENCE IF NOT EXISTS public.seq_erp_solicitacao_repasse START 1;

-- 3. TABELA DE SOLICITAÇÕES DE REPASSE
CREATE TABLE IF NOT EXISTS public.erp_solicitacoes_repasse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  codigo_solicitacao text NOT NULL,
  administradora_id uuid NOT NULL REFERENCES public.administradoras(id) ON DELETE RESTRICT,
  mes_referencia text NOT NULL, -- Formato YYYY-MM
  data_solicitacao date NOT NULL DEFAULT CURRENT_DATE,
  valor_solicitado numeric(15,2) NOT NULL CHECK (valor_solicitado > 0),
  numero_nota_fiscal text,
  data_nota_fiscal date,
  valor_nota_fiscal numeric(15,2) CHECK (valor_nota_fiscal IS NULL OR valor_nota_fiscal >= 0),
  arquivo_nf_url text,
  arquivo_nf_nome text,
  arquivo_pedidos_url text,
  arquivo_pedidos_nome text,
  observacao text,
  status text NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN (
    'RASCUNHO',
    'SOLICITADO',
    'EM_ANALISE',
    'APROVADO',
    'AGUARDANDO_RECEBIMENTO',
    'RECEBIDO',
    'CORRECAO_SOLICITADA',
    'RECUSADO',
    'CANCELADO'
  )),
  recebimento_id uuid REFERENCES public.financeiro_recebimentos(id) ON DELETE SET NULL,
  created_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  updated_by_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, codigo_solicitacao),
  UNIQUE (id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_solicitacoes_repasse_empresa ON public.erp_solicitacoes_repasse(empresa_id);
CREATE INDEX IF NOT EXISTS idx_erp_solicitacoes_repasse_admin ON public.erp_solicitacoes_repasse(administradora_id);
CREATE INDEX IF NOT EXISTS idx_erp_solicitacoes_repasse_status ON public.erp_solicitacoes_repasse(status);
CREATE INDEX IF NOT EXISTS idx_erp_solicitacoes_repasse_mes ON public.erp_solicitacoes_repasse(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_erp_solicitacoes_repasse_recebimento ON public.erp_solicitacoes_repasse(recebimento_id);

-- 4. TABELA DE PEDIDOS DA SOLICITAÇÃO
CREATE TABLE IF NOT EXISTS public.erp_solicitacao_repasse_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  solicitacao_id uuid NOT NULL REFERENCES public.erp_solicitacoes_repasse(id) ON DELETE CASCADE,
  numero_pedido text NOT NULL,
  arquivo_url text,
  arquivo_nome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitacao_id, numero_pedido),
  UNIQUE (id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_erp_solic_pedidos_solicitacao ON public.erp_solicitacao_repasse_pedidos(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_erp_solic_pedidos_num ON public.erp_solicitacao_repasse_pedidos(numero_pedido);

-- 5. TABELA DE HISTÓRICO DE AUDITORIA DAS SOLICITAÇÕES
CREATE TABLE IF NOT EXISTS public.erp_solicitacao_repasse_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  solicitacao_id uuid NOT NULL REFERENCES public.erp_solicitacoes_repasse(id) ON DELETE CASCADE,
  acao text NOT NULL,
  estado_anterior jsonb,
  estado_novo jsonb,
  motivo text,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_erp_solic_historico_solicitacao ON public.erp_solicitacao_repasse_historico(solicitacao_id);

-- 6. HABILITAR RLS NAS NOVAS TABELAS
ALTER TABLE public.erp_solicitacoes_repasse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_solicitacao_repasse_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_solicitacao_repasse_historico ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "erp_solicitacoes_repasse_select" ON public.erp_solicitacoes_repasse;
  DROP POLICY IF EXISTS "erp_solicitacoes_repasse_all" ON public.erp_solicitacoes_repasse;
  DROP POLICY IF EXISTS "erp_solicitacao_pedidos_all" ON public.erp_solicitacao_repasse_pedidos;
  DROP POLICY IF EXISTS "erp_solicitacao_historico_all" ON public.erp_solicitacao_repasse_historico;

  CREATE POLICY "erp_solicitacoes_repasse_select"
    ON public.erp_solicitacoes_repasse FOR SELECT
    TO authenticated
    USING (public.can_read_tenant_internal(empresa_id));

  CREATE POLICY "erp_solicitacoes_repasse_all"
    ON public.erp_solicitacoes_repasse FOR ALL
    TO authenticated
    USING (public.can_write_tenant_internal(empresa_id))
    WITH CHECK (public.can_write_tenant_internal(empresa_id));

  CREATE POLICY "erp_solicitacao_pedidos_all"
    ON public.erp_solicitacao_repasse_pedidos FOR ALL
    TO authenticated
    USING (public.can_write_tenant_internal(empresa_id))
    WITH CHECK (public.can_write_tenant_internal(empresa_id));

  CREATE POLICY "erp_solicitacao_historico_all"
    ON public.erp_solicitacao_repasse_historico FOR ALL
    TO authenticated
    USING (public.can_read_tenant_internal(empresa_id))
    WITH CHECK (public.can_write_tenant_internal(empresa_id));
END $$;

-- 7. FUNÇÃO RPC PARA GERAR CÓDIGO DA SOLICITAÇÃO
CREATE OR REPLACE FUNCTION public.rpc_gerar_codigo_solicitacao_repasse(p_empresa_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_ano text;
  v_seq bigint;
  v_codigo text;
BEGIN
  v_ano := to_char(now(), 'YYYY');
  v_seq := nextval('public.seq_erp_solicitacao_repasse');
  v_codigo := 'REP-' || v_ano || '-' || lpad(v_seq::text, 6, '0');
  RETURN v_codigo;
END $$;

-- 8. FUNÇÃO RPC PARA REGISTRAR RECEBIMENTO A PARTIR DA SOLICITAÇÃO (INTEGRAÇÃO CANÔNICA)
CREATE OR REPLACE FUNCTION public.rpc_registrar_recebimento_solicitacao_repasse(
  p_empresa_id uuid,
  p_solicitacao_id uuid,
  p_data_recebimento date,
  p_valor_recebido numeric,
  p_conta_entrada text,
  p_conta_bancaria_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE
  v_solic record;
  v_receb record;
  v_idem_key text;
  v_res_receb jsonb;
  v_usuario_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  v_usuario_id := public.current_usuario_id();

  -- Lock pessimista na solicitação
  SELECT * INTO v_solic
  FROM public.erp_solicitacoes_repasse
  WHERE id = p_solicitacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF v_solic.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação de repasse não encontrada no tenant';
  END IF;

  -- Proteção contra duplicidade / Idempotência
  IF v_solic.recebimento_id IS NOT NULL THEN
    SELECT * INTO v_receb FROM public.financeiro_recebimentos WHERE id = v_solic.recebimento_id;
    RETURN jsonb_build_object(
      'solicitacao_id', v_solic.id,
      'recebimento_id', v_solic.recebimento_id,
      'status', v_solic.status,
      'reused', true,
      'recebimento', to_jsonb(v_receb)
    );
  END IF;

  IF v_solic.status IN ('CANCELADO', 'RECUSADO') THEN
    RAISE EXCEPTION 'Não é permitido registrar recebimento em solicitação %', v_solic.status;
  END IF;

  v_idem_key := coalesce(nullif(trim(p_idempotency_key), ''), 'SOLIC-' || v_solic.id::text || '-' || to_char(now(), 'YYYYMMDDHH24MISS'));

  -- Executa chamada ao motor financeiro canônico
  v_res_receb := public.rpc_registrar_recebimento_manual(
    p_empresa_id := p_empresa_id,
    p_administradora_id := v_solic.administradora_id,
    p_competencia := v_solic.mes_referencia,
    p_valor_total := p_valor_recebido,
    p_data_recebimento := p_data_recebimento,
    p_conta_entrada := p_conta_entrada,
    p_idempotency_key := v_idem_key,
    p_conta_bancaria_id := p_conta_bancaria_id,
    p_numero_nota_fiscal := v_solic.numero_nota_fiscal,
    p_data_nota_fiscal := v_solic.data_nota_fiscal,
    p_descricao := coalesce(p_descricao, 'Recebimento via Solicitação ' || v_solic.codigo_solicitacao),
    p_observacoes := p_observacoes
  );

  v_receb := jsonb_populate_record(NULL::public.financeiro_recebimentos, v_res_receb->'recebimento');

  IF v_receb.id IS NULL THEN
    RAISE EXCEPTION 'Falha ao gerar o recebimento financeiro canônico';
  END IF;

  -- Atualiza a solicitação para RECEBIDO e vincula o recebimento_id
  UPDATE public.erp_solicitacoes_repasse
  SET
    recebimento_id = v_receb.id,
    status = 'RECEBIDO',
    updated_by_usuario_id = v_usuario_id,
    updated_at = now()
  WHERE id = v_solic.id;

  -- Grava histórico de auditoria
  INSERT INTO public.erp_solicitacao_repasse_historico(
    empresa_id,
    solicitacao_id,
    acao,
    estado_anterior,
    estado_novo,
    motivo,
    usuario_id
  ) VALUES (
    p_empresa_id,
    v_solic.id,
    'REGISTRO_RECEBIMENTO',
    jsonb_build_object('status', v_solic.status, 'recebimento_id', null),
    jsonb_build_object('status', 'RECEBIDO', 'recebimento_id', v_receb.id, 'valor_recebido', p_valor_recebido, 'data_recebimento', p_data_recebimento),
    'Recebimento financeiro confirmado no Caixa.',
    v_usuario_id
  );

  RETURN jsonb_build_object(
    'solicitacao_id', v_solic.id,
    'recebimento_id', v_receb.id,
    'status', 'RECEBIDO',
    'reused', false,
    'recebimento', to_jsonb(v_receb)
  );
END $$;

GRANT EXECUTE ON FUNCTION public.rpc_gerar_codigo_solicitacao_repasse(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recebimento_solicitacao_repasse(uuid, uuid, date, numeric, text, uuid, text, text, text) TO authenticated, service_role;
