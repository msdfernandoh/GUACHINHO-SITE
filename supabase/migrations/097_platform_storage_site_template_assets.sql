-- ==============================================================================
-- MIGRATION 097: PLATFORM STORAGE — BUCKET SITE-TEMPLATE-ASSETS
-- Descrição: Cria e configura o bucket público para assets de modelos de site/templates
--            com políticas de leitura pública e escrita restrita à governança da plataforma.
-- Data: 19/08/2026
-- ==============================================================================

-- 1. Criar ou atualizar bucket site-template-assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-template-assets',
  'site-template-assets',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Políticas de Acesso
DROP POLICY IF EXISTS site_template_assets_public_read ON storage.objects;
CREATE POLICY site_template_assets_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'site-template-assets');

DROP POLICY IF EXISTS site_template_assets_staff_write ON storage.objects;
CREATE POLICY site_template_assets_staff_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-template-assets' AND (
      public.is_platform_superadmin() OR public.is_staff()
    )
  );

DROP POLICY IF EXISTS site_template_assets_staff_update ON storage.objects;
CREATE POLICY site_template_assets_staff_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-template-assets' AND (
      public.is_platform_superadmin() OR public.is_staff()
    )
  );

DROP POLICY IF EXISTS site_template_assets_staff_delete ON storage.objects;
CREATE POLICY site_template_assets_staff_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-template-assets' AND (
      public.is_platform_superadmin() OR public.is_staff()
    )
  );
