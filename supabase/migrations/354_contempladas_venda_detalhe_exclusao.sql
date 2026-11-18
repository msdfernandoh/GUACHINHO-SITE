-- Venda com vendedor, gerente e quem marcou; pedido de exclusão do gerente para o dono aprovar.
ALTER TABLE public.contempladas_cotas
  ADD COLUMN IF NOT EXISTS vendedor_nome text,
  ADD COLUMN IF NOT EXISTS vendida_por_nome text,
  ADD COLUMN IF NOT EXISTS exclusao_solicitada_em timestamptz,
  ADD COLUMN IF NOT EXISTS exclusao_solicitada_por text,
  ADD COLUMN IF NOT EXISTS exclusao_motivo text;
ALTER TABLE public.contempladas_vendas
  ADD COLUMN IF NOT EXISTS vendedor_nome text,
  ADD COLUMN IF NOT EXISTS marcada_por_nome text;

CREATE OR REPLACE FUNCTION public.contempladas_registrar_venda() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'VENDIDA' AND (OLD.status IS DISTINCT FROM 'VENDIDA') THEN
    NEW.vendida_em := now();
    INSERT INTO public.contempladas_vendas (empresa_id, cota_id, codigo, tipo, credito, dono_auth_id, dono_nome, marcada_por, marcada_por_nome, vendedor_nome)
    VALUES (NEW.empresa_id, NEW.id, NEW.codigo, NEW.tipo, NEW.credito, NEW.dono_auth_id, NEW.dono_nome, NEW.vendida_por, NEW.vendida_por_nome, NEW.vendedor_nome)
    ON CONFLICT DO NOTHING;
  ELSIF OLD.status = 'VENDIDA' AND NEW.status <> 'VENDIDA' THEN
    NEW.vendida_em := NULL;
    NEW.vendedor_nome := NULL;
    NEW.vendida_por_nome := NULL;
    UPDATE public.contempladas_vendas SET estornada_em = now() WHERE cota_id = NEW.id AND estornada_em IS NULL;
  END IF;
  RETURN NEW;
END $$;
