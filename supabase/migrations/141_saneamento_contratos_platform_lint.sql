-- 141 — Saneamento dos contratos Platform detectados pelo plpgsql_check.
-- Compatibilidade aditiva e sem remoção de dados.
BEGIN;

ALTER TABLE public.plataforma_auditoria ADD COLUMN IF NOT EXISTS executado_por uuid;
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;
ALTER TABLE public.saas_planos ADD COLUMN IF NOT EXISTS modulos_habilitados text[] NOT NULL DEFAULT '{}'::text[];

CREATE TABLE IF NOT EXISTS public.empresa_quotas (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE RESTRICT,
  limite_usuarios integer NOT NULL DEFAULT 10 CHECK(limite_usuarios>0),
  max_parceiros integer NOT NULL DEFAULT 0 CHECK(max_parceiros>=0),
  max_sites_parceiros integer NOT NULL DEFAULT 0 CHECK(max_sites_parceiros>=0),
  max_sites_dominio_proprio integer NOT NULL DEFAULT 0 CHECK(max_sites_dominio_proprio>=0),
  permite_sites_parceiros boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.empresa_quotas(empresa_id,limite_usuarios,max_parceiros,max_sites_parceiros,max_sites_dominio_proprio,permite_sites_parceiros)
SELECT e.id,coalesce(a.usuarios_contratados,p.limite_usuarios,10),coalesce(p.max_parceiros,0),
  coalesce(a.sites_parceiros_contratados,p.max_sites_parceiros,0),
  coalesce(a.sites_dominio_proprio_contratados,p.max_sites_dominio_proprio,0),coalesce(p.permite_sites_parceiros,false)
FROM public.empresas e
LEFT JOIN LATERAL (SELECT * FROM public.saas_assinaturas x WHERE x.empresa_id=e.id AND x.status='ATIVA' ORDER BY x.created_at DESC LIMIT 1) a ON true
LEFT JOIN public.saas_planos p ON p.id=a.plano_id
ON CONFLICT(empresa_id) DO NOTHING;

UPDATE public.saas_planos p SET modulos_habilitados=coalesce((
  SELECT array_agg(m.codigo ORDER BY m.codigo) FROM public.saas_plano_modulos pm
  JOIN public.erp_modulos_catalogo m ON m.id=pm.modulo_id WHERE pm.plano_id=p.id AND pm.habilitado
),'{}'::text[]);

ALTER TABLE public.empresa_quotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS empresa_quotas_platform_all ON public.empresa_quotas;
CREATE POLICY empresa_quotas_platform_all ON public.empresa_quotas FOR ALL TO authenticated
  USING(public.is_platform_superadmin()) WITH CHECK(public.is_platform_superadmin());
DROP POLICY IF EXISTS empresa_quotas_tenant_read ON public.empresa_quotas;
CREATE POLICY empresa_quotas_tenant_read ON public.empresa_quotas FOR SELECT TO authenticated
  USING(public.can_read_tenant_internal(empresa_id));
REVOKE ALL ON public.empresa_quotas FROM PUBLIC,anon;
GRANT SELECT,INSERT,UPDATE ON public.empresa_quotas TO authenticated;

-- Corrige duas definições históricas preservando assinaturas e corpos. A troca
-- é limitada a casts comprovadamente inválidos apontados pelo lint do Postgres.
DO $$ DECLARE v_oid oid; v_def text;
BEGIN
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='convert_ad_offer_order_to_campaign' LIMIT 1;
  IF v_oid IS NOT NULL THEN
    v_def:=pg_get_functiondef(v_oid);
    v_def:=replace(replace(v_def,'v_start_date::text','v_start_date'),'v_end_date::text','v_end_date');
    EXECUTE v_def;
  END IF;
  SELECT p.oid INTO v_oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='rpc_platform_onboarding_master_franquia' LIMIT 1;
  IF v_oid IS NOT NULL THEN
    v_def:=pg_get_functiondef(v_oid);
    v_def:=replace(v_def,'v_empresa_id::text','v_empresa_id');
    EXECUTE v_def;
  END IF;
END $$;

ALTER FUNCTION public.data_parcela_legado(date,integer) STABLE;
COMMIT;
NOTIFY pgrst,'reload schema';
