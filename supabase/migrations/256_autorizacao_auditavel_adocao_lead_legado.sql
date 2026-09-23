-- =============================================================================
-- Migration 256 — Autorização auditável para adoção de lead legado
-- =============================================================================
-- Substitui a sinalização de sessão da migration 255 por uma autorização
-- persistida e específica ao par lead/empresa. O trigger aceita somente a
-- mudança NULL -> empresa registrada pela RPC SECURITY DEFINER.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.leads_legacy_adocoes_tenant (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id),
  origem text NOT NULL DEFAULT 'rpc_adotar_lead_legado_e_upsert_por_telefone',
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.leads_legacy_adocoes_tenant FROM PUBLIC, anon, authenticated, service_role;

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

  -- Exceção estrita para a adoção de legado autorizada e auditada pela RPC.
  -- Nunca autoriza troca entre empresas ou alteração de um lead já tenantizado.
  IF TG_TABLE_NAME = 'leads'
     AND OLD.empresa_id IS NULL
     AND NEW.empresa_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.leads_legacy_adocoes_tenant a
       WHERE a.lead_id = OLD.id
         AND a.empresa_id = NEW.empresa_id
     ) THEN
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
  v_lead_legado_id uuid;
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

  IF v_empresa_id IS NULL OR v_forcar_novo OR length(v_tel_norm) < 10 THEN
    RETURN public.rpc_upsert_lead_por_telefone(p_payload);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('lead_upsert_' || v_tel_norm));

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
    SELECT l.id
    INTO v_lead_legado_id
    FROM public.leads l
    LEFT JOIN public.crm_funil_etapas fe ON fe.id = l.etapa_id
    WHERE l.empresa_id IS NULL
      AND (l.telefone_normalizado = v_tel_norm
        OR regexp_replace(coalesce(l.whatsapp, ''), '\D', '', 'g') = v_tel_norm)
      AND coalesce(fe.is_won, false) = false
      AND lower(coalesce(l.status, '')) NOT IN ('fechado', 'ganho', 'venda fechada', 'venda_fechada')
    ORDER BY l.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_lead_legado_id IS NOT NULL THEN
      INSERT INTO public.leads_legacy_adocoes_tenant (lead_id, empresa_id)
      VALUES (v_lead_legado_id, v_empresa_id)
      ON CONFLICT (lead_id) DO UPDATE
      SET empresa_id = EXCLUDED.empresa_id,
          created_at = now();

      UPDATE public.leads
      SET empresa_id = v_empresa_id,
          updated_at = now()
      WHERE id = v_lead_legado_id
        AND empresa_id IS NULL;
    END IF;
  END IF;

  RETURN public.rpc_upsert_lead_por_telefone(p_payload);
END;
$$;

COMMENT ON TABLE public.leads_legacy_adocoes_tenant
IS 'Auditoria e autorização estrita de adoção NULL -> empresa para leads anteriores à tenantização.';

COMMIT;
NOTIFY pgrst, 'reload schema';
