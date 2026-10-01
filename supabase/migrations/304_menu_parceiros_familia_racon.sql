-- Padroniza o catálogo compartilhado da família Racon. Cadastro público e app
-- autenticado são recursos distintos e devem coexistir em todos os tenants.
begin;

do $$
declare
  v_modelo_id uuid;
  v_catalogo jsonb;
begin
  select id, coalesce(catalogo_menus, '[]'::jsonb)
  into strict v_modelo_id, v_catalogo
  from public.site_modelos
  where codigo = 'racon_inspired';

  select coalesce(jsonb_agg(item order by ord), '[]'::jsonb)
  into v_catalogo
  from jsonb_array_elements(v_catalogo) with ordinality as itens(item, ord)
  where item->>'id' not in ('area_parceiro', 'parceiros');

  v_catalogo := v_catalogo || jsonb_build_array(
    jsonb_build_object(
      'id', 'area_parceiro',
      'label', 'Área do Parceiro',
      'rota', '/app-indicador/login',
      'ativo_padrao', true
    ),
    jsonb_build_object(
      'id', 'parceiros',
      'label', 'Seja parceiro',
      'rota', '/parceiros',
      'ativo_padrao', true
    )
  );

  update public.site_modelos
  set catalogo_menus = v_catalogo,
      versao = versao + 1,
      updated_at = now()
  where id = v_modelo_id
    and catalogo_menus is distinct from v_catalogo;

  update public.empresa_site_modelos
  set menus_habilitados = array(
    select distinct menu_id
    from unnest(
      coalesce(menus_habilitados, '{}'::text[])
      || array['area_parceiro', 'parceiros']::text[]
    ) as itens(menu_id)
  ),
      updated_at = now()
  where modelo_id = v_modelo_id
    and status = 'PUBLICADO'
    and not (
      coalesce(menus_habilitados, '{}'::text[]) @> array['area_parceiro', 'parceiros']::text[]
    );
end $$;

commit;
