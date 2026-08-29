-- Corrige os destinos do catálogo Racon para páginas públicas existentes.
-- Preserva a seleção de menus de cada empresa e apenas normaliza as rotas
-- canônicas do modelo e de seus CTAs/links auxiliares.

BEGIN;

UPDATE public.site_modelos AS modelo
SET catalogo_menus = (
      SELECT jsonb_agg(
        CASE item->>'id'
          WHEN 'imoveis' THEN jsonb_set(item, '{rota}', to_jsonb('/consorcio/imovel-parcela-reduzida'::text), true)
          WHEN 'veiculos' THEN jsonb_set(item, '{rota}', to_jsonb('/consorcio/carro-sem-entrada'::text), true)
          WHEN 'pesados' THEN jsonb_set(item, '{rota}', to_jsonb('/consorcio/caminhao-para-autonomo'::text), true)
          ELSE item
        END
        ORDER BY ordinalidade
      )
      FROM jsonb_array_elements(coalesce(modelo.catalogo_menus, '[]'::jsonb))
        WITH ORDINALITY AS menu(item, ordinalidade)
    ),
    identidade_visual = coalesce(modelo.identidade_visual, '{}'::jsonb)
      || jsonb_build_object(
        'imagens_banners',
        coalesce(modelo.identidade_visual->'imagens_banners', '{}'::jsonb)
          || jsonb_build_object(
            'card_veiculos_cta_url', '/consorcio/carro-sem-entrada',
            'card_imoveis_cta_url', '/consorcio/imovel-parcela-reduzida'
          )
      ),
    configuracao_footer = coalesce(modelo.configuracao_footer, '{}'::jsonb)
      || jsonb_build_object(
        'links_uteis',
        jsonb_build_array(
          jsonb_build_object('label', 'Consórcio de Imóveis', 'url', '/consorcio/imovel-parcela-reduzida'),
          jsonb_build_object('label', 'Consórcio de Automóveis', 'url', '/consorcio/carro-sem-entrada'),
          jsonb_build_object('label', 'Pesados e Frotas', 'url', '/consorcio/caminhao-para-autonomo'),
          jsonb_build_object('label', 'Simulador Online', 'url', '/simulador'),
          jsonb_build_object('label', 'Área do Parceiro', 'url', '/area-parceiro')
        )
      ),
    updated_at = now()
WHERE modelo.codigo = 'racon_inspired';

COMMIT;
