-- Fase 215: mantém o portal parceiro Racon Sinop na paleta pública Racon.
-- O portal é independente da empresa anfitriã; esta mudança não toca dados
-- comerciais, vínculos, permissões ou domínios.
BEGIN;

UPDATE public.parceiro_sites
SET branding = COALESCE(branding, '{}'::jsonb) || jsonb_build_object(
      'identidade_visual_modo', 'PERSONALIZADA',
      'cor_primaria', '#0066cc',
      'cor_secundaria', '#0c2340',
      'cor_destaque', '#0099dd'
    ),
    updated_at = now()
WHERE id = 'e3ef4a16-fd07-4bd0-a93f-1b5ce8f0ae0a'::uuid
  AND empresa_id = '7170f38e-15dd-4b19-8588-51e9a9cf0d4c'::uuid
  AND slug = 'racon-sinop'
  AND ativo = true;

COMMIT;
NOTIFY pgrst, 'reload schema';
