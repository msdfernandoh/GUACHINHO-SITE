-- O dominio ja publicado na Vercel usa www como host principal. Alinha o
-- canonical do site parceiro para impedir o ciclo apex -> www -> apex.

BEGIN;

UPDATE public.parceiro_site_dominios
SET dns_instrucoes = COALESCE(dns_instrucoes, '{}'::jsonb) || jsonb_build_object(
      'principal_variant', 'www',
      'canonical_ajustado_em', now(),
      'canonical_ajustado_motivo', 'Alinhar ao redirecionamento principal configurado na Vercel'
    ),
    canonical_redirect = true,
    updated_at = now()
WHERE parceiro_site_id = 'e3ef4a16-fd07-4bd0-a93f-1b5ce8f0ae0a'::uuid
  AND empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND lower(valor) = 'raconsinop.com.br'
  AND status = 'ATIVO'
  AND verificado = true
  AND ssl_status = 'READY';

COMMIT;
NOTIFY pgrst, 'reload schema';
