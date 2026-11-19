-- Desfazer inclusão: lote guarda o dono e quando foi desfeito (as cotas ainda disponíveis viram INATIVA).
ALTER TABLE public.contempladas_lotes ADD COLUMN IF NOT EXISTS desfeito_em timestamptz, ADD COLUMN IF NOT EXISTS dono_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL, ADD COLUMN IF NOT EXISTS dono_nome text;
UPDATE public.contempladas_lotes l SET dono_auth_id = c.dono_auth_id, dono_nome = c.dono_nome FROM (SELECT DISTINCT ON (lote_id) lote_id, dono_auth_id, dono_nome FROM public.contempladas_cotas WHERE lote_id IS NOT NULL) c WHERE c.lote_id = l.id AND l.dono_auth_id IS NULL;
