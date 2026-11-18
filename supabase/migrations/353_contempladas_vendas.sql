-- Registro de cartas vendidas no portal contempladas (base para taxa por carta vendida).
ALTER TABLE public.contempladas_cotas
  ADD COLUMN IF NOT EXISTS vendida_em timestamptz,
  ADD COLUMN IF NOT EXISTS vendida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.contempladas_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE RESTRICT,
  cota_id uuid NOT NULL REFERENCES public.contempladas_cotas(id) ON DELETE RESTRICT,
  codigo text NOT NULL,
  tipo text NOT NULL,
  credito numeric(15,2) NOT NULL,
  dono_auth_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dono_nome text,
  marcada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  taxa_valor numeric(15,2),
  cobrada_em timestamptz,
  estornada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS contempladas_vendas_cota_ativa_idx ON public.contempladas_vendas (cota_id) WHERE estornada_em IS NULL;
CREATE INDEX IF NOT EXISTS contempladas_vendas_empresa_idx ON public.contempladas_vendas (empresa_id, created_at);
ALTER TABLE public.contempladas_vendas ENABLE ROW LEVEL SECURITY;

-- Toda cota que vira VENDIDA gera uma linha; voltar de VENDIDA marca o estorno.
CREATE OR REPLACE FUNCTION public.contempladas_registrar_venda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'VENDIDA' AND (OLD.status IS DISTINCT FROM 'VENDIDA') THEN
    NEW.vendida_em := now();
    INSERT INTO public.contempladas_vendas (empresa_id, cota_id, codigo, tipo, credito, dono_auth_id, dono_nome, marcada_por)
    VALUES (NEW.empresa_id, NEW.id, NEW.codigo, NEW.tipo, NEW.credito, NEW.dono_auth_id, NEW.dono_nome, NEW.vendida_por)
    ON CONFLICT DO NOTHING;
  ELSIF OLD.status = 'VENDIDA' AND NEW.status <> 'VENDIDA' THEN
    NEW.vendida_em := NULL;
    UPDATE public.contempladas_vendas SET estornada_em = now() WHERE cota_id = NEW.id AND estornada_em IS NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS contempladas_cotas_venda_trg ON public.contempladas_cotas;
CREATE TRIGGER contempladas_cotas_venda_trg BEFORE UPDATE OF status ON public.contempladas_cotas
FOR EACH ROW EXECUTE FUNCTION public.contempladas_registrar_venda();
