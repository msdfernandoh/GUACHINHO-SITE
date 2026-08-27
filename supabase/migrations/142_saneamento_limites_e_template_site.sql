-- 142 — Finaliza contratos de limites e modelo de site apontados pelo lint.
BEGIN;

ALTER TABLE public.empresa_branding ADD COLUMN IF NOT EXISTS template_codigo text;
UPDATE public.empresa_branding b SET template_codigo=m.codigo
FROM public.empresa_site_modelos em JOIN public.site_modelos m ON m.id=em.modelo_id
WHERE em.empresa_id=b.empresa_id AND b.template_codigo IS DISTINCT FROM m.codigo;

CREATE OR REPLACE FUNCTION public.sincronizar_template_codigo_branding()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
  UPDATE public.empresa_branding b SET template_codigo=m.codigo,updated_at=now()
  FROM public.site_modelos m WHERE m.id=NEW.modelo_id AND b.empresa_id=NEW.empresa_id;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_sincronizar_template_codigo_branding ON public.empresa_site_modelos;
CREATE TRIGGER trg_sincronizar_template_codigo_branding AFTER INSERT OR UPDATE OF modelo_id
ON public.empresa_site_modelos FOR EACH ROW EXECUTE FUNCTION public.sincronizar_template_codigo_branding();

-- As RPCs históricas usavam limite_sites_parceiros; o contrato canônico atual é
-- max_sites_parceiros. Reescreve somente o identificador, mantendo assinaturas.
DO $$ DECLARE v_nome text; v_oid oid; v_def text;
BEGIN
  FOREACH v_nome IN ARRAY ARRAY['rpc_platform_criar_override','rpc_platform_encerrar_override'] LOOP
    SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=v_nome LIMIT 1;
    IF v_oid IS NOT NULL THEN
      v_def:=replace(pg_get_functiondef(v_oid),'limite_sites_parceiros','max_sites_parceiros');
      EXECUTE v_def;
    END IF;
  END LOOP;
END $$;
COMMIT;
NOTIFY pgrst,'reload schema';
