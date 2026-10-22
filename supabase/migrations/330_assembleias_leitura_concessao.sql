-- A concessão é protegida para leitura direta; o helper revalida o usuário
-- sem depender da RLS interna das tabelas de governança.
CREATE FUNCTION public.pode_ler_resultado_grupo_330(p_grupo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.grupos_consorcio g
    JOIN public.empresa_administradoras ea ON ea.administradora_id = g.administradora_id
    WHERE g.id = p_grupo_id AND ea.status = 'ATIVA'
      AND public.can_read_tenant_internal(ea.empresa_id)
      AND (g.origem_governanca IS DISTINCT FROM 'LOCAL' OR g.empresa_origem_id = ea.empresa_id)
  )
$$;
REVOKE ALL ON FUNCTION public.pode_ler_resultado_grupo_330(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pode_ler_resultado_grupo_330(uuid) TO authenticated;
DROP POLICY resultados_catalogo_leitura ON public.grupo_assembleias_resultados;
CREATE POLICY resultados_catalogo_leitura ON public.grupo_assembleias_resultados
FOR SELECT TO authenticated USING (public.pode_ler_resultado_grupo_330(grupo_id));
