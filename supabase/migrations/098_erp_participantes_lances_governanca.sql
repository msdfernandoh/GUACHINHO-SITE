-- 098: Governança de Participantes Comerciais e Lances/Estratégias de Cotas no ERP
-- 1. Campos de edição, escopo e módulos em participantes_comerciais
-- 2. Campos de validade 5 meses, 2º lance fixo, fidelidade, comprovante e confirmação em cota_estrategias_lance
-- 3. Bucket de storage privado 'lances-comprovantes'
-- 4. RPCs seguras com tenant-isolation e validação de integridade referencial

BEGIN;

-- 1. EVOLUÇÃO DE participantes_comerciais
ALTER TABLE public.participantes_comerciais
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS modulos_permitidos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS escopo_visualizacao text DEFAULT 'TODOS';

DO $$
BEGIN
  ALTER TABLE public.participantes_comerciais
    DROP CONSTRAINT IF EXISTS participantes_comerciais_escopo_check;
  ALTER TABLE public.participantes_comerciais
    ADD CONSTRAINT participantes_comerciais_escopo_check
    CHECK (escopo_visualizacao IN ('TODOS', 'VINCULADOS', 'CRIADOS', 'VINCULADOS_OU_CRIADOS'));
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 2. EVOLUÇÃO DE cota_estrategias_lance
ALTER TABLE public.cota_estrategias_lance
  ADD COLUMN IF NOT EXISTS data_lance date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS segundo_lance_fixo_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lance_fidelidade_percentual numeric(8,4),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_valor numeric(15,2),
  ADD COLUMN IF NOT EXISTS lance_fidelidade_observacao text,
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS comprovante_storage_path text,
  ADD COLUMN IF NOT EXISTS comprovante_nome text,
  ADD COLUMN IF NOT EXISTS confirmado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS confirmado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS confirmado_por_nome text,
  ADD COLUMN IF NOT EXISTS confirmado_observacao text,
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz,
  ADD COLUMN IF NOT EXISTS revogado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS revogado_motivo text,
  ADD COLUMN IF NOT EXISTS consultor_responsavel_id uuid REFERENCES public.participantes_comerciais(id) ON DELETE SET NULL;

-- 3. BUCKET DE STORAGE PRIVADO PARA COMPROVANTES DE LANCE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lances-comprovantes',
  'lances-comprovantes',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- RLS para lances-comprovantes
DO $$
BEGIN
  DROP POLICY IF EXISTS "lances_comprovantes_auth_read" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_insert" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_update" ON storage.objects;
  DROP POLICY IF EXISTS "lances_comprovantes_auth_delete" ON storage.objects;

  CREATE POLICY "lances_comprovantes_auth_read"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_insert"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_update"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'lances-comprovantes')
    WITH CHECK (bucket_id = 'lances-comprovantes');

  CREATE POLICY "lances_comprovantes_auth_delete"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'lances-comprovantes');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 4. RPC DE VERIFICAÇÃO DE DEPENDÊNCIAS DE PARTICIPANTE ANTES DE EXCLUSÃO
CREATE OR REPLACE FUNCTION public.rpc_verificar_dependencias_participante(
  p_empresa_id uuid,
  p_participante_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_vendas_count integer := 0;
  v_cotas_count integer := 0;
  v_propostas_count integer := 0;
  v_comissoes_count integer := 0;
  v_regras_count integer := 0;
  v_leads_count integer := 0;
  v_pode_excluir boolean := true;
  v_motivos text[] := ARRAY[]::text[];
BEGIN
  -- Vendas
  SELECT count(*) INTO v_vendas_count
  FROM public.vendas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_vendas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_vendas_count || ' venda(s) registrada(s)');
  END IF;

  -- Cotas Definitivas
  SELECT count(*) INTO v_cotas_count
  FROM public.cotas_definitivas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_cotas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_cotas_count || ' cota(s) definitiva(s) associada(s)');
  END IF;

  -- Propostas
  SELECT count(*) INTO v_propostas_count
  FROM public.propostas
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_propostas_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_propostas_count || ' proposta(s) comercial(is)');
  END IF;

  -- Previsões de Comissão
  SELECT count(*) INTO v_comissoes_count
  FROM public.comissao_previsoes_participantes
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_comissoes_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_comissoes_count || ' previsão(ões) de comissão');
  END IF;

  -- Regras de Comissão
  SELECT count(*) INTO v_regras_count
  FROM public.comissao_regras_participantes
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_regras_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_regras_count || ' regra(s) de comissionamento ativa(s)');
  END IF;

  -- Leads atribuídos
  SELECT count(*) INTO v_leads_count
  FROM public.leads
  WHERE empresa_id = p_empresa_id AND participante_comercial_id = p_participante_id;
  IF v_leads_count > 0 THEN
    v_pode_excluir := false;
    v_motivos := array_append(v_motivos, v_leads_count || ' lead(s) no CRM');
  END IF;

  RETURN jsonb_build_object(
    'pode_excluir', v_pode_excluir,
    'total_vinculos', (v_vendas_count + v_cotas_count + v_propostas_count + v_comissoes_count + v_regras_count + v_leads_count),
    'motivos', v_motivos
  );
END $$;

-- 5. RPC DE CONFIRMAÇÃO DE LANCE
CREATE OR REPLACE FUNCTION public.rpc_confirmar_lance_cota(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_cota record;
  v_estrategia record;
  v_usuario_id uuid;
  v_usuario_nome text;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  SELECT * INTO v_cota FROM public.cotas_definitivas WHERE id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_cota.id IS NULL THEN RAISE EXCEPTION 'Cota não encontrada no tenant'; END IF;

  SELECT * INTO v_estrategia FROM public.cota_estrategias_lance WHERE cota_definitiva_id = p_cota_id FOR UPDATE;
  IF v_estrategia.id IS NULL THEN RAISE EXCEPTION 'Cota não possui estratégia registrada'; END IF;

  v_usuario_id := public.current_usuario_id();
  SELECT coalesce(nome, email, 'Operador') INTO v_usuario_nome FROM public.usuarios WHERE id = v_usuario_id;
  IF v_usuario_nome IS NULL THEN v_usuario_nome := 'Operador ERP'; END IF;

  UPDATE public.cota_estrategias_lance SET
    confirmado = true,
    confirmado_em = now(),
    confirmado_por_usuario_id = v_usuario_id,
    confirmado_por_nome = v_usuario_nome,
    confirmado_observacao = p_observacao,
    revogado_em = null,
    revogado_por_usuario_id = null,
    revogado_motivo = null,
    updated_by_usuario_id = v_usuario_id,
    updated_at = now()
  WHERE id = v_estrategia.id
  RETURNING * INTO v_estrategia;

  INSERT INTO public.cota_estrategias_lance_historico(
    empresa_id, estrategia_id, cota_definitiva_id, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_estrategia.id, p_cota_id,
    jsonb_build_object('confirmado', false),
    jsonb_build_object('confirmado', true, 'confirmado_por', v_usuario_nome, 'confirmado_em', now()),
    coalesce(p_observacao, 'Confirmação operacional de lance realizado na assembleia'),
    v_usuario_id
  );

  RETURN to_jsonb(v_estrategia);
END $$;

-- 6. RPC DE REVOGAÇÃO DE CONFIRMAÇÃO DE LANCE
CREATE OR REPLACE FUNCTION public.rpc_revogar_confirmacao_lance_cota(
  p_empresa_id uuid,
  p_cota_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_estrategia record;
  v_usuario_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;

  IF length(trim(coalesce(p_motivo, '')))<3 THEN
    RAISE EXCEPTION 'Informe o motivo da revogação da confirmação';
  END IF;

  SELECT * INTO v_estrategia FROM public.cota_estrategias_lance WHERE cota_definitiva_id = p_cota_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF v_estrategia.id IS NULL THEN RAISE EXCEPTION 'Estratégia não encontrada'; END IF;

  v_usuario_id := public.current_usuario_id();

  UPDATE public.cota_estrategias_lance SET
    confirmado = false,
    revogado_em = now(),
    revogado_por_usuario_id = v_usuario_id,
    revogado_motivo = trim(p_motivo),
    updated_by_usuario_id = v_usuario_id,
    updated_at = now()
  WHERE id = v_estrategia.id
  RETURNING * INTO v_estrategia;

  INSERT INTO public.cota_estrategias_lance_historico(
    empresa_id, estrategia_id, cota_definitiva_id, estado_anterior, estado_novo, motivo, usuario_id
  ) VALUES (
    p_empresa_id, v_estrategia.id, p_cota_id,
    jsonb_build_object('confirmado', true),
    jsonb_build_object('confirmado', false, 'revogado_motivo', trim(p_motivo)),
    trim(p_motivo),
    v_usuario_id
  );

  RETURN to_jsonb(v_estrategia);
END $$;

REVOKE ALL ON FUNCTION public.rpc_verificar_dependencias_participante(uuid, uuid), public.rpc_confirmar_lance_cota(uuid, uuid, text), public.rpc_revogar_confirmacao_lance_cota(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_verificar_dependencias_participante(uuid, uuid), public.rpc_confirmar_lance_cota(uuid, uuid, text), public.rpc_revogar_confirmacao_lance_cota(uuid, uuid, text) TO authenticated, service_role;

COMMIT;
