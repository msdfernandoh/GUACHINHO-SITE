-- 108: Governança de Curvas de Estorno por Empresa / Tenant
BEGIN;

ALTER TABLE public.administradora_curvas_estorno
  ADD COLUMN IF NOT EXISTS empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS descricao text;

-- Permitir exclusão em cascata das faixas ao excluir curva
ALTER TABLE public.administradora_curva_estorno_faixas
  DROP CONSTRAINT IF EXISTS administradora_curva_estorno_faixas_curva_id_fkey,
  ADD CONSTRAINT administradora_curva_estorno_faixas_curva_id_fkey
    FOREIGN KEY (curva_id) REFERENCES public.administradora_curvas_estorno(id) ON DELETE CASCADE;

-- Inserir curva padrão para cada administradora se não existir
DO $$
DECLARE
  v_admin_id uuid;
  v_curva_id uuid;
BEGIN
  FOR v_admin_id IN SELECT id FROM public.administradoras WHERE ativo = true LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.administradora_curvas_estorno WHERE administradora_id = v_admin_id AND nome = 'Curva Padrão de Estorno'
    ) THEN
      INSERT INTO public.administradora_curvas_estorno (
        administradora_id, nome, versao, vigencia_inicio, ativa, encerra_na_contemplacao, descricao
      ) VALUES (
        v_admin_id, 'Curva Padrão de Estorno', 1, '2020-01-01', true, true, 'Curva padrão regressiva de estorno antes da contemplação da cota'
      ) RETURNING id INTO v_curva_id;

      -- Inserir faixas padrão (Mês 1 a 6: 100%, Mês 7 a 12: 80%, Mês 13 a 24: 50%)
      INSERT INTO public.administradora_curva_estorno_faixas (curva_id, mes_relativo, percentual_estorno)
      VALUES
        (v_curva_id, 1, 100.0),
        (v_curva_id, 2, 100.0),
        (v_curva_id, 3, 100.0),
        (v_curva_id, 4, 100.0),
        (v_curva_id, 5, 100.0),
        (v_curva_id, 6, 100.0),
        (v_curva_id, 7, 80.0),
        (v_curva_id, 8, 80.0),
        (v_curva_id, 9, 80.0),
        (v_curva_id, 10, 80.0),
        (v_curva_id, 11, 80.0),
        (v_curva_id, 12, 80.0),
        (v_curva_id, 18, 50.0),
        (v_curva_id, 24, 30.0)
      ON CONFLICT (curva_id, mes_relativo) DO NOTHING;
    END IF;
  END LOOP;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';
