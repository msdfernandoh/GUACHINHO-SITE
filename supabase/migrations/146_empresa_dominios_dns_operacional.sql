-- 146: Ciclo operacional de domínio tenant (Vercel, DNS, SSL e diagnóstico).

BEGIN;

ALTER TABLE public.empresa_dominios
  ADD COLUMN IF NOT EXISTS status_dns text NOT NULL DEFAULT 'PENDENTE_DNS',
  ADD COLUMN IF NOT EXISTS status_vercel text NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS status_ssl text NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS dns_instrucoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ultima_verificacao_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_mensagem_erro text;

UPDATE public.empresa_dominios
SET
  status_dns = CASE WHEN verificado THEN 'ATIVO' ELSE 'PENDENTE_DNS' END,
  status_vercel = CASE WHEN verificado THEN 'ADICIONADO' ELSE 'PENDENTE' END,
  status_ssl = CASE WHEN verificado THEN 'READY' ELSE 'PENDING' END,
  dns_instrucoes = CASE
    WHEN tipo = 'SUBDOMINIO' THEN jsonb_build_object(
      'registros_esperados', jsonb_build_array(
        jsonb_build_object('tipo', 'CNAME', 'host', valor, 'valor', 'cname.vercel-dns-0.com')
      )
    )
    ELSE jsonb_build_object(
      'registros_esperados', jsonb_build_array(
        jsonb_build_object('tipo', 'A', 'host', '@', 'valor', '76.76.21.21'),
        jsonb_build_object('tipo', 'CNAME', 'host', 'www', 'valor', 'cname.vercel-dns-0.com')
      )
    )
  END
WHERE dns_instrucoes = '{}'::jsonb;

ALTER TABLE public.empresa_dominios
  DROP CONSTRAINT IF EXISTS empresa_dominios_status_dns_check,
  DROP CONSTRAINT IF EXISTS empresa_dominios_status_vercel_check,
  DROP CONSTRAINT IF EXISTS empresa_dominios_status_ssl_check;

ALTER TABLE public.empresa_dominios
  ADD CONSTRAINT empresa_dominios_status_dns_check
    CHECK (status_dns IN ('PENDENTE_DNS', 'VERIFICANDO', 'ATIVO', 'ERRO', 'INATIVO')),
  ADD CONSTRAINT empresa_dominios_status_vercel_check
    CHECK (status_vercel IN ('PENDENTE', 'ADICIONADO', 'ERRO', 'DESCONHECIDO')),
  ADD CONSTRAINT empresa_dominios_status_ssl_check
    CHECK (status_ssl IN ('PENDING', 'READY', 'ERROR'));

CREATE INDEX IF NOT EXISTS empresa_dominios_status_dns_idx
  ON public.empresa_dominios(status_dns, ativo);

COMMIT;
