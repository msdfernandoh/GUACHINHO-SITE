-- =============================================================================
-- Migration 255 — Reuso seguro de lead legado por telefone em propostas públicas
-- =============================================================================
-- O site público sempre resolve empresa_id pelo host. Leads históricos sem
-- empresa_id pertencem ao acervo anterior à tenantização e, sem este adaptador,
-- eram ignorados pela RPC canônica, gerando duplicidade ao emitir proposta.
--
-- A adoção é deliberadamente restrita: NULL -> empresa_id do host confiável,
-- mesmo telefone, lead não ganho e ausência de lead ativo já pertencente àquela
-- empresa. Registros de outra empresa jamais entram na seleção.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_comercial_escopo_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_platform_superadmin() OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  -- A RPC privada abaixo marca esta variável apenas durante a adoção
  -- transacional de um lead legado (empresa_id NULL) pelo tenant do host.
  IF TG_TABLE_NAME = 'leads'
     AND OLD.empresa_id IS NULL
     AND NEW.empresa_id IS NOT NULL
     AND current_setting('app.crm_legacy_lead_adoption_empresa_id', true) = NEW.empresa_id::text THEN
    RETURN NEW;
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    RAISE EXCEPTION 'empresa_id não pode ser alterado fora do CRM staff';
  END IF;

  IF NEW.organizacao_parceira_id IS DISTINCT FROM OLD.organizacao_parceira_id THEN
    RAISE EXCEPTION 'organizacao_parceira_id não pode ser alterado fora do CRM staff';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_tel text;
  v_digits text;
  v_tel_norm text;
  v_empresa_id uuid;
  v_forcar_novo boolean;
BEGIN
  v_raw_tel := coalesce(p_payload->>'whatsapp', p_payload->>'telefone', '');
  v_digits := regexp_replace(v_raw_tel, '\D', '', 'g');
  v_tel_norm := CASE
    WHEN length(v_digits) IN (12, 13) AND v_digits LIKE '55%' THEN substring(v_digits FROM 3)
    ELSE v_digits
  END;
  v_empresa_id := nullif(p_payload->>'empresa_id', '')::uuid;
  v_forcar_novo := coalesce(
    nullif(p_payload->>'permitir_gerar_novo', '')::boolean,
    nullif(p_payload->>'forcar_novo', '')::boolean,
    false
  );

  -- A RPC canônica mantém sua própria validação e cobre fluxos sem tenant,
  -- telefone inválido e solicitações que pedem uma negociação nova.
  IF v_empresa_id IS NULL OR v_forcar_novo OR length(v_tel_norm) < 10 THEN
    RETURN public.rpc_upsert_lead_por_telefone(p_payload);
  END IF;

  -- Mesmo bloqueio da RPC canônica: duas entradas simultâneas não podem adotar
  -- o mesmo legado e criar propostas em leads distintos.
  PERFORM pg_advisory_xact_lock(hashtext('lead_upsert_' || v_tel_norm));

  -- Só adota um registro sem empresa se não existir outro lead ativo no tenant
  -- do host. Assim o lead atual sempre prevalece sobre o legado.
  IF NOT EXISTS (
    SELECT 1
    FROM public.leads l
    LEFT JOIN public.crm_funil_etapas fe ON fe.id = l.etapa_id
    WHERE l.empresa_id = v_empresa_id
      AND (l.telefone_normalizado = v_tel_norm
        OR regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = v_tel_norm)
      AND coalesce(fe.is_won, false) = false
      AND lower(coalesce(l.status, '')) NOT IN ('fechado', 'ganho', 'venda fechada', 'venda_fechada')
  ) THEN
    PERFORM set_config('app.crm_legacy_lead_adoption_empresa_id', v_empresa_id::text, true);

    WITH candidato AS (
      SELECT l.id
      FROM public.leads l
      LEFT JOIN public.crm_funil_etapas fe ON fe.id = l.etapa_id
      WHERE l.empresa_id IS NULL
        AND (l.telefone_normalizado = v_tel_norm
          OR regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = v_tel_norm)
        AND coalesce(fe.is_won, false) = false
        AND lower(coalesce(l.status, '')) NOT IN ('fechado', 'ganho', 'venda fechada', 'venda_fechada')
      ORDER BY l.created_at DESC
      LIMIT 1
      FOR UPDATE
    )
    UPDATE public.leads l
    SET empresa_id = v_empresa_id,
        updated_at = now()
    FROM candidato c
    WHERE l.id = c.id
      AND l.empresa_id IS NULL;
  END IF;

  RETURN public.rpc_upsert_lead_por_telefone(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
  TO service_role;

COMMENT ON FUNCTION public.rpc_adotar_lead_legado_e_upsert_por_telefone(jsonb)
IS 'Adota somente lead legado ativo sem empresa para o tenant resolvido pelo host e delega a consolidação à RPC canônica.';

COMMIT;
NOTIFY pgrst, 'reload schema';
