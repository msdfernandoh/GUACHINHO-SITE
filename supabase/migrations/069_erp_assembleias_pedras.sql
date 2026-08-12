-- 069 — Assembleias/Pedras do ERP (independente dos sorteios promocionais do Portal).
BEGIN;

CREATE TABLE public.erp_assembleias_grupo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  grupo_id uuid NOT NULL REFERENCES public.grupos_consorcio(id) ON DELETE RESTRICT,
  data_assembleia date NOT NULL,
  numero_assembleia integer CHECK (numero_assembleia IS NULL OR numero_assembleia > 0),
  pedra_sorteada integer NOT NULL CHECK (pedra_sorteada >= 0),
  observacao text,
  criado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX erp_assembleias_empresa_data_idx
  ON public.erp_assembleias_grupo (empresa_id, data_assembleia DESC, created_at DESC);
CREATE INDEX erp_assembleias_empresa_grupo_idx
  ON public.erp_assembleias_grupo (empresa_id, grupo_id, data_assembleia DESC);
CREATE UNIQUE INDEX erp_assembleias_id_empresa_uidx
  ON public.erp_assembleias_grupo (id, empresa_id);

CREATE TABLE public.erp_assembleia_atencoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  assembleia_id uuid NOT NULL,
  cota_definitiva_id uuid NOT NULL REFERENCES public.cotas_definitivas(id) ON DELETE RESTRICT,
  observacao text,
  marcado_por_usuario_id uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT erp_assembleia_atencoes_assembleia_empresa_fkey
    FOREIGN KEY (assembleia_id, empresa_id)
    REFERENCES public.erp_assembleias_grupo(id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT erp_assembleia_atencoes_unica UNIQUE (assembleia_id, cota_definitiva_id)
);

CREATE INDEX erp_assembleia_atencoes_empresa_idx
  ON public.erp_assembleia_atencoes (empresa_id, assembleia_id);

CREATE OR REPLACE FUNCTION public.validate_erp_assembleia_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
DECLARE
  v_grupo_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'erp_assembleias_grupo' THEN
    IF NOT public.grupo_concedido_para_empresa(NEW.empresa_id, NEW.grupo_id) THEN
      RAISE EXCEPTION 'grupo não concedido ao tenant da assembleia';
    END IF;
  ELSE
    SELECT a.grupo_id INTO v_grupo_id
    FROM public.erp_assembleias_grupo a
    WHERE a.id = NEW.assembleia_id AND a.empresa_id = NEW.empresa_id;
    IF v_grupo_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.cotas_definitivas c
      WHERE c.id = NEW.cota_definitiva_id
        AND c.empresa_id = NEW.empresa_id
        AND c.grupo_id = v_grupo_id
    ) THEN
      RAISE EXCEPTION 'cota não pertence ao tenant/grupo da assembleia';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER erp_assembleias_tenant_integrity
BEFORE INSERT OR UPDATE ON public.erp_assembleias_grupo
FOR EACH ROW EXECUTE FUNCTION public.validate_erp_assembleia_tenant_integrity();

CREATE TRIGGER erp_assembleia_atencoes_tenant_integrity
BEFORE INSERT OR UPDATE ON public.erp_assembleia_atencoes
FOR EACH ROW EXECUTE FUNCTION public.validate_erp_assembleia_tenant_integrity();

CREATE OR REPLACE FUNCTION public.prevent_erp_assembleia_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'assembleias do ERP são append-only; registre uma nova assembleia';
END
$$;

CREATE TRIGGER erp_assembleias_append_only
BEFORE UPDATE OR DELETE ON public.erp_assembleias_grupo
FOR EACH ROW EXECUTE FUNCTION public.prevent_erp_assembleia_mutation();

ALTER TABLE public.erp_assembleias_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.erp_assembleia_atencoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.erp_assembleias_grupo, public.erp_assembleia_atencoes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.erp_assembleias_grupo TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.erp_assembleia_atencoes TO authenticated;
GRANT ALL ON public.erp_assembleias_grupo, public.erp_assembleia_atencoes TO service_role;

CREATE POLICY erp_assembleias_select ON public.erp_assembleias_grupo
FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY erp_assembleias_insert ON public.erp_assembleias_grupo
FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY erp_assembleia_atencoes_select ON public.erp_assembleia_atencoes
FOR SELECT TO authenticated USING (public.can_read_tenant_internal(empresa_id));
CREATE POLICY erp_assembleia_atencoes_insert ON public.erp_assembleia_atencoes
FOR INSERT TO authenticated WITH CHECK (public.can_write_tenant_internal(empresa_id));
CREATE POLICY erp_assembleia_atencoes_delete ON public.erp_assembleia_atencoes
FOR DELETE TO authenticated USING (public.can_write_tenant_internal(empresa_id));

COMMIT;
