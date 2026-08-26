-- 118: Storage e campos de Nota Fiscal / Comprovantes em Contas a Pagar
BEGIN;

-- 1. BUCKET DE STORAGE PARA DOCUMENTOS DE CONTAS A PAGAR (NFs, Recibos e Boletos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'contas-pagar-documentos',
  'contas-pagar-documentos',
  true,
  20971520, -- 20MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/xml', 'application/xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/xml', 'application/xml'];

-- RLS para contas-pagar-documentos
DROP POLICY IF EXISTS "contas_pagar_documentos_public_read" ON storage.objects;
CREATE POLICY "contas_pagar_documentos_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'contas-pagar-documentos');

DROP POLICY IF EXISTS "contas_pagar_documentos_auth_insert" ON storage.objects;
CREATE POLICY "contas_pagar_documentos_auth_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'contas-pagar-documentos');

DROP POLICY IF EXISTS "contas_pagar_documentos_auth_update" ON storage.objects;
CREATE POLICY "contas_pagar_documentos_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'contas-pagar-documentos');

DROP POLICY IF EXISTS "contas_pagar_documentos_auth_delete" ON storage.objects;
CREATE POLICY "contas_pagar_documentos_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'contas-pagar-documentos');

-- 2. Colunas de Nota Fiscal / Comprovante em financeiro_contas_pagar
ALTER TABLE public.financeiro_contas_pagar
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_nome text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_uploaded_at timestamptz;

COMMIT;

NOTIFY pgrst, 'reload schema';
