-- Os menus operacionais aprovados pela Platform constituem a liberação explícita
-- do site público. O runtime continua bloqueado quando nenhum deles está ativo.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_empresa_site_operacional_por_menus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_operacional boolean;
BEGIN
  v_operacional := NEW.status = 'PUBLICADO'
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(coalesce(to_jsonb(NEW.menus_habilitados), '[]'::jsonb)) AS menu(id)
      WHERE menu.id = ANY (ARRAY[
        'simulador', 'imoveis', 'veiculos', 'pesados', 'grupos',
        'area_parceiro'
      ])
    );

  UPDATE public.empresas
  SET configuracoes = jsonb_set(
        coalesce(configuracoes, '{}'::jsonb),
        '{site_publico}',
        coalesce(configuracoes->'site_publico', '{}'::jsonb)
          || jsonb_build_object('operacional_habilitado', v_operacional),
        true
      ),
      updated_at = now()
  WHERE id = NEW.empresa_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_site_modelos_sync_operacional ON public.empresa_site_modelos;
CREATE TRIGGER empresa_site_modelos_sync_operacional
AFTER INSERT OR UPDATE OF status, menus_habilitados
ON public.empresa_site_modelos
FOR EACH ROW
EXECUTE FUNCTION public.sync_empresa_site_operacional_por_menus();

-- Reconcilia vínculos existentes com a mesma regra explícita.
UPDATE public.empresas e
SET configuracoes = jsonb_set(
      coalesce(e.configuracoes, '{}'::jsonb),
      '{site_publico}',
      coalesce(e.configuracoes->'site_publico', '{}'::jsonb)
        || jsonb_build_object(
          'operacional_habilitado',
          esm.status = 'PUBLICADO'
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(coalesce(to_jsonb(esm.menus_habilitados), '[]'::jsonb)) AS menu(id)
              WHERE menu.id = ANY (ARRAY[
                'simulador', 'imoveis', 'veiculos', 'pesados', 'grupos',
                'area_parceiro'
              ])
            )
        ),
      true
    ),
    updated_at = now()
FROM public.empresa_site_modelos esm
WHERE esm.empresa_id = e.id;

COMMIT;
