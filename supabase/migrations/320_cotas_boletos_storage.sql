-- 320: Armazenamento e Tabela de Boletos Mensais de Cotas (Robô Franquia & WhatsApp)
-- Bucket de Storage para Boletos em PDF e tabela especializada cotas_boletos

-- 1. Criação/Atualização do bucket de storage público/controlado 'boletos-cotas'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'boletos-cotas',
  'boletos-cotas',
  true,
  10485760,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf']::text[];

-- Políticas de Storage para o bucket boletos-cotas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'boletos_cotas_public_read'
  ) THEN
    CREATE POLICY "boletos_cotas_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'boletos-cotas');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'boletos_cotas_tenant_insert'
  ) THEN
    CREATE POLICY "boletos_cotas_tenant_insert"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'boletos-cotas');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'boletos_cotas_tenant_update'
  ) THEN
    CREATE POLICY "boletos_cotas_tenant_update"
      ON storage.objects FOR UPDATE
      USING (bucket_id = 'boletos-cotas');
  END IF;
END $$;

-- 2. Enriquecimento da tabela existente vendas_boletos_envios
ALTER TABLE public.vendas_boletos_envios
  ADD COLUMN IF NOT EXISTS arquivo_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS arquivo_url TEXT,
  ADD COLUMN IF NOT EXISTS qr_code_pix TEXT,
  ADD COLUMN IF NOT EXISTS linha_digitavel TEXT,
  ADD COLUMN IF NOT EXISTS valor NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vencimento DATE,
  ADD COLUMN IF NOT EXISTS numero_grupo TEXT,
  ADD COLUMN IF NOT EXISTS numero_cota TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'ROBO_NEWCON';

-- 3. Nova tabela canônica pública cotas_boletos
CREATE TABLE IF NOT EXISTS public.cotas_boletos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE,
  cota_definitiva_id UUID REFERENCES public.cotas_definitivas(id) ON DELETE SET NULL,
  numero_grupo TEXT NOT NULL,
  numero_cota TEXT NOT NULL,
  cliente_nome TEXT,
  cliente_documento TEXT,
  cliente_telefone TEXT,
  competencia TEXT NOT NULL,
  vencimento DATE,
  valor NUMERIC(14,2),
  arquivo_storage_path TEXT,
  arquivo_url TEXT,
  qr_code_pix TEXT,
  linha_digitavel TEXT,
  status TEXT NOT NULL DEFAULT 'DISPONIVEL' CHECK (status IN ('DISPONIVEL', 'BAIXADO', 'ENVIADO_WHATSAPP', 'PAGO')),
  origem TEXT NOT NULL DEFAULT 'ROBO_NEWCON',
  enviado_em TIMESTAMPTZ,
  enviado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  enviado_por_nome TEXT,
  metadados JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cotas_boletos_empresa_grupo_cota_comp_unique UNIQUE (empresa_id, numero_grupo, numero_cota, competencia)
);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS cotas_boletos_empresa_comp_idx
  ON public.cotas_boletos (empresa_id, competencia);

CREATE INDEX IF NOT EXISTS cotas_boletos_empresa_grupo_cota_idx
  ON public.cotas_boletos (empresa_id, numero_grupo, numero_cota);

CREATE INDEX IF NOT EXISTS cotas_boletos_status_idx
  ON public.cotas_boletos (empresa_id, status);

-- Habilitar RLS
ALTER TABLE public.cotas_boletos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'cotas_boletos' AND policyname = 'cotas_boletos_tenant_policy'
  ) THEN
    CREATE POLICY "cotas_boletos_tenant_policy"
      ON public.cotas_boletos
      FOR ALL
      USING (
        empresa_id = ((current_setting('request.jwt.claims', true))::json ->> 'empresa_id')::uuid
        OR can_read_tenant_internal(empresa_id)
        OR auth.role() = 'service_role'
      );
  END IF;
END $$;
