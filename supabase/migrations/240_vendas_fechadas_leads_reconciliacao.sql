-- Migration 240: Reconciliação Definitiva de Vendas Fechadas e Leads (Fase 258)
-- Garante vínculo bidirecional entre public.vendas e public.leads,
-- backfill para Daiana Caruline Tasso (R$ 2.800.000,00) e Gabriel Pereira da Costa (R$ 41.784,72),
-- e trigger de sincronização automática entre confirmação de vendas e etapa "Venda fechada".

DO $$
DECLARE
  v_empresa_id UUID := '7170f38e-15dd-4b19-8588-51e9a9cf0d4c';
  v_etapa_venda_fechada_id UUID;
  v_lead_daiana_id UUID;
  v_lead_gabriel_id UUID := '58adc788-941d-4530-86fa-e4e32b9bb2f2';
  v_venda_daiana_id UUID := 'b20e0f00-6892-4056-8e90-141592c2368c';
  v_venda_gabriel_id UUID := '17044a27-f492-4421-ac4b-4ef1c361bd86';
  v_fernando_usuario_id UUID := '31617f5c-42c7-4f08-ba5a-38323eacbffd';
BEGIN
  -- 1. Obter id da etapa 'venda_fechada' para a Gauchinho Consórcios
  SELECT id INTO v_etapa_venda_fechada_id
  FROM public.crm_funil_etapas
  WHERE empresa_id = v_empresa_id AND slug = 'venda_fechada'
  LIMIT 1;

  IF v_etapa_venda_fechada_id IS NULL THEN
    v_etapa_venda_fechada_id := 'f6766306-3bbe-418b-925e-2699b0b81b7f';
  END IF;

  -- 2. Backfill Daiana Caruline Tasso (R$ 2.800.000,00 fechado em 18/09/2026)
  SELECT id INTO v_lead_daiana_id
  FROM public.leads
  WHERE empresa_id = v_empresa_id
    AND (telefone_normalizado = '66997120374' OR lower(nome) LIKE '%daiana caruline%')
  LIMIT 1;

  IF v_lead_daiana_id IS NULL THEN
    INSERT INTO public.leads (
      id,
      empresa_id,
      nome,
      whatsapp,
      telefone_normalizado,
      email,
      etapa_id,
      status,
      fechado,
      fechado_at,
      data_fechamento,
      valor_fechado,
      valor_estimado,
      valor_simulado,
      valor_parcela_fechamento,
      tipo_interesse,
      srd_responsavel_id,
      srd_responsavel_nome,
      participante_comercial_id,
      origem,
      observacoes,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_empresa_id,
      'Daiana Caruline Tasso',
      '(66) 99712-0374',
      '66997120374',
      'Daicaroltasso@outlook.com',
      v_etapa_venda_fechada_id,
      'Venda fechada',
      true,
      '2026-09-18 17:03:09.843662+00',
      '2026-09-18',
      2800000.00,
      2800000.00,
      2800000.00,
      16445.10,
      'Imóvel',
      v_fernando_usuario_id,
      'FERNANDO',
      'b25a8ab6-e2a7-4e61-97db-9e6c930c1bb8',
      'contratacao_online',
      'Venda confirmada via Contratação Online #9aa25b11 (14 cotas Grupo 1553)',
      '2026-09-18 17:03:09.843662+00',
      now()
    )
    RETURNING id INTO v_lead_daiana_id;
  ELSE
    UPDATE public.leads
    SET etapa_id = v_etapa_venda_fechada_id,
        status = 'Venda fechada',
        fechado = true,
        fechado_at = '2026-09-18 17:03:09.843662+00',
        data_fechamento = '2026-09-18',
        valor_fechado = 2800000.00,
        valor_parcela_fechamento = 16445.10,
        srd_responsavel_id = v_fernando_usuario_id,
        srd_responsavel_nome = 'FERNANDO',
        participante_comercial_id = 'b25a8ab6-e2a7-4e61-97db-9e6c930c1bb8',
        updated_at = now()
    WHERE id = v_lead_daiana_id;
  END IF;

  -- Vincular lead à venda da Daiana
  UPDATE public.vendas
  SET lead_id = v_lead_daiana_id
  WHERE id = v_venda_daiana_id;

  -- 3. Backfill Gabriel Pereira da Costa (R$ 41.784,72 fechado em 17/09/2026)
  UPDATE public.leads
  SET etapa_id = v_etapa_venda_fechada_id,
      status = 'Venda fechada',
      fechado = true,
      fechado_at = '2026-09-17 20:50:50.444249+00',
      data_fechamento = '2026-09-17',
      valor_fechado = 41784.72,
      valor_parcela_fechamento = 423.31,
      participante_comercial_id = 'c798fdc1-db0e-4582-885b-f5bc752d4624',
      srd_responsavel_nome = 'RONALDO CESAR GAIDA',
      updated_at = now()
  WHERE id = v_lead_gabriel_id;

  -- Vincular lead à venda do Gabriel
  UPDATE public.vendas
  SET lead_id = v_lead_gabriel_id
  WHERE id = v_venda_gabriel_id;

  -- 4. Ajustar valores e datas das demais vendas confirmadas de Setembro/2026 nos respectivos leads
  -- SNP Vertical Broker / Vanessa Lando
  UPDATE public.leads
  SET valor_fechado = 393381.72,
      valor_parcela_fechamento = 2762.07,
      data_fechamento = '2026-09-01',
      fechado = true,
      etapa_id = v_etapa_venda_fechada_id,
      status = 'Venda fechada'
  WHERE id = '0ae86cb5-0508-4e84-8466-ba05c71994d9';

  -- Janser Carmos Amaral
  UPDATE public.leads
  SET valor_fechado = 254400.00,
      valor_parcela_fechamento = 969.26,
      data_fechamento = '2026-09-01',
      fechado = true,
      etapa_id = v_etapa_venda_fechada_id,
      status = 'Venda fechada'
  WHERE id = '5a20724b-5449-4080-a571-42ffae56ad13';

  -- Monica Luzia Sinhori
  UPDATE public.leads
  SET valor_fechado = 848000.00,
      valor_parcela_fechamento = 3230.88,
      data_fechamento = '2026-09-18',
      fechado = true,
      etapa_id = v_etapa_venda_fechada_id,
      status = 'Venda fechada'
  WHERE id = '93f05274-83aa-40ba-81f0-129bb7517579';

  -- Franciomar Enrique Erkmann Guizzo
  UPDATE public.leads
  SET valor_fechado = 127200.00,
      valor_parcela_fechamento = 565.40,
      data_fechamento = '2026-09-01',
      fechado = true,
      etapa_id = v_etapa_venda_fechada_id,
      status = 'Venda fechada'
  WHERE id = 'a9633fa7-2c94-462a-bd2b-155c049fe9b7';

END $$;


-- 5. Trigger para manter vendas confirmadas e leads sempre sincronizados
CREATE OR REPLACE FUNCTION public.fn_vendas_sync_lead_fechamento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_etapa_venda_fechada_id UUID;
  v_lead_encontrado_id UUID;
  v_tel_norm TEXT;
BEGIN
  -- Apenas atua quando a venda estiver confirmada
  IF NEW.status = 'confirmada' THEN
    -- Obter etapa de venda fechada
    SELECT id INTO v_etapa_venda_fechada_id
    FROM public.crm_funil_etapas
    WHERE empresa_id = NEW.empresa_id AND slug = 'venda_fechada'
    LIMIT 1;

    -- Se já tem lead_id associado, atualiza o lead diretamente
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE public.leads
      SET fechado = true,
          fechado_at = COALESCE(NEW.data_venda, now()),
          data_fechamento = (COALESCE(NEW.data_venda, now()))::date,
          valor_fechado = NEW.valor_credito,
          valor_parcela_fechamento = NEW.parcela,
          participante_comercial_id = COALESCE(NEW.participante_comercial_id, participante_comercial_id),
          status = 'Venda fechada',
          etapa_id = COALESCE(v_etapa_venda_fechada_id, etapa_id),
          updated_at = now()
      WHERE id = NEW.lead_id;
    ELSE
      -- Tenta localizar lead pelo telefone normalizado
      v_tel_norm := regexp_replace(COALESCE(NEW.cliente_telefone, ''), '\D', '', 'g');
      IF length(v_tel_norm) >= 8 THEN
        SELECT id INTO v_lead_encontrado_id
        FROM public.leads
        WHERE empresa_id = NEW.empresa_id
          AND (telefone_normalizado = v_tel_norm OR whatsapp LIKE '%' || v_tel_norm || '%')
        LIMIT 1;

        IF v_lead_encontrado_id IS NOT NULL THEN
          NEW.lead_id := v_lead_encontrado_id;
          UPDATE public.leads
          SET fechado = true,
              fechado_at = COALESCE(NEW.data_venda, now()),
              data_fechamento = (COALESCE(NEW.data_venda, now()))::date,
              valor_fechado = NEW.valor_credito,
              valor_parcela_fechamento = NEW.parcela,
              participante_comercial_id = COALESCE(NEW.participante_comercial_id, participante_comercial_id),
              status = 'Venda fechada',
              etapa_id = COALESCE(v_etapa_venda_fechada_id, etapa_id),
              updated_at = now()
          WHERE id = v_lead_encontrado_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vendas_sync_lead_fechamento ON public.vendas;
CREATE TRIGGER trg_vendas_sync_lead_fechamento
BEFORE INSERT OR UPDATE OF status, valor_credito, parcela, lead_id ON public.vendas
FOR EACH ROW
EXECUTE FUNCTION public.fn_vendas_sync_lead_fechamento();
