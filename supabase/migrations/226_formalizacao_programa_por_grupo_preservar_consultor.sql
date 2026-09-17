-- Corrige a resolução da regra quando o mesmo perfil possui programas de
-- Imóvel e Veículo. O programa passa a ser determinado pelo grupo/modalidade.
BEGIN;

-- Vínculo canônico entre o programa operacional e o tipo de bem. Perfis de
-- comissão continuam reutilizáveis em vários programas; esta tabela determina
-- qual programa deve reger uma venda de cada tipo dentro do tenant.
CREATE TABLE IF NOT EXISTS public.comissao_programa_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  programa_id uuid NOT NULL REFERENCES public.comissao_programas(id) ON DELETE CASCADE,
  tipo_administradora_id uuid NOT NULL REFERENCES public.administradora_tipos(id) ON DELETE RESTRICT,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (programa_id, tipo_administradora_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_comissao_programa_tipo_operacional
  ON public.comissao_programa_tipos (empresa_id, tipo_administradora_id)
  WHERE ativo;

ALTER TABLE public.comissao_programa_tipos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_programa_tipos TO authenticated, service_role;
DROP POLICY IF EXISTS comissao_programa_tipos_read ON public.comissao_programa_tipos;
CREATE POLICY comissao_programa_tipos_read ON public.comissao_programa_tipos
  FOR SELECT TO authenticated
  USING (public.can_read_tenant_internal(empresa_id));
DROP POLICY IF EXISTS comissao_programa_tipos_write ON public.comissao_programa_tipos;
CREATE POLICY comissao_programa_tipos_write ON public.comissao_programa_tipos
  FOR ALL TO authenticated
  USING (public.can_write_tenant_internal(empresa_id))
  WITH CHECK (public.can_write_tenant_internal(empresa_id));

CREATE OR REPLACE FUNCTION public.validar_comissao_programa_tipo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_programa_empresa uuid;
  v_programa_administradora uuid;
  v_tipo_administradora uuid;
BEGIN
  SELECT empresa_id, administradora_id
    INTO v_programa_empresa, v_programa_administradora
  FROM public.comissao_programas
  WHERE id = NEW.programa_id;

  SELECT administradora_id INTO v_tipo_administradora
  FROM public.administradora_tipos
  WHERE id = NEW.tipo_administradora_id;

  IF v_programa_empresa IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Programa de comissão não pertence à empresa informada';
  END IF;
  IF v_programa_administradora IS NULL OR v_programa_administradora IS DISTINCT FROM v_tipo_administradora THEN
    RAISE EXCEPTION 'Programa e tipo de bem devem pertencer à mesma administradora';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_comissao_programa_tipo_trigger ON public.comissao_programa_tipos;
CREATE TRIGGER validar_comissao_programa_tipo_trigger
BEFORE INSERT OR UPDATE ON public.comissao_programa_tipos
FOR EACH ROW EXECUTE FUNCTION public.validar_comissao_programa_tipo();

INSERT INTO public.comissao_programa_tipos (
  empresa_id, programa_id, tipo_administradora_id, ativo
)
VALUES
  (
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
    '0957ed7d-961a-432a-bb9d-de3a2b223984'::uuid,
    '57295700-5e68-498c-8882-2ef4ccc8c08d'::uuid,
    true
  ),
  (
    '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid,
    'd13c25fb-afb6-47ec-a1fe-3eaa8c5646b0'::uuid,
    '877a793f-21b3-4ea8-b3c3-b1e56dc216c9'::uuid,
    true
  )
ON CONFLICT (programa_id, tipo_administradora_id)
DO UPDATE SET ativo = true, updated_at = now();

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
  v_programa_ids uuid[];
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
  -- Um perfil pode ter regras em mais de um programa. O vínculo canônico do
  -- tipo do grupo define o programa; a modalidade é validada logo abaixo.
  SELECT array_agg(DISTINCT rp.programa_id) INTO v_programa_ids
  FROM public.participante_comissao_perfis pc
  JOIN public.comissao_regras_participantes rp
    ON rp.empresa_id = pc.empresa_id
   AND rp.perfil_id = pc.perfil_id
   AND rp.ativa
   AND rp.configuracao_homologada
   AND rp.status = 'HOMOLOGADA'
   AND rp.vigencia_inicio <= CURRENT_DATE
   AND (rp.vigencia_fim IS NULL OR rp.vigencia_fim >= CURRENT_DATE)
  JOIN public.comissao_programas p
    ON p.id = rp.programa_id
   AND p.empresa_id = p_empresa_id
   AND p.administradora_id = v_grupo.administradora_id
   AND p.ativo
   AND p.status = 'ATIVO'
  JOIN public.comissao_programa_tipos pt
    ON pt.empresa_id = p_empresa_id
   AND pt.programa_id = rp.programa_id
   AND pt.tipo_administradora_id = v_grupo.tipo_administradora_id
   AND pt.ativo
  WHERE pc.empresa_id = p_empresa_id
    AND pc.participante_id = p_participante_principal_id
    AND pc.perfil_id = p_perfil_principal_id
    AND pc.ativo
    AND pc.vigencia_inicio <= CURRENT_DATE
    AND (pc.vigencia_fim IS NULL OR pc.vigencia_fim >= CURRENT_DATE);
  IF COALESCE(cardinality(v_programa_ids), 0) <> 1 THEN
    RAISE EXCEPTION 'Perfil principal exige exatamente um programa de comissão compatível com o grupo e modalidade; encontrados %', COALESCE(cardinality(v_programa_ids), 0);
  END IF;
  v_programa_id := v_programa_ids[1];

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

COMMIT;
NOTIFY pgrst, 'reload schema';
