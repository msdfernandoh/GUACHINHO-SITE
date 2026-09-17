-- Leads públicos históricos podiam existir sem empresa_id. A venda mantém a
-- integridade estrita, mas a conversão pode adotar o lead quando o vínculo com
-- uma única empresa já está comprovado pela contratação.
BEGIN;

-- A proteção histórica de escopo continua bloqueando mudanças entre empresas.
-- A única exceção é a adoção inicial (NULL -> empresa) comprovada por uma
-- contratação e sem qualquer vínculo do lead com outra empresa.
CREATE OR REPLACE FUNCTION public.prevent_comercial_escopo_move()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF public.is_platform_superadmin() OR public.is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'leads'
     AND OLD.empresa_id IS NULL
     AND NEW.empresa_id IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM public.contratacoes_online c
       WHERE c.lead_id = OLD.id
         AND c.empresa_id = NEW.empresa_id
     )
     AND NOT EXISTS (
       SELECT 1
       FROM public.contratacoes_online conflito
       WHERE conflito.lead_id = OLD.id
         AND conflito.empresa_id <> NEW.empresa_id
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

-- Backfill apenas dos leads sem tenant ligados exclusivamente a contratações
-- de uma única empresa. Registros sem vínculo ou com conflito permanecem
-- intocados para auditoria manual.
WITH vinculos AS (
  SELECT
    c.lead_id,
    min(c.empresa_id::text)::uuid AS empresa_id,
    count(DISTINCT c.empresa_id) AS empresas
  FROM public.contratacoes_online c
  WHERE c.lead_id IS NOT NULL
  GROUP BY c.lead_id
)
UPDATE public.leads l
SET empresa_id = v.empresa_id,
    updated_at = now()
FROM vinculos v
WHERE l.id = v.lead_id
  AND l.empresa_id IS NULL
  AND v.empresas = 1;

DO $migration$
DECLARE
  v_oid regprocedure := to_regprocedure('public.rpc_converter_contratacao_venda(uuid,uuid,text)');
  v_def text;
  v_anchor text;
  v_replacement text;
BEGIN
  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'Fase 229 requer rpc_converter_contratacao_venda';
  END IF;

  SELECT pg_get_functiondef(v_oid) INTO v_def;
  v_def := replace(v_def, chr(13), '');
  v_anchor := E'  IF v_contratacao.cliente_id IS NULL THEN\n';
  v_replacement := $new$
  IF v_contratacao.lead_id IS NOT NULL THEN
    -- Adota somente um lead legado ainda sem tenant e exclusivamente ligado a
    -- contratações desta empresa. Um vínculo em outra empresa impede a adoção.
    UPDATE public.leads l
    SET empresa_id = p_empresa_id,
        updated_at = now()
    WHERE l.id = v_contratacao.lead_id
      AND l.empresa_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.contratacoes_online c
        WHERE c.id = p_contratacao_id
          AND c.lead_id = l.id
          AND c.empresa_id = p_empresa_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.contratacoes_online conflito
        WHERE conflito.lead_id = l.id
          AND conflito.empresa_id <> p_empresa_id
      );

    IF NOT EXISTS (
      SELECT 1
      FROM public.leads l
      WHERE l.id = v_contratacao.lead_id
        AND l.empresa_id = p_empresa_id
    ) THEN
      RAISE EXCEPTION 'Lead da contratação não pertence à empresa e não pode ser reconciliado automaticamente';
    END IF;
  END IF;

  IF v_contratacao.cliente_id IS NULL THEN
$new$;

  IF strpos(v_def, v_anchor) = 0 THEN
    RAISE EXCEPTION 'Ponto de adoção do lead não encontrado na RPC de conversão';
  END IF;

  v_def := replace(v_def, v_anchor, v_replacement);
  EXECUTE v_def;
END
$migration$;

COMMENT ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
IS 'Formaliza venda pelo programa canônico e reconcilia lead legado sem tenant somente quando seu vínculo exclusivo com a empresa é comprovado pela contratação.';

REVOKE ALL ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_converter_contratacao_venda(uuid,uuid,text)
  TO authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
