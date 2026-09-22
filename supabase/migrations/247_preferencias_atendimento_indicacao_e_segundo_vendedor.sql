-- 247: Preferências de atendimento da indicação e indicador fixo como segundo vendedor.
-- Forward-only e tenant-aware; preserva todos os registros históricos.
BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS preferencia_atendimento text,
  ADD COLUMN IF NOT EXISTS quando_atendimento text,
  ADD COLUMN IF NOT EXISTS periodo_contato text;

COMMENT ON COLUMN public.leads.preferencia_atendimento IS
  'Formato de atendimento escolhido no formulário público do indicador.';
COMMENT ON COLUMN public.leads.quando_atendimento IS
  'Momento desejado para o atendimento informado no formulário público do indicador.';
COMMENT ON COLUMN public.leads.periodo_contato IS
  'Melhor período para contato informado no formulário público do indicador.';

-- O participante comercial do indicador ocupa o papel canônico de segundo
-- vendedor. Ele não entra no rateio manual da formalização: sua remuneração
-- continua sendo calculada exclusivamente pela regra homologada INDICADOR.
CREATE OR REPLACE FUNCTION public.programa_indicacao_venda_vincular()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_indicacao public.programa_indicacoes%rowtype;
  v_participante uuid;
BEGIN
  IF NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT *
    INTO v_indicacao
  FROM public.programa_indicacoes
  WHERE empresa_id = NEW.empresa_id
    AND lead_id = NEW.lead_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.programa_indicacoes
  SET venda_id = NEW.id,
      status = 'VENDA_REALIZADA',
      updated_at = now()
  WHERE id = v_indicacao.id;

  IF v_indicacao.indicador_id IS NOT NULL THEN
    SELECT participante_id
      INTO v_participante
    FROM public.programa_indicadores
    WHERE id = v_indicacao.indicador_id
      AND empresa_id = NEW.empresa_id
      AND ativo;

    IF v_participante IS NOT NULL THEN
      INSERT INTO public.venda_participantes(
        empresa_id,
        venda_id,
        participante_comercial_id,
        papel,
        tipo_atuacao
      )
      VALUES(
        NEW.empresa_id,
        NEW.id,
        v_participante,
        'PARTICIPANTE_SECUNDARIO',
        'INDICADOR'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS programa_indicacao_venda_vincular ON public.vendas;
CREATE TRIGGER programa_indicacao_venda_vincular
  AFTER INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.programa_indicacao_venda_vincular();

COMMIT;

NOTIFY pgrst, 'reload schema';
