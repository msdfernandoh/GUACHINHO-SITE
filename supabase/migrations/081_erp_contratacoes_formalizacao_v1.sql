-- 081 — Fila operacional ERP para formalização de contratações assinadas.
-- Não cria um segundo motor de venda: a conversão continua exclusivamente em
-- rpc_converter_contratacao_venda (060–063/076).

BEGIN;

ALTER TABLE public.contratacoes_online
  ADD COLUMN IF NOT EXISTS status_operacional_erp text,
  ADD COLUMN IF NOT EXISTS em_conferencia_em timestamptz,
  ADD COLUMN IF NOT EXISTS formalizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pendencia_codigo text,
  ADD COLUMN IF NOT EXISTS pendencia_descricao text;

ALTER TABLE public.contratacoes_online
  DROP CONSTRAINT IF EXISTS contratacoes_status_operacional_erp_check,
  ADD CONSTRAINT contratacoes_status_operacional_erp_check CHECK (
    status_operacional_erp IS NULL OR status_operacional_erp IN (
      'AGUARDANDO_ASSINATURA','AGUARDANDO_FORMALIZACAO','EM_CONFERENCIA',
      'PRONTO_FORMALIZAR','FORMALIZADA','PENDENCIA','INVALIDADA'
    )
  );

CREATE INDEX IF NOT EXISTS contratacoes_operacao_erp_idx
  ON public.contratacoes_online (empresa_id, status_operacional_erp, contrato_assinado_em DESC);

CREATE TABLE IF NOT EXISTS public.contratacoes_formalizacao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  contratacao_id uuid NOT NULL,
  evento text NOT NULL CHECK (evento IN (
    'CONFERENCIA_INICIADA','DADOS_COMERCIAIS_AJUSTADOS','PENDENCIA_REGISTRADA',
    'FORMALIZADA','NUMERO_COTA_ATUALIZADO','INVALIDADA'
  )),
  descricao text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contratacoes_formalizacao_historico_tenant_fkey
    FOREIGN KEY (contratacao_id, empresa_id)
    REFERENCES public.contratacoes_online(id, empresa_id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS contratacoes_formalizacao_historico_idx
  ON public.contratacoes_formalizacao_historico (empresa_id, contratacao_id, created_at DESC);

ALTER TABLE public.contratacoes_formalizacao_historico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.contratacoes_formalizacao_historico FROM PUBLIC, anon;
GRANT ALL ON TABLE public.contratacoes_formalizacao_historico TO service_role;
GRANT SELECT, INSERT ON TABLE public.contratacoes_formalizacao_historico TO authenticated;

CREATE POLICY contratacoes_formalizacao_historico_select
  ON public.contratacoes_formalizacao_historico FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY contratacoes_formalizacao_historico_insert
  ON public.contratacoes_formalizacao_historico FOR INSERT TO authenticated
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

CREATE OR REPLACE FUNCTION public.rpc_preparar_formalizacao_contratacao(
  p_empresa_id uuid,
  p_contratacao_id uuid,
  p_grupo_id uuid,
  p_opcao_cota_id uuid,
  p_participante_principal_id uuid,
  p_participante_secundario_id uuid DEFAULT NULL,
  p_fracao_secundario numeric DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE v_contratacao public.contratacoes_online%ROWTYPE; v_grupo public.grupos_consorcio%ROWTYPE;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.can_write_tenant_internal(p_empresa_id) THEN
    RAISE EXCEPTION 'Acesso negado ao tenant';
  END IF;
  SELECT * INTO v_contratacao FROM public.contratacoes_online
    WHERE id=p_contratacao_id AND empresa_id=p_empresa_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contratação não encontrada no tenant'; END IF;
  IF NOT COALESCE(v_contratacao.contrato_assinado,false) THEN
    RAISE EXCEPTION 'Contrato ainda não foi assinado';
  END IF;
  IF EXISTS (SELECT 1 FROM public.vendas WHERE empresa_id=p_empresa_id AND contratacao_id=p_contratacao_id) THEN
    RAISE EXCEPTION 'Venda já existente para esta contratação';
  END IF;
  SELECT * INTO v_grupo FROM public.grupos_consorcio WHERE id=p_grupo_id;
  IF NOT FOUND OR v_grupo.administradora_id IS NULL THEN RAISE EXCEPTION 'Grupo não configurado'; END IF;
  IF v_grupo.tipo_administradora_id IS NULL OR v_grupo.modalidade_comissao_id IS NULL
     OR v_grupo.status_governanca='CONFIGURACAO_PENDENTE' THEN
    RAISE EXCEPTION 'Grupo com configuração pendente';
  END IF;
  IF p_opcao_cota_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.grupos_cotas gc
    WHERE gc.id=p_opcao_cota_id AND gc.grupo_id=p_grupo_id AND gc.ativo
      AND gc.status NOT IN ('Inativo','Esgotado')
  ) THEN RAISE EXCEPTION 'Produto comercial ausente ou inválido'; END IF;
  IF p_participante_principal_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais pc
    WHERE pc.id=p_participante_principal_id AND pc.empresa_id=p_empresa_id AND upper(pc.status)='ATIVO'
  ) THEN RAISE EXCEPTION 'Consultor principal inválido'; END IF;
  IF p_participante_secundario_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais pc
    WHERE pc.id=p_participante_secundario_id AND pc.empresa_id=p_empresa_id AND upper(pc.status)='ATIVO'
  ) THEN RAISE EXCEPTION 'Participante secundário inválido'; END IF;

  UPDATE public.contratacoes_online SET
    grupo_id=p_grupo_id, cota_id=p_opcao_cota_id::text,
    participante_comercial_id=p_participante_principal_id,
    participante_secundario_id=p_participante_secundario_id,
    participante_secundario_fracao_percentual=CASE WHEN p_participante_secundario_id IS NULL THEN NULL ELSE p_fracao_secundario END,
    status_operacional_erp='PRONTO_FORMALIZAR', pendencia_codigo=NULL,
    pendencia_descricao=NULL, em_conferencia_em=COALESCE(em_conferencia_em,now()), updated_at=now()
  WHERE id=p_contratacao_id AND empresa_id=p_empresa_id;

  INSERT INTO public.contratacoes_formalizacao_historico
    (empresa_id,contratacao_id,evento,descricao,dados,usuario_id)
  VALUES (p_empresa_id,p_contratacao_id,'DADOS_COMERCIAIS_AJUSTADOS',
    'Dados conferidos antes da formalização.',
    jsonb_build_object('grupo_id',p_grupo_id,'opcao_cota_id',p_opcao_cota_id,
      'participante_principal_id',p_participante_principal_id,
      'participante_secundario_id',p_participante_secundario_id), public.current_usuario_id());
  RETURN jsonb_build_object('ok',true,'status','PRONTO_FORMALIZAR');
END $$;

CREATE OR REPLACE FUNCTION public.contratacao_marcar_formalizada_por_venda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  IF NEW.contratacao_id IS NULL THEN RETURN NEW; END IF;
  UPDATE public.contratacoes_online SET status_operacional_erp='FORMALIZADA',
    formalizado_em=COALESCE(formalizado_em,now()), pendencia_codigo=NULL,
    pendencia_descricao=NULL, updated_at=now()
  WHERE id=NEW.contratacao_id AND empresa_id=NEW.empresa_id;
  INSERT INTO public.contratacoes_formalizacao_historico
    (empresa_id,contratacao_id,evento,descricao,dados,usuario_id)
  VALUES (NEW.empresa_id,NEW.contratacao_id,'FORMALIZADA',
    'Venda e cota definitiva criadas pelo motor canônico.',
    jsonb_build_object('venda_id',NEW.id),public.current_usuario_id());
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contratacao_formalizada_por_venda ON public.vendas;
CREATE TRIGGER trg_contratacao_formalizada_por_venda
AFTER INSERT ON public.vendas FOR EACH ROW
EXECUTE FUNCTION public.contratacao_marcar_formalizada_por_venda();

REVOKE ALL ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_preparar_formalizacao_contratacao(uuid,uuid,uuid,uuid,uuid,uuid,numeric) TO authenticated, service_role;

COMMIT;
