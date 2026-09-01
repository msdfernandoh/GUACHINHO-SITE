-- A Vercel ja gerencia o redirect apex -> www para este dominio. Desativa o
-- redirect duplicado no runtime Next.js, que recebe o host normalizado e
-- poderia responder 308 para a propria URL publica.

BEGIN;

UPDATE public.parceiro_site_dominios
SET canonical_redirect = false,
    dns_instrucoes = COALESCE(dns_instrucoes, '{}'::jsonb) || jsonb_build_object(
      'canonical_gerenciado_por', 'VERCEL',
      'canonical_runtime_desativado_em', now(),
      'canonical_runtime_desativado_motivo', 'Evitar redirect duplicado e loop no runtime Next.js'
    ),
    updated_at = now()
WHERE id = 'fec09cb0-b6cd-4a9e-b9d7-0f2852539721'::uuid
  AND parceiro_site_id = 'e3ef4a16-fd07-4bd0-a93f-1b5ce8f0ae0a'::uuid
  AND empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND lower(valor) = 'raconsinop.com.br'
  AND status = 'ATIVO'
  AND verificado = true
  AND ssl_status = 'READY';

COMMIT;
NOTIFY pgrst, 'reload schema';
