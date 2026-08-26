-- 105 — Hardening multi-tenant para escala de franquias
-- Forward-only. Não remove dados; separa identidade/vínculo, fecha RPCs e Storage,
-- formaliza vendas apenas com UUIDs canônicos e torna repasses transacionais.

BEGIN;

-- A operação pública é um entitlement explícito. Mantém a empresa inicial ativa
-- sem codificar seu UUID/slug no runtime; novas franquias começam fechadas.
UPDATE public.empresas
SET configuracoes = jsonb_set(
  COALESCE(configuracoes, '{}'::jsonb),
  '{site_publico,operacional_habilitado}',
  'true'::jsonb,
  true
)
WHERE slug = 'gauchinho'
  AND configuracoes #> '{site_publico,operacional_habilitado}' IS NULL;

-- ---------------------------------------------------------------------------
-- 1. Permissões granulares e preferências por vínculo empresa × usuário
-- ---------------------------------------------------------------------------
INSERT INTO public.permissoes (codigo, nome, modulo, descricao) VALUES
  ('gerenciar_comissoes', 'Gerenciar Comissões', 'comissoes', 'Configurar e operar comissões da empresa'),
  ('gerenciar_financeiro', 'Gerenciar Financeiro', 'financeiro', 'Operar recebimentos, repasses e caixa da empresa'),
  ('gerenciar_sites', 'Gerenciar Sites', 'sites', 'Configurar publicação e sites da empresa e parceiros'),
  ('gerenciar_imoveis', 'Gerenciar Imóveis', 'imoveis', 'Administrar oportunidades imobiliárias autorizadas'),
  ('formalizar_vendas', 'Formalizar Vendas', 'vendas', 'Converter contratações conferidas em vendas e cotas definitivas')
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  modulo = EXCLUDED.modulo,
  descricao = EXCLUDED.descricao;

INSERT INTO public.papel_permissoes (papel_id, permissao_id)
SELECT p.id, perm.id
FROM public.papeis p
JOIN public.permissoes perm ON perm.codigo IN (
  'gerenciar_comissoes', 'gerenciar_financeiro', 'gerenciar_sites', 'gerenciar_imoveis', 'formalizar_vendas'
)
WHERE p.codigo IN ('super_admin', 'admin_empresa') AND p.empresa_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.papel_permissoes (papel_id, permissao_id)
SELECT p.id, perm.id
FROM public.papeis p
JOIN public.permissoes perm ON perm.codigo IN (
  'gerenciar_comissoes', 'gerenciar_financeiro', 'gerenciar_imoveis', 'formalizar_vendas'
)
WHERE p.codigo = 'gestor' AND p.empresa_id IS NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.papel_permissoes (papel_id, permissao_id)
SELECT p.id, perm.id
FROM public.papeis p
JOIN public.permissoes perm ON perm.codigo = 'gerenciar_imoveis'
WHERE p.codigo = 'parceiro_imobiliaria' AND p.empresa_id IS NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS is_consultor boolean,
  ADD COLUMN IF NOT EXISTS leads_apenas_proprios boolean,
  ADD COLUMN IF NOT EXISTS agenda_acesso_todos boolean,
  ADD COLUMN IF NOT EXISTS google_agenda_sync boolean,
  ADD COLUMN IF NOT EXISTS admin_menus jsonb,
  ADD COLUMN IF NOT EXISTS configuracoes_acesso jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.empresa_usuarios eu
SET
  is_consultor = COALESCE(eu.is_consultor, u.is_consultor, false),
  leads_apenas_proprios = COALESCE(eu.leads_apenas_proprios, u.leads_apenas_proprios, false),
  agenda_acesso_todos = COALESCE(eu.agenda_acesso_todos, u.agenda_acesso_todos, false),
  google_agenda_sync = COALESCE(eu.google_agenda_sync, u.google_agenda_sync, false),
  admin_menus = COALESCE(eu.admin_menus, u.admin_menus)
FROM public.usuarios u
WHERE u.id = eu.usuario_id;

COMMENT ON COLUMN public.usuarios.perfil IS
  'LEGADO: compatibilidade de identidade. Autorização canônica usa empresa_usuarios.papel_id.';
COMMENT ON COLUMN public.empresa_usuarios.admin_menus IS
  'Menus administrativos deste vínculo; não concede autorização sem papel/permissão.';

CREATE OR REPLACE FUNCTION public.empresa_usuarios_guardar_ultimo_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_old_admin boolean;
  v_new_admin boolean := false;
BEGIN
  SELECT COALESCE(p.codigo = 'admin_empresa' AND OLD.ativo, false)
    INTO v_old_admin
  FROM public.papeis p WHERE p.id = OLD.papel_id;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(p.codigo = 'admin_empresa' AND NEW.ativo, false)
      INTO v_new_admin
    FROM public.papeis p WHERE p.id = NEW.papel_id;
  END IF;

  IF v_old_admin AND NOT v_new_admin AND NOT EXISTS (
    SELECT 1
    FROM public.empresa_usuarios eu
    JOIN public.papeis p ON p.id = eu.papel_id
    WHERE eu.empresa_id = OLD.empresa_id
      AND eu.id <> OLD.id
      AND eu.ativo
      AND p.codigo = 'admin_empresa'
      AND p.ativo
  ) THEN
    RAISE EXCEPTION 'A empresa deve manter ao menos um administrador ativo';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS empresa_usuarios_ultimo_admin_guard ON public.empresa_usuarios;
CREATE TRIGGER empresa_usuarios_ultimo_admin_guard
BEFORE UPDATE OF ativo, papel_id OR DELETE ON public.empresa_usuarios
FOR EACH ROW EXECUTE FUNCTION public.empresa_usuarios_guardar_ultimo_admin();

CREATE OR REPLACE FUNCTION public.can_manage_empresa_grupos_config(p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.has_company_permission(p_empresa_id, 'gerenciar_grupos')
$$;

REVOKE ALL ON FUNCTION public.can_manage_empresa_grupos_config(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_empresa_grupos_config(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Storage privado de repasses isolado pelo primeiro segmento empresa_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.storage_can_read_repasse_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
    AND public.can_read_tenant_internal(split_part(p_name, '/', 1)::uuid)
$$;

CREATE OR REPLACE FUNCTION public.storage_can_write_repasse_documento(p_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT p_name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/'
    AND public.has_company_permission(split_part(p_name, '/', 1)::uuid, 'gerenciar_financeiro')
$$;

REVOKE ALL ON FUNCTION public.storage_can_read_repasse_documento(text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.storage_can_write_repasse_documento(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.storage_can_read_repasse_documento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.storage_can_write_repasse_documento(text) TO authenticated;

DROP POLICY IF EXISTS repasse_documentos_auth_read ON storage.objects;
DROP POLICY IF EXISTS repasse_documentos_auth_insert ON storage.objects;
DROP POLICY IF EXISTS repasse_documentos_auth_update ON storage.objects;
DROP POLICY IF EXISTS repasse_documentos_auth_delete ON storage.objects;

CREATE POLICY repasse_documentos_tenant_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'repasse-documentos'
    AND public.storage_can_read_repasse_documento(name)
  );
CREATE POLICY repasse_documentos_tenant_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'repasse-documentos'
    AND public.storage_can_write_repasse_documento(name)
  );
CREATE POLICY repasse_documentos_tenant_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'repasse-documentos'
    AND public.storage_can_write_repasse_documento(name)
  )
  WITH CHECK (
    bucket_id = 'repasse-documentos'
    AND public.storage_can_write_repasse_documento(name)
  );
CREATE POLICY repasse_documentos_tenant_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'repasse-documentos'
    AND public.storage_can_write_repasse_documento(name)
  );

-- ---------------------------------------------------------------------------
-- 3. Solicitações de repasse: criação e transições atômicas
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_gerar_codigo_solicitacao_repasse(p_empresa_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_seq bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  v_seq := nextval('public.seq_erp_solicitacao_repasse');
  RETURN 'REP-' || to_char(now(), 'YYYY') || '-' || lpad(v_seq::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_criar_solicitacao_repasse(
  p_empresa_id uuid,
  p_codigo_solicitacao text,
  p_administradora_id uuid,
  p_mes_referencia text,
  p_valor_solicitado numeric,
  p_pedidos jsonb,
  p_status text DEFAULT 'RASCUNHO',
  p_numero_nota_fiscal text DEFAULT NULL,
  p_data_nota_fiscal date DEFAULT NULL,
  p_valor_nota_fiscal numeric DEFAULT NULL,
  p_arquivo_nf_url text DEFAULT NULL,
  p_arquivo_nf_nome text DEFAULT NULL,
  p_arquivo_pedidos_url text DEFAULT NULL,
  p_arquivo_pedidos_nome text DEFAULT NULL,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_solic public.erp_solicitacoes_repasse%ROWTYPE;
  v_pedido jsonb;
  v_numero text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  IF p_codigo_solicitacao !~ '^REP-[0-9]{4}-[0-9]{6,}$' THEN
    RAISE EXCEPTION 'Código de solicitação inválido';
  END IF;
  IF p_mes_referencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
    RAISE EXCEPTION 'Competência inválida';
  END IF;
  IF p_valor_solicitado IS NULL OR p_valor_solicitado <= 0 OR round(p_valor_solicitado, 2) <> p_valor_solicitado THEN
    RAISE EXCEPTION 'Valor solicitado inválido';
  END IF;
  IF upper(p_status) NOT IN ('RASCUNHO', 'SOLICITADO') THEN
    RAISE EXCEPTION 'Status inicial inválido';
  END IF;
  IF jsonb_typeof(p_pedidos) <> 'array' OR jsonb_array_length(p_pedidos) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos um pedido';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.empresa_administradoras ea
    JOIN public.administradoras a ON a.id = ea.administradora_id
    WHERE ea.empresa_id = p_empresa_id
      AND ea.administradora_id = p_administradora_id
      AND ea.status = 'ATIVA' AND a.status = 'ATIVA'
  ) THEN
    RAISE EXCEPTION 'Administradora sem concessão ativa para a empresa';
  END IF;
  IF p_arquivo_nf_url IS NOT NULL AND p_arquivo_nf_url NOT LIKE p_empresa_id::text || '/%' THEN
    RAISE EXCEPTION 'Caminho da nota fiscal pertence a outra empresa';
  END IF;
  IF p_arquivo_pedidos_url IS NOT NULL AND p_arquivo_pedidos_url NOT LIKE p_empresa_id::text || '/%' THEN
    RAISE EXCEPTION 'Caminho do arquivo de pedidos pertence a outra empresa';
  END IF;

  INSERT INTO public.erp_solicitacoes_repasse (
    empresa_id, codigo_solicitacao, administradora_id, mes_referencia,
    data_solicitacao, valor_solicitado, numero_nota_fiscal, data_nota_fiscal,
    valor_nota_fiscal, arquivo_nf_url, arquivo_nf_nome, arquivo_pedidos_url,
    arquivo_pedidos_nome, observacao, status, created_by_usuario_id, updated_by_usuario_id
  ) VALUES (
    p_empresa_id, p_codigo_solicitacao, p_administradora_id, p_mes_referencia,
    CURRENT_DATE, p_valor_solicitado, NULLIF(trim(p_numero_nota_fiscal), ''),
    p_data_nota_fiscal, p_valor_nota_fiscal, p_arquivo_nf_url, p_arquivo_nf_nome,
    p_arquivo_pedidos_url, p_arquivo_pedidos_nome, NULLIF(trim(p_observacao), ''),
    upper(p_status), public.current_usuario_id(), public.current_usuario_id()
  ) RETURNING * INTO v_solic;

  FOR v_pedido IN SELECT value FROM jsonb_array_elements(p_pedidos) LOOP
    v_numero := NULLIF(trim(v_pedido #>> '{}'), '');
    IF v_numero IS NULL OR length(v_numero) > 100 THEN
      RAISE EXCEPTION 'Número de pedido inválido';
    END IF;
    INSERT INTO public.erp_solicitacao_repasse_pedidos (
      empresa_id, solicitacao_id, numero_pedido, arquivo_url, arquivo_nome
    ) VALUES (
      p_empresa_id, v_solic.id, v_numero, p_arquivo_pedidos_url, p_arquivo_pedidos_nome
    );
  END LOOP;

  INSERT INTO public.erp_solicitacao_repasse_historico (
    empresa_id, solicitacao_id, acao, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_solic.id,
    CASE WHEN upper(p_status) = 'SOLICITADO' THEN 'CRIACAO_E_ENVIO' ELSE 'CRIACAO_RASCUNHO' END,
    jsonb_build_object(
      'codigo', v_solic.codigo_solicitacao,
      'status', v_solic.status,
      'valor_solicitado', v_solic.valor_solicitado,
      'pedidos_count', jsonb_array_length(p_pedidos)
    ),
    'Solicitação criada de forma transacional.', public.current_usuario_id()
  );

  RETURN jsonb_build_object('solicitacao', to_jsonb(v_solic));
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_alterar_status_solicitacao_repasse(
  p_empresa_id uuid,
  p_solicitacao_id uuid,
  p_novo_status text,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_solic public.erp_solicitacoes_repasse%ROWTYPE;
  v_novo text := upper(trim(p_novo_status));
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  SELECT * INTO v_solic FROM public.erp_solicitacoes_repasse
  WHERE id = p_solicitacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada na empresa'; END IF;
  IF v_novo = 'RECEBIDO' THEN
    RAISE EXCEPTION 'Use o registro de recebimento financeiro para marcar como RECEBIDO';
  END IF;
  IF NOT (
    (v_solic.status = 'RASCUNHO' AND v_novo IN ('SOLICITADO', 'CANCELADO')) OR
    (v_solic.status = 'SOLICITADO' AND v_novo IN ('EM_ANALISE', 'CORRECAO_SOLICITADA', 'CANCELADO')) OR
    (v_solic.status = 'EM_ANALISE' AND v_novo IN ('APROVADO', 'CORRECAO_SOLICITADA', 'RECUSADO')) OR
    (v_solic.status = 'CORRECAO_SOLICITADA' AND v_novo IN ('SOLICITADO', 'CANCELADO')) OR
    (v_solic.status = 'APROVADO' AND v_novo = 'AGUARDANDO_RECEBIMENTO')
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % -> %', v_solic.status, v_novo;
  END IF;

  UPDATE public.erp_solicitacoes_repasse
  SET status = v_novo, updated_by_usuario_id = public.current_usuario_id(), updated_at = now()
  WHERE id = v_solic.id;
  INSERT INTO public.erp_solicitacao_repasse_historico (
    empresa_id, solicitacao_id, acao, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_solic.id, 'ALTERACAO_STATUS',
    jsonb_build_object('status', v_solic.status), jsonb_build_object('status', v_novo),
    COALESCE(NULLIF(trim(p_motivo), ''), 'Transição operacional validada.'),
    public.current_usuario_id()
  );
  RETURN jsonb_build_object('solicitacao_id', v_solic.id, 'status', v_novo);
END;
$$;

-- Recompila o recebimento com identidade obrigatória e permissão granular.
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
  v_solic public.erp_solicitacoes_repasse%ROWTYPE;
  v_receb public.financeiro_recebimentos%ROWTYPE;
  v_idem_key text;
  v_res_receb jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_financeiro') THEN
    RAISE EXCEPTION 'Sem permissão financeira na empresa';
  END IF;
  IF p_data_recebimento IS NULL OR p_valor_recebido IS NULL OR p_valor_recebido <= 0
     OR round(p_valor_recebido, 2) <> p_valor_recebido THEN
    RAISE EXCEPTION 'Dados do recebimento inválidos';
  END IF;
  SELECT * INTO v_solic FROM public.erp_solicitacoes_repasse
  WHERE id = p_solicitacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada na empresa'; END IF;
  IF v_solic.recebimento_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'solicitacao_id', v_solic.id, 'recebimento_id', v_solic.recebimento_id,
      'status', v_solic.status, 'reused', true
    );
  END IF;
  IF v_solic.status NOT IN ('APROVADO', 'AGUARDANDO_RECEBIMENTO') THEN
    RAISE EXCEPTION 'Solicitação precisa estar APROVADA antes do recebimento';
  END IF;
  v_idem_key := COALESCE(NULLIF(trim(p_idempotency_key), ''), 'SOLIC-' || v_solic.id::text);
  IF length(v_idem_key) < 8 THEN RAISE EXCEPTION 'Idempotency key inválida'; END IF;

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
    p_descricao := COALESCE(p_descricao, 'Recebimento via Solicitação ' || v_solic.codigo_solicitacao),
    p_observacoes := p_observacoes
  );
  v_receb := jsonb_populate_record(NULL::public.financeiro_recebimentos, v_res_receb->'recebimento');
  IF v_receb.id IS NULL THEN RAISE EXCEPTION 'Motor financeiro não retornou recebimento íntegro'; END IF;

  UPDATE public.erp_solicitacoes_repasse
  SET recebimento_id = v_receb.id, status = 'RECEBIDO',
      updated_by_usuario_id = public.current_usuario_id(), updated_at = now()
  WHERE id = v_solic.id;
  INSERT INTO public.erp_solicitacao_repasse_historico (
    empresa_id, solicitacao_id, acao, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_solic.id, 'REGISTRO_RECEBIMENTO',
    jsonb_build_object('status', v_solic.status, 'recebimento_id', NULL),
    jsonb_build_object('status', 'RECEBIDO', 'recebimento_id', v_receb.id,
      'valor_recebido', p_valor_recebido, 'data_recebimento', p_data_recebimento),
    'Recebimento financeiro confirmado no Caixa.', public.current_usuario_id()
  );
  RETURN jsonb_build_object(
    'solicitacao_id', v_solic.id, 'recebimento_id', v_receb.id,
    'status', 'RECEBIDO', 'reused', false, 'recebimento', to_jsonb(v_receb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_gerar_codigo_solicitacao_repasse(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_criar_solicitacao_repasse(uuid,text,uuid,text,numeric,jsonb,text,text,date,numeric,text,text,text,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_alterar_status_solicitacao_repasse(uuid,uuid,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_registrar_recebimento_solicitacao_repasse(uuid,uuid,date,numeric,text,uuid,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_codigo_solicitacao_repasse(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_criar_solicitacao_repasse(uuid,text,uuid,text,numeric,jsonb,text,text,date,numeric,text,text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_alterar_status_solicitacao_repasse(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recebimento_solicitacao_repasse(uuid,uuid,date,numeric,text,uuid,text,text,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Histórico de vínculos legados: reconciliação do schema e escopo por tenant
-- ---------------------------------------------------------------------------
ALTER TABLE public.grupos_vinculacoes_legadas_historico
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;

DO $$
DECLARE
  v_empresa_unica uuid;
  v_total_empresas integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.grupos_vinculacoes_legadas_historico WHERE empresa_id IS NULL) THEN
    SELECT count(*) INTO v_total_empresas FROM public.empresas WHERE ativo;
    IF v_total_empresas = 1 THEN
      SELECT id INTO v_empresa_unica FROM public.empresas WHERE ativo LIMIT 1;
      UPDATE public.grupos_vinculacoes_legadas_historico
      SET empresa_id = v_empresa_unica
      WHERE empresa_id IS NULL;
    ELSE
      RAISE EXCEPTION 'Histórico legado sem empresa_id: classifique os registros antes de aplicar a migration 126';
    END IF;
  END IF;
END $$;

ALTER TABLE public.grupos_vinculacoes_legadas_historico
  ALTER COLUMN empresa_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS grupos_vinculacoes_legadas_empresa_idx
  ON public.grupos_vinculacoes_legadas_historico(empresa_id, created_at DESC);

DROP POLICY IF EXISTS vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_read ON public.grupos_vinculacoes_legadas_historico
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
DROP POLICY IF EXISTS vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico;
CREATE POLICY vinculacoes_legadas_write ON public.grupos_vinculacoes_legadas_historico
  FOR INSERT TO authenticated WITH CHECK (public.has_company_permission(empresa_id, 'gerenciar_grupos'));

REVOKE ALL ON FUNCTION public.rpc_vincular_grupo_legado(text,text,uuid,jsonb,boolean,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.rpc_vincular_grupo_legado(
  p_empresa_id uuid,
  p_origem text,
  p_identificador_legado text,
  p_grupo_consorcio_id uuid,
  p_produtos_mapeamento jsonb DEFAULT '[]'::jsonb,
  p_atualizar_contratacoes boolean DEFAULT true,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_afetadas integer := 0;
  v_hist_id uuid;
  v_item jsonb;
  v_credito numeric(15,2);
  v_cota_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'gerenciar_grupos') THEN
    RAISE EXCEPTION 'Sem permissão para vincular grupos nesta empresa';
  END IF;
  IF jsonb_typeof(COALESCE(p_produtos_mapeamento, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Mapeamento de produtos deve ser uma lista JSON';
  END IF;
  SELECT * INTO v_grupo FROM public.grupos_consorcio
  WHERE id = p_grupo_consorcio_id AND ativo IS TRUE;
  IF NOT FOUND OR NOT public.grupo_concedido_para_empresa(p_empresa_id, p_grupo_consorcio_id) THEN
    RAISE EXCEPTION 'Grupo canônico não concedido para a empresa';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_produtos_mapeamento, '[]'::jsonb)) LOOP
    IF (v_item->>'grupo_cota_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'UUID de produto inválido no mapeamento';
    END IF;
    v_cota_id := (v_item->>'grupo_cota_id')::uuid;
    IF NOT EXISTS (SELECT 1 FROM public.grupos_cotas WHERE id = v_cota_id AND grupo_id = v_grupo.id) THEN
      RAISE EXCEPTION 'Produto mapeado não pertence ao grupo canônico';
    END IF;
  END LOOP;

  IF p_atualizar_contratacoes THEN
    UPDATE public.contratacoes_online
    SET grupo_id = v_grupo.id,
        administradora = COALESCE(administradora, (SELECT nome FROM public.administradoras WHERE id = v_grupo.administradora_id)),
        updated_at = now()
    WHERE empresa_id = p_empresa_id
      AND (grupo_id IS NULL OR grupo_id <> v_grupo.id)
      AND (
        grupo_nome = p_identificador_legado OR grupo_nome = v_grupo.codigo_grupo
        OR dados_simulacao->>'grupo_nome' = p_identificador_legado
        OR dados_simulacao->>'codigoGrupo' = v_grupo.codigo_grupo
      );
    GET DIAGNOSTICS v_afetadas = ROW_COUNT;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_produtos_mapeamento, '[]'::jsonb)) LOOP
      v_credito := NULLIF(v_item->>'valor_credito', '')::numeric;
      v_cota_id := (v_item->>'grupo_cota_id')::uuid;
      UPDATE public.contratacoes_online
      SET cota_id = v_cota_id::text, updated_at = now()
      WHERE empresa_id = p_empresa_id AND grupo_id = v_grupo.id
        AND (cota_id IS NULL OR cota_id <> v_cota_id::text)
        AND abs(COALESCE(credito_selecionado, NULLIF(dados_simulacao->>'valor_credito', '')::numeric, 0) - v_credito) < 0.01;
    END LOOP;
  END IF;

  INSERT INTO public.grupos_vinculacoes_legadas_historico(
    empresa_id, origem, identificador_legado, grupo_consorcio_id,
    produtos_mapeamento, contratacoes_afetadas, usuario_id, observacoes, metadata
  ) VALUES (
    p_empresa_id, p_origem, p_identificador_legado, v_grupo.id,
    COALESCE(p_produtos_mapeamento, '[]'::jsonb), v_afetadas,
    public.current_usuario_id(), p_observacoes,
    jsonb_build_object('grupo_codigo', v_grupo.codigo_grupo, 'administradora_id', v_grupo.administradora_id, 'data_vinculacao', now())
  ) RETURNING id INTO v_hist_id;
  RETURN jsonb_build_object('ok', true, 'grupo_id', v_grupo.id, 'contratacoes_afetadas', v_afetadas, 'historico_id', v_hist_id);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_vincular_grupo_legado(uuid,text,text,uuid,jsonb,boolean,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_vincular_grupo_legado(uuid,text,text,uuid,jsonb,boolean,text)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Formalização: grupo, produto, modalidade e participantes por UUID exato
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_prazo_restante_grupo(
  p_grupo_id uuid,
  p_data_referencia date DEFAULT CURRENT_DATE
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_meses integer := 0;
  v_realizadas integer;
BEGIN
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id = p_grupo_id;
  IF NOT FOUND OR v_grupo.prazo_total IS NULL OR v_grupo.prazo_total <= 0 THEN
    RETURN NULL;
  END IF;
  IF COALESCE(v_grupo.atualizacao_parcelas_automatica, false)
     AND v_grupo.data_base_parcelas IS NOT NULL
     AND v_grupo.parcelas_realizadas_base IS NOT NULL THEN
    v_meses := GREATEST(
      0,
      (extract(year FROM age(p_data_referencia, v_grupo.data_base_parcelas))::integer * 12)
      + extract(month FROM age(p_data_referencia, v_grupo.data_base_parcelas))::integer
    );
    v_realizadas := LEAST(v_grupo.prazo_total, GREATEST(0, v_grupo.parcelas_realizadas_base + v_meses));
    RETURN GREATEST(v_grupo.prazo_total - v_realizadas, 0);
  END IF;
  RETURN GREATEST(
    COALESCE(v_grupo.prazo_restante, v_grupo.prazo_total - COALESCE(v_grupo.parcelas_realizadas, 0)),
    0
  );
END;
$$;
REVOKE ALL ON FUNCTION public.calcular_prazo_restante_grupo(uuid,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcular_prazo_restante_grupo(uuid,date) TO authenticated, service_role;

ALTER TABLE public.vendas
  ADD COLUMN IF NOT EXISTS prazo_original_grupo integer,
  ADD COLUMN IF NOT EXISTS parcelas_restantes_venda integer,
  ADD COLUMN IF NOT EXISTS prazo_referencia_em date;
ALTER TABLE public.cotas_definitivas
  ADD COLUMN IF NOT EXISTS prazo_original_grupo integer,
  ADD COLUMN IF NOT EXISTS parcelas_restantes_venda integer,
  ADD COLUMN IF NOT EXISTS prazo_referencia_em date;

UPDATE public.vendas v SET
  prazo_original_grupo = COALESCE(
    NULLIF(v.snapshot_venda->>'prazo_original_grupo', '')::integer,
    g.prazo_total
  ),
  parcelas_restantes_venda = COALESCE(
    NULLIF(v.snapshot_venda->>'parcelas_restantes_venda', '')::integer,
    v.prazo
  ),
  prazo_referencia_em = COALESCE(
    NULLIF(v.snapshot_venda->>'prazo_referencia_em', '')::date,
    v.data_venda::date,
    v.created_at::date
  )
FROM public.grupos_consorcio g
WHERE g.id = v.grupo_id
  AND (v.prazo_original_grupo IS NULL OR v.parcelas_restantes_venda IS NULL OR v.prazo_referencia_em IS NULL);

UPDATE public.cotas_definitivas c SET
  prazo_original_grupo = v.prazo_original_grupo,
  parcelas_restantes_venda = v.parcelas_restantes_venda,
  prazo_referencia_em = v.prazo_referencia_em
FROM public.vendas v
WHERE v.id = c.venda_id
  AND (c.prazo_original_grupo IS NULL OR c.parcelas_restantes_venda IS NULL OR c.prazo_referencia_em IS NULL);

ALTER TABLE public.vendas
  ADD CONSTRAINT vendas_prazo_original_positivo CHECK (prazo_original_grupo IS NULL OR prazo_original_grupo > 0),
  ADD CONSTRAINT vendas_parcelas_restantes_positivas CHECK (parcelas_restantes_venda IS NULL OR parcelas_restantes_venda > 0);
ALTER TABLE public.cotas_definitivas
  ADD CONSTRAINT cotas_prazo_original_positivo CHECK (prazo_original_grupo IS NULL OR prazo_original_grupo > 0),
  ADD CONSTRAINT cotas_parcelas_restantes_positivas CHECK (parcelas_restantes_venda IS NULL OR parcelas_restantes_venda > 0);

CREATE OR REPLACE FUNCTION public.venda_snapshot_prazo_restante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE v_total integer; v_restante integer; v_ref date;
BEGIN
  SELECT prazo_total INTO v_total FROM public.grupos_consorcio WHERE id = NEW.grupo_id;
  v_ref := COALESCE(NEW.data_venda::date, CURRENT_DATE);
  v_restante := public.calcular_prazo_restante_grupo(NEW.grupo_id, v_ref);
  IF v_total IS NULL OR v_total <= 0 OR v_restante IS NULL OR v_restante <= 0 THEN
    RAISE EXCEPTION 'Grupo sem prazo original/saldo de parcelas válido para venda';
  END IF;
  NEW.prazo_original_grupo := v_total;
  NEW.parcelas_restantes_venda := v_restante;
  NEW.prazo_referencia_em := v_ref;
  NEW.prazo := v_restante;
  NEW.snapshot_venda := COALESCE(NEW.snapshot_venda, '{}'::jsonb) || jsonb_build_object(
    'prazo_original_grupo', v_total,
    'parcelas_restantes_venda', v_restante,
    'prazo_referencia_em', v_ref
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS vendas_snapshot_prazo_restante ON public.vendas;
CREATE TRIGGER vendas_snapshot_prazo_restante
BEFORE INSERT ON public.vendas
FOR EACH ROW EXECUTE FUNCTION public.venda_snapshot_prazo_restante();

CREATE OR REPLACE FUNCTION public.cota_snapshot_prazo_restante()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE v_venda public.vendas%ROWTYPE;
BEGIN
  SELECT * INTO v_venda FROM public.vendas
  WHERE id = NEW.venda_id AND empresa_id = NEW.empresa_id;
  IF NOT FOUND OR v_venda.parcelas_restantes_venda IS NULL THEN
    RAISE EXCEPTION 'Venda sem snapshot de parcelas restantes';
  END IF;
  NEW.prazo_original_grupo := v_venda.prazo_original_grupo;
  NEW.parcelas_restantes_venda := v_venda.parcelas_restantes_venda;
  NEW.prazo_referencia_em := v_venda.prazo_referencia_em;
  NEW.prazo := v_venda.parcelas_restantes_venda;
  NEW.snapshot_cota := COALESCE(NEW.snapshot_cota, '{}'::jsonb) || jsonb_build_object(
    'prazo_original_grupo', v_venda.prazo_original_grupo,
    'parcelas_restantes_venda', v_venda.parcelas_restantes_venda,
    'prazo_referencia_em', v_venda.prazo_referencia_em
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS cotas_snapshot_prazo_restante ON public.cotas_definitivas;
CREATE TRIGGER cotas_snapshot_prazo_restante
BEFORE INSERT ON public.cotas_definitivas
FOR EACH ROW EXECUTE FUNCTION public.cota_snapshot_prazo_restante();

CREATE OR REPLACE FUNCTION public.rpc_preparar_formalizacao_contratacao(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_grupo_id uuid,
  p_opcao_cota_id uuid,
  p_modalidade_comissao_id uuid,
  p_participante_principal_id uuid,
  p_participante_secundario_id uuid DEFAULT NULL,
  p_fracao_secundario numeric DEFAULT NULL,
  p_perfil_principal_id uuid DEFAULT NULL,
  p_perfil_secundario_id uuid DEFAULT NULL,
  p_cronograma_secundario text DEFAULT 'SEGUIR_PRINCIPAL',
  p_data_primeira_parcela date DEFAULT NULL,
  p_data_segunda_parcela date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_contratacao public.contratacoes_online%ROWTYPE;
  v_grupo public.grupos_consorcio%ROWTYPE;
  v_cota public.grupos_cotas%ROWTYPE;
  v_regra_count integer;
  v_programa_id uuid;
  v_modalidade_codigo text;
  v_valor_parcela numeric(15,2);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_company_permission(p_empresa_id, 'formalizar_vendas') THEN
    RAISE EXCEPTION 'Sem permissão para formalizar vendas nesta empresa';
  END IF;
  SELECT * INTO v_contratacao FROM public.contratacoes_online
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada na empresa'; END IF;
  IF NOT COALESCE(v_contratacao.contrato_assinado, false) THEN
    RAISE EXCEPTION 'Contrato ainda não foi assinado';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.vendas
    WHERE empresa_id = p_empresa_id AND contratacao_id = p_contratacao_id
  ) THEN RAISE EXCEPTION 'Venda já existente para esta contratação'; END IF;

  SELECT * INTO v_grupo FROM public.grupos_consorcio
  WHERE id = p_grupo_id AND ativo IS TRUE;
  IF NOT FOUND OR v_grupo.administradora_id IS NULL THEN
    RAISE EXCEPTION 'Grupo canônico ativo não encontrado';
  END IF;
  IF NOT public.grupo_concedido_para_empresa(p_empresa_id, p_grupo_id) THEN
    RAISE EXCEPTION 'Grupo não concedido para a empresa';
  END IF;
  IF COALESCE(public.calcular_prazo_restante_grupo(p_grupo_id, CURRENT_DATE), 0) <= 0 THEN
    RAISE EXCEPTION 'Grupo sem parcelas restantes para nova venda';
  END IF;
  SELECT * INTO v_cota FROM public.grupos_cotas
  WHERE id = p_opcao_cota_id AND grupo_id = p_grupo_id
    AND ativo IS TRUE AND status NOT ILIKE 'inativo' AND status NOT ILIKE 'esgotado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Produto/cota não pertence ao grupo ou está indisponível'; END IF;
  SELECT m.codigo, mv.valor_parcela
    INTO v_modalidade_codigo, v_valor_parcela
    FROM public.grupo_cota_modalidade_valores mv
    JOIN public.grupos_modalidades_disponiveis gm
      ON gm.grupo_id = p_grupo_id
     AND gm.administradora_modalidade_id = mv.administradora_modalidade_id
     AND gm.ativo
    JOIN public.administradora_modalidades_comissao m
      ON m.id = mv.administradora_modalidade_id
     AND m.administradora_id = v_grupo.administradora_id
     AND m.ativo
    WHERE mv.grupo_cota_id = p_opcao_cota_id
      AND mv.administradora_modalidade_id = p_modalidade_comissao_id
      AND mv.ativo
      AND mv.habilitado;
  IF v_valor_parcela IS NULL OR v_valor_parcela <= 0 THEN
    RAISE EXCEPTION 'Modalidade sem valor homologado para o produto escolhido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais
    WHERE id = p_participante_principal_id AND empresa_id = p_empresa_id AND lower(status) = 'ativo'
  ) THEN RAISE EXCEPTION 'Participante principal inválido para a empresa'; END IF;
  IF p_participante_secundario_id IS NOT NULL THEN
    IF p_participante_secundario_id = p_participante_principal_id THEN
      RAISE EXCEPTION 'Participantes principal e secundário devem ser diferentes';
    END IF;
    IF p_fracao_secundario IS NULL OR p_fracao_secundario <= 0 OR p_fracao_secundario >= 100 THEN
      RAISE EXCEPTION 'Fração do participante secundário deve estar entre 0 e 100';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.participantes_comerciais
      WHERE id = p_participante_secundario_id AND empresa_id = p_empresa_id AND lower(status) = 'ativo'
    ) THEN RAISE EXCEPTION 'Participante secundário inválido para a empresa'; END IF;
  ELSIF p_fracao_secundario IS NOT NULL THEN
    RAISE EXCEPTION 'Fração secundária informada sem participante secundário';
  END IF;

  IF p_perfil_principal_id IS NULL THEN
    RAISE EXCEPTION 'Perfil de comissão do participante principal é obrigatório';
  END IF;
  SELECT rp.programa_id INTO v_programa_id
  FROM public.participante_comissao_perfis pc
  JOIN public.comissao_regras_participantes rp
    ON rp.empresa_id = pc.empresa_id
   AND rp.perfil_id = pc.perfil_id
   AND rp.ativa
   AND rp.configuracao_homologada
   AND rp.status = 'HOMOLOGADA'
   AND rp.vigencia_inicio <= CURRENT_DATE
   AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE)
  WHERE pc.empresa_id = p_empresa_id
    AND pc.participante_id = p_participante_principal_id
    AND pc.perfil_id = p_perfil_principal_id
    AND pc.ativo
    AND pc.vigencia_inicio <= CURRENT_DATE
    AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE);
  IF v_programa_id IS NULL THEN
    RAISE EXCEPTION 'Perfil principal sem regra de comissão homologada e vigente';
  END IF;

  IF p_participante_secundario_id IS NOT NULL AND p_perfil_secundario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participante_comissao_perfis pc
    WHERE pc.empresa_id = p_empresa_id
      AND pc.participante_id = p_participante_secundario_id
      AND pc.perfil_id = p_perfil_secundario_id
      AND pc.ativo
      AND pc.vigencia_inicio <= CURRENT_DATE
      AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE)
  ) THEN
    RAISE EXCEPTION 'Perfil secundário não pertence ao participante informado';
  END IF;

  IF p_cronograma_secundario NOT IN ('SEGUIR_PRINCIPAL', 'CRONOGRAMA_PROPRIO') THEN
    RAISE EXCEPTION 'Cronograma do participante secundário inválido';
  END IF;
  IF p_data_primeira_parcela IS NOT NULL AND p_data_segunda_parcela IS NOT NULL
     AND p_data_segunda_parcela < p_data_primeira_parcela THEN
    RAISE EXCEPTION 'A segunda parcela não pode vencer antes da primeira';
  END IF;

  SELECT count(*) INTO v_regra_count
  FROM public.comissao_regras_franquia r
  JOIN public.comissao_programas p ON p.id = r.programa_id
  WHERE r.empresa_id = p_empresa_id
    AND r.programa_id = v_programa_id
    AND p.id = v_programa_id
    AND p.administradora_id = v_grupo.administradora_id
    AND p.ativo AND p.status = 'ATIVO'
    AND r.ativa AND r.configuracao_homologada
    AND (r.tipo_administradora_id IS NULL OR r.tipo_administradora_id = v_grupo.tipo_administradora_id)
    AND r.modalidade_comissao_id = p_modalidade_comissao_id
    AND r.vigencia_inicio <= CURRENT_DATE
    AND (r.vigencia_fim IS NULL OR r.vigencia_fim >= CURRENT_DATE);
  IF v_regra_count <> 1 THEN
    RAISE EXCEPTION 'Formalização exige exatamente uma regra de comissão homologada; encontradas %', v_regra_count;
  END IF;

  UPDATE public.contratacoes_online SET
    grupo_id = p_grupo_id,
    cota_id = p_opcao_cota_id::text,
    participante_comercial_id = p_participante_principal_id,
    participante_secundario_id = p_participante_secundario_id,
    participante_secundario_fracao_percentual = CASE
      WHEN p_participante_secundario_id IS NULL THEN NULL ELSE p_fracao_secundario END,
    dados_simulacao = COALESCE(dados_simulacao, '{}'::jsonb) || jsonb_build_object(
      'grupoId', p_grupo_id,
      'cotaId', p_opcao_cota_id,
      'modalidade_comissao_id', p_modalidade_comissao_id,
      'tipo_venda', v_modalidade_codigo,
      'valor_credito', v_cota.valor_credito,
      'valor_parcela', v_valor_parcela,
      'perfil_principal_id', p_perfil_principal_id,
      'perfil_secundario_id', p_perfil_secundario_id,
      'programa_comissao_id', v_programa_id,
      'cronograma_secundario', p_cronograma_secundario,
      'data_primeira_parcela', p_data_primeira_parcela,
      'data_segunda_parcela', p_data_segunda_parcela,
      'fracao_secundario', CASE WHEN p_participante_secundario_id IS NULL THEN NULL ELSE p_fracao_secundario END
    ),
    status_operacional_erp = 'PRONTO_FORMALIZAR',
    pendencia_codigo = NULL,
    pendencia_descricao = NULL,
    em_conferencia_em = COALESCE(em_conferencia_em, now()),
    updated_at = now()
  WHERE id = p_contratacao_id AND empresa_id = p_empresa_id;

  INSERT INTO public.contratacoes_formalizacao_historico (
    empresa_id, contratacao_id, evento, descricao, dados
  ) VALUES (
    p_empresa_id, p_contratacao_id, 'DADOS_COMERCIAIS_AJUSTADOS',
    'UUIDs canônicos e participantes do tenant confirmados para formalização.',
    jsonb_build_object(
      'grupo_id', p_grupo_id,
      'cota_id', p_opcao_cota_id,
      'modalidade_comissao_id', p_modalidade_comissao_id,
      'perfil_principal_id', p_perfil_principal_id,
      'perfil_secundario_id', p_perfil_secundario_id,
      'programa_comissao_id', v_programa_id,
      'principal_id', p_participante_principal_id,
      'secundario_id', p_participante_secundario_id,
      'fracao_secundario', p_fracao_secundario
    )
  );
  RETURN jsonb_build_object('ok', true, 'contratacao_id', p_contratacao_id);
END;
$$;

-- Assinaturas antigas que inferiam modalidade permanecem inacessíveis, quando existirem.
DO $$
BEGIN
  IF to_regprocedure('public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
  IF to_regprocedure('public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,uuid,numeric,uuid,uuid,text,date,date) TO authenticated;

REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPCs financeiras/comissões: somente sessão autenticada, nunca service_role
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_marcar_cota_contemplada(uuid,uuid,date,text,numeric,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_conferir_pagamento_participante(uuid,uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_transferir_pendencia_recebimento(uuid,uuid,text,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_registrar_recebimento_com_divergencia(uuid,uuid,text,numeric,uuid,text,text,text,uuid,date,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_gerar_previsoes_comissao_v2(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_marcar_cota_contemplada(uuid,uuid,date,text,numeric,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_cancelar_venda_comissoes(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_conferir_pagamento_participante(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_transferir_pendencia_recebimento(uuid,uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_recebimento_com_divergencia(uuid,uuid,text,numeric,uuid,text,text,text,uuid,date,text,text) TO authenticated;

-- Platform RPCs também exigem JWT autenticado e a checagem interna de superadmin.
REVOKE ALL ON FUNCTION public.rpc_platform_criar_programa(uuid,uuid,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_salvar_dados_programa(uuid,text,text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_salvar_regra_programa(uuid,uuid,uuid,uuid,numeric,text,uuid,date,date,jsonb) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_gerar_regras_padrao_programa(uuid,numeric) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_excluir_regra_programa(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_criar_programa(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_dados_programa(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_salvar_regra_programa(uuid,uuid,uuid,uuid,numeric,text,uuid,date,date,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_gerar_regras_padrao_programa(uuid,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_excluir_regra_programa(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7. Fatos públicos também carregam empresa_id; nenhuma simulação/evento solto
-- ---------------------------------------------------------------------------
ALTER TABLE public.simulacoes_grupos
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.simulacoes_grupos_itens
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.eventos_site
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.imobiliarias
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT;
ALTER TABLE public.empresa_usuarios
  ADD COLUMN IF NOT EXISTS imobiliaria_id uuid REFERENCES public.imobiliarias(id) ON DELETE SET NULL;

UPDATE public.simulacoes_grupos s
SET empresa_id = l.empresa_id
FROM public.leads l
WHERE l.id = s.lead_id AND s.empresa_id IS NULL AND l.empresa_id IS NOT NULL;
UPDATE public.simulacoes_grupos s
SET empresa_id = e.id
FROM public.empresas e
WHERE e.slug = 'gauchinho' AND s.empresa_id IS NULL;
UPDATE public.simulacoes_grupos_itens i
SET empresa_id = s.empresa_id
FROM public.simulacoes_grupos s
WHERE s.id = i.simulacao_grupo_id AND i.empresa_id IS NULL;
UPDATE public.eventos_site ev
SET empresa_id = l.empresa_id
FROM public.leads l
WHERE l.id = ev.lead_id AND ev.empresa_id IS NULL AND l.empresa_id IS NOT NULL;
UPDATE public.eventos_site ev
SET empresa_id = e.id
FROM public.empresas e
WHERE e.slug = 'gauchinho' AND ev.empresa_id IS NULL;
UPDATE public.imobiliarias i
SET empresa_id = e.id FROM public.empresas e
WHERE e.slug = 'gauchinho' AND i.empresa_id IS NULL;
UPDATE public.imoveis i
SET empresa_id = im.empresa_id
FROM public.imobiliarias im
WHERE im.id = i.imobiliaria_id
  AND i.empresa_id IS DISTINCT FROM im.empresa_id;
UPDATE public.empresa_usuarios eu
SET imobiliaria_id = u.imobiliaria_id
FROM public.usuarios u
JOIN public.imobiliarias im ON im.id = u.imobiliaria_id
WHERE eu.usuario_id = u.id
  AND eu.empresa_id = im.empresa_id
  AND eu.imobiliaria_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.simulacoes_grupos WHERE empresa_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.simulacoes_grupos_itens WHERE empresa_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.eventos_site WHERE empresa_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.imobiliarias WHERE empresa_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.imoveis WHERE empresa_id IS NULL) THEN
    RAISE EXCEPTION 'Backfill de empresa_id incompleto em fatos públicos';
  END IF;
END;
$$;

ALTER TABLE public.simulacoes_grupos ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.simulacoes_grupos_itens ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.eventos_site ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.imobiliarias ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.imoveis ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.imobiliarias
  ADD CONSTRAINT imobiliarias_empresa_id_id_uk UNIQUE (empresa_id, id);
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_empresa_imobiliaria_fk
  FOREIGN KEY (empresa_id, imobiliaria_id)
  REFERENCES public.imobiliarias(empresa_id, id)
  ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS simulacoes_grupos_empresa_idx
  ON public.simulacoes_grupos(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS simulacoes_grupos_itens_empresa_idx
  ON public.simulacoes_grupos_itens(empresa_id, simulacao_grupo_id);
CREATE INDEX IF NOT EXISTS eventos_site_empresa_idx
  ON public.eventos_site(empresa_id, created_at DESC);
CREATE INDEX IF NOT EXISTS imobiliarias_empresa_idx
  ON public.imobiliarias(empresa_id, ativo);
CREATE INDEX IF NOT EXISTS imoveis_empresa_idx
  ON public.imoveis(empresa_id, status, ativo);
CREATE INDEX IF NOT EXISTS empresa_usuarios_imobiliaria_idx
  ON public.empresa_usuarios(empresa_id, imobiliaria_id)
  WHERE ativo = true AND imobiliaria_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_usuario_imobiliaria_id(p_empresa_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT eu.imobiliaria_id
  FROM public.empresa_usuarios eu
  JOIN public.usuarios u ON u.id = eu.usuario_id
  JOIN public.imobiliarias im
    ON im.id = eu.imobiliaria_id
   AND im.empresa_id = eu.empresa_id
  WHERE u.auth_user_id = auth.uid()
    AND u.ativo = true
    AND eu.ativo = true
    AND eu.empresa_id = p_empresa_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.current_usuario_imobiliaria_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_usuario_imobiliaria_id(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS simulacoes_insert_public ON public.simulacoes_grupos;
DROP POLICY IF EXISTS simulacoes_select_staff ON public.simulacoes_grupos;
DROP POLICY IF EXISTS simulacoes_itens_insert_public ON public.simulacoes_grupos_itens;
DROP POLICY IF EXISTS simulacoes_itens_select_staff ON public.simulacoes_grupos_itens;
CREATE POLICY simulacoes_grupos_tenant_read ON public.simulacoes_grupos
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY simulacoes_grupos_tenant_write ON public.simulacoes_grupos
  FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'gerenciar_leads'))
  WITH CHECK (public.has_company_permission(empresa_id, 'gerenciar_leads'));
CREATE POLICY simulacoes_grupos_itens_tenant_read ON public.simulacoes_grupos_itens
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY simulacoes_grupos_itens_tenant_write ON public.simulacoes_grupos_itens
  FOR ALL TO authenticated
  USING (public.has_company_permission(empresa_id, 'gerenciar_leads'))
  WITH CHECK (public.has_company_permission(empresa_id, 'gerenciar_leads'));

ALTER TABLE public.eventos_site ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS eventos_site_insert_public ON public.eventos_site;
DROP POLICY IF EXISTS eventos_insert_public ON public.eventos_site;
CREATE POLICY eventos_site_tenant_read ON public.eventos_site
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));

DROP POLICY IF EXISTS imobiliarias_select ON public.imobiliarias;
DROP POLICY IF EXISTS imobiliarias_insert_master ON public.imobiliarias;
DROP POLICY IF EXISTS imobiliarias_update ON public.imobiliarias;
DROP POLICY IF EXISTS imobiliarias_delete_master ON public.imobiliarias;
DROP POLICY IF EXISTS imobiliarias_public_read ON public.imobiliarias;
DROP POLICY IF EXISTS imoveis_select ON public.imoveis;
DROP POLICY IF EXISTS imoveis_insert ON public.imoveis;
DROP POLICY IF EXISTS imoveis_update ON public.imoveis;
DROP POLICY IF EXISTS imoveis_delete ON public.imoveis;
DROP POLICY IF EXISTS imoveis_public_read ON public.imoveis;
CREATE POLICY imobiliarias_tenant_read ON public.imobiliarias
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY imobiliarias_tenant_write ON public.imobiliarias
  FOR ALL TO authenticated
  USING (
    public.has_company_role(empresa_id, 'admin_empresa')
    OR public.has_company_role(empresa_id, 'gestor')
    OR (
      public.has_company_permission(empresa_id, 'gerenciar_imoveis')
      AND id = public.current_usuario_imobiliaria_id(empresa_id)
    )
  )
  WITH CHECK (
    public.has_company_role(empresa_id, 'admin_empresa')
    OR public.has_company_role(empresa_id, 'gestor')
    OR (
      public.has_company_permission(empresa_id, 'gerenciar_imoveis')
      AND id = public.current_usuario_imobiliaria_id(empresa_id)
    )
  );
CREATE POLICY imoveis_tenant_read ON public.imoveis
  FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY imoveis_tenant_write ON public.imoveis
  FOR ALL TO authenticated
  USING (
    public.has_company_role(empresa_id, 'admin_empresa')
    OR public.has_company_role(empresa_id, 'gestor')
    OR (
      public.has_company_permission(empresa_id, 'gerenciar_imoveis')
      AND imobiliaria_id = public.current_usuario_imobiliaria_id(empresa_id)
    )
  )
  WITH CHECK (
    public.has_company_role(empresa_id, 'admin_empresa')
    OR public.has_company_role(empresa_id, 'gestor')
    OR (
      public.has_company_permission(empresa_id, 'gerenciar_imoveis')
      AND imobiliaria_id = public.current_usuario_imobiliaria_id(empresa_id)
    )
  );

-- Rate limit durável para os Route Handlers públicos que usam service_role.
CREATE TABLE IF NOT EXISTS public.integracao_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL CHECK (length(trim(nome)) BETWEEN 3 AND 100),
  key_prefix text NOT NULL CHECK (length(trim(key_prefix)) BETWEEN 6 AND 24),
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  scopes jsonb NOT NULL DEFAULT '["catalogo:grupos:ler"]'::jsonb
    CHECK (jsonb_typeof(scopes) = 'array'),
  ativo boolean NOT NULL DEFAULT true,
  expira_em timestamptz,
  ultimo_uso_em timestamptz,
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  revogado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  revogado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, nome)
);
CREATE INDEX IF NOT EXISTS integracao_api_keys_empresa_idx
  ON public.integracao_api_keys(empresa_id, ativo);
ALTER TABLE public.integracao_api_keys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.integracao_api_keys FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.integracao_api_keys TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_platform_criar_chave_integracao(
  p_empresa_id uuid,
  p_nome text,
  p_key_prefix text,
  p_key_hash text,
  p_scopes jsonb DEFAULT '["catalogo:grupos:ler"]'::jsonb,
  p_expira_em timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE v_key public.integracao_api_keys%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadmin da plataforma pode criar chaves de integração';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_empresa_id AND ativo) THEN
    RAISE EXCEPTION 'Empresa ativa não encontrada';
  END IF;
  IF p_key_hash !~ '^[0-9a-f]{64}$'
     OR length(trim(p_key_prefix)) NOT BETWEEN 6 AND 24
     OR jsonb_typeof(p_scopes) <> 'array'
     OR jsonb_array_length(p_scopes) = 0
     OR p_expira_em <= now() THEN
    RAISE EXCEPTION 'Metadados da chave de integração inválidos';
  END IF;
  INSERT INTO public.integracao_api_keys (
    empresa_id, nome, key_prefix, key_hash, scopes, expira_em, criado_por_usuario_id
  ) VALUES (
    p_empresa_id, trim(p_nome), trim(p_key_prefix), p_key_hash, p_scopes,
    p_expira_em, public.current_usuario_id()
  ) RETURNING * INTO v_key;
  RETURN jsonb_build_object(
    'id', v_key.id, 'empresa_id', v_key.empresa_id, 'nome', v_key.nome,
    'key_prefix', v_key.key_prefix, 'scopes', v_key.scopes,
    'expira_em', v_key.expira_em, 'created_at', v_key.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_platform_revogar_chave_integracao(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_superadmin() THEN
    RAISE EXCEPTION 'Apenas superadmin da plataforma pode revogar chaves de integração';
  END IF;
  UPDATE public.integracao_api_keys SET
    ativo = false,
    revogado_em = now(),
    revogado_por_usuario_id = public.current_usuario_id(),
    updated_at = now()
  WHERE id = p_key_id AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Chave ativa não encontrada'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_platform_criar_chave_integracao(uuid,text,text,text,jsonb,timestamptz)
  FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.rpc_platform_revogar_chave_integracao(uuid)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_platform_criar_chave_integracao(uuid,text,text,text,jsonb,timestamptz)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_platform_revogar_chave_integracao(uuid)
  TO authenticated;

CREATE TABLE IF NOT EXISTS public.public_ingress_rate_limits (
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  acao text NOT NULL,
  fingerprint_hash text NOT NULL,
  janela_inicio timestamptz NOT NULL,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, acao, fingerprint_hash, janela_inicio)
);
ALTER TABLE public.public_ingress_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_ingress_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.public_ingress_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.rpc_consumir_limite_ingresso_publico(
  p_empresa_id uuid,
  p_acao text,
  p_fingerprint_hash text,
  p_limite integer DEFAULT 20,
  p_janela_segundos integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_janela timestamptz;
  v_quantidade integer;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'RPC exclusiva do ingresso público no servidor';
  END IF;
  IF p_limite < 1 OR p_limite > 1000 OR p_janela_segundos < 10 OR p_janela_segundos > 86400
     OR length(trim(COALESCE(p_acao, ''))) < 2
     OR length(trim(COALESCE(p_fingerprint_hash, ''))) < 32 THEN
    RAISE EXCEPTION 'Parâmetros de rate limit inválidos';
  END IF;
  v_janela := to_timestamp(
    floor(extract(epoch FROM now()) / p_janela_segundos) * p_janela_segundos
  );
  INSERT INTO public.public_ingress_rate_limits (
    empresa_id, acao, fingerprint_hash, janela_inicio, quantidade
  ) VALUES (
    p_empresa_id, left(trim(p_acao), 100), left(trim(p_fingerprint_hash), 128), v_janela, 1
  )
  ON CONFLICT (empresa_id, acao, fingerprint_hash, janela_inicio)
  DO UPDATE SET quantidade = public.public_ingress_rate_limits.quantidade + 1, updated_at = now()
  RETURNING quantidade INTO v_quantidade;
  IF random() < 0.01 THEN
    DELETE FROM public.public_ingress_rate_limits WHERE janela_inicio < now() - interval '7 days';
  END IF;
  RETURN v_quantidade <= p_limite;
END;
$$;
REVOKE ALL ON FUNCTION public.rpc_consumir_limite_ingresso_publico(uuid,text,text,integer,integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_consumir_limite_ingresso_publico(uuid,text,text,integer,integer)
  TO service_role;

COMMIT;
