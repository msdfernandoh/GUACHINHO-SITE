-- 110: Correção definitiva de triggers de homologação de regras de comissão
BEGIN;

-- 1. Atualizar comissao_regra_participante_before_write para suportar programas SaaS e Perfis Comerciais
CREATE OR REPLACE FUNCTION public.comissao_regra_participante_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_total numeric;
BEGIN
  NEW.modalidade := NULLIF(lower(trim(COALESCE(NEW.modalidade,''))), '');
  NEW.plano_condicao := NULLIF(lower(trim(COALESCE(NEW.plano_condicao,''))), '');
  NEW.origem_configuracao := upper(trim(COALESCE(NEW.origem_configuracao, 'ERP')));

  -- Garante cronograma válido se não informado
  IF NEW.etapas_cronograma IS NULL OR jsonb_typeof(NEW.etapas_cronograma) <> 'array' OR jsonb_array_length(NEW.etapas_cronograma) = 0 THEN
    NEW.etapas_cronograma := '[{"ordem": 1, "mes_relativo": 1, "percentual_etapa": 100, "nome": "Parcela Única"}]'::jsonb;
  END IF;

  IF NEW.base_calculo IS NULL THEN
    NEW.base_calculo := CASE WHEN NEW.base_v2 = 'VALOR_FIXO' THEN 'valor_fixo' ELSE 'credito' END;
  END IF;

  v_total := CASE WHEN NEW.base_calculo = 'credito' THEN COALESCE(NEW.percentual_comissao, 50.0) ELSE COALESCE(NEW.valor_fixo_total, 0) END;

  -- Busca administradora do programa com suporte a programas SaaS globais e locais
  IF NEW.programa_id IS NOT NULL THEN
    SELECT p.administradora_id INTO v_admin_id
    FROM public.comissao_programas AS p
    WHERE p.id = NEW.programa_id;
  END IF;

  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.administradoras WHERE status = 'ATIVA' LIMIT 1;
  END IF;

  IF NEW.participante_comercial_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.participantes_comerciais AS pc
    WHERE pc.id = NEW.participante_comercial_id AND pc.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Participante da regra pertence a outro tenant';
  END IF;

  IF NEW.organizacao_parceira_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.organizacoes_parceiras AS op
    WHERE op.id = NEW.organizacao_parceira_id AND op.empresa_id = NEW.empresa_id
  ) THEN
    RAISE EXCEPTION 'Organização da regra pertence a outro tenant';
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Atualizar comissao_regra_before_write da franqueadora
CREATE OR REPLACE FUNCTION public.comissao_regra_before_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
DECLARE
  v_admin_id uuid;
  v_total numeric;
BEGIN
  NEW.modalidade := NULLIF(lower(trim(COALESCE(NEW.modalidade,''))), '');
  NEW.plano_condicao := NULLIF(lower(trim(COALESCE(NEW.plano_condicao,''))), '');
  NEW.origem_configuracao := upper(trim(COALESCE(NEW.origem_configuracao, 'PLATFORM')));

  IF NEW.etapas_cronograma IS NULL OR jsonb_typeof(NEW.etapas_cronograma) <> 'array' OR jsonb_array_length(NEW.etapas_cronograma) = 0 THEN
    NEW.etapas_cronograma := '[{"ordem": 1, "mes_relativo": 1, "percentual_etapa": 100, "nome": "Parcela Única"}]'::jsonb;
  END IF;

  IF NEW.base_calculo IS NULL THEN
    NEW.base_calculo := 'credito';
  END IF;

  v_total := CASE WHEN NEW.base_calculo = 'credito' THEN COALESCE(NEW.percentual_total_comissao, 4.0) ELSE COALESCE(NEW.valor_fixo_total, 0) END;

  IF NEW.programa_id IS NOT NULL THEN
    SELECT p.administradora_id INTO v_admin_id
    FROM public.comissao_programas AS p
    WHERE p.id = NEW.programa_id;
  END IF;

  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.administradoras WHERE status = 'ATIVA' LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
