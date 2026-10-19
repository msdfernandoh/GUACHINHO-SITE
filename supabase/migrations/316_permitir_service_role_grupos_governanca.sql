-- Migration 310: Permite criação de grupos pelo service_role (robôs de importação)
CREATE OR REPLACE FUNCTION public.grupo_governanca_v2_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.origem_governanca='GLOBAL' AND NOT (auth.role() = 'service_role' OR public.is_platform_superadmin()) THEN 
    RAISE EXCEPTION 'Somente Platform cria grupo global'; 
  END IF;
  IF NEW.origem_governanca='LOCAL' AND NOT (auth.role() = 'service_role' OR public.can_write_tenant_internal(NEW.empresa_origem_id)) THEN 
    RAISE EXCEPTION 'Grupo local pertence a outro tenant'; 
  END IF;
 END IF;
 RETURN NEW;
END
$function$;
