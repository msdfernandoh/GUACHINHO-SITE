-- Snapshots completos por assembleia. O legado permanece integralmente preservado.
CREATE TABLE public.grupo_assembleias_resultados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  assembleia_numero integer NOT NULL CHECK (assembleia_numero > 0),
  assembleia_data date NOT NULL,
  execucao_id uuid NOT NULL REFERENCES public.robo_execucoes(id) ON DELETE RESTRICT,
  versao integer NOT NULL DEFAULT 2 CHECK (versao = 2),
  cotas jsonb NOT NULL CHECK (jsonb_typeof(cotas) = 'array'),
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, assembleia_numero, execucao_id)
);
CREATE INDEX ON public.grupo_assembleias_resultados(grupo_id, assembleia_numero, criado_em DESC);
CREATE INDEX ON public.grupo_assembleias_resultados(assembleia_data);
ALTER TABLE public.grupo_assembleias_resultados ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.grupo_assembleias_resultados FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.grupo_assembleias_resultados TO authenticated;
GRANT SELECT, INSERT ON public.grupo_assembleias_resultados TO service_role;
CREATE POLICY resultados_catalogo_leitura ON public.grupo_assembleias_resultados
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.grupos_consorcio g
    JOIN public.empresa_administradoras ea ON ea.administradora_id = g.administradora_id
    WHERE g.id = grupo_id AND ea.status = 'ATIVA'
      AND public.can_read_tenant_internal(ea.empresa_id)
      AND (g.origem_governanca <> 'LOCAL' OR g.empresa_origem_id = ea.empresa_id))
);
CREATE POLICY resultados_robo_insert ON public.grupo_assembleias_resultados
FOR INSERT TO service_role WITH CHECK (true);
COMMENT ON TABLE public.grupo_assembleias_resultados IS
'Snapshots imutáveis do resultado completo das três abas Newcon; versão 2. Legado não é fonte de indicadores.';

CREATE FUNCTION public.bloquear_mutacao_resultado_assembleia_329()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN RAISE EXCEPTION 'Resultados de assembleias são imutáveis; grave nova coleta.'; END;
$$;
REVOKE ALL ON FUNCTION public.bloquear_mutacao_resultado_assembleia_329() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER resultado_assembleia_imutavel BEFORE UPDATE OR DELETE
ON public.grupo_assembleias_resultados FOR EACH ROW
EXECUTE FUNCTION public.bloquear_mutacao_resultado_assembleia_329();
