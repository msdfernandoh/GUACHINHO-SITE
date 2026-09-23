-- 254: Permite a exclusão definitiva de um lead e seus convites Network dependentes.
-- Os convites não têm significado operacional sem o lead de origem.
BEGIN;

ALTER TABLE public.programa_convites_network
  DROP CONSTRAINT IF EXISTS programa_convites_network_lead_id_fkey;

ALTER TABLE public.programa_convites_network
  ADD CONSTRAINT programa_convites_network_lead_id_fkey
  FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

COMMIT;
NOTIFY pgrst, 'reload schema';
