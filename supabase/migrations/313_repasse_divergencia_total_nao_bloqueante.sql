-- 313 — Preserva o PDF e suas linhas quando a baixa excede o saldo recebido.
-- Sem backfill ou alteração dos livros financeiros existentes.
BEGIN;

CREATE OR REPLACE FUNCTION public.tentar_sincronizar_item_repasse_313(
  p_empresa_id uuid, p_item_id uuid, p_usuario_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_aviso text := 'Saldo do recebimento insuficiente para completar a linha do relatorio';
BEGIN
  -- O bloco de exceção desfaz somente a tentativa desta linha. A rotina
  -- canônica mantém locks, idempotência, elegibilidade e limites financeiros.
  BEGIN
    PERFORM public.sincronizar_item_repasse_canonico_203(p_empresa_id, p_item_id, p_usuario_id);
    RETURN true;
  EXCEPTION WHEN raise_exception THEN
    -- Não ocultar falhas de tenant, vínculo, pagamentos ou qualquer outro erro.
    IF SQLERRM <> v_aviso THEN RAISE; END IF;
  END;

  UPDATE public.erp_repasse_importacao_itens
  SET alertas = CASE WHEN coalesce(alertas, '[]'::jsonb) @> jsonb_build_array(v_aviso)
    THEN alertas ELSE coalesce(alertas, '[]'::jsonb) || jsonb_build_array(v_aviso) END,
    updated_at = now()
  WHERE id = p_item_id AND empresa_id = p_empresa_id;

  UPDATE public.erp_repasse_importacoes imp
  SET status = 'PENDENTE', updated_at = now()
  WHERE imp.empresa_id = p_empresa_id AND imp.id = (
    SELECT i.importacao_id FROM public.erp_repasse_importacao_itens i
    WHERE i.id = p_item_id AND i.empresa_id = p_empresa_id
  );
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sincronizar_importacao_repasse_canonica_282(
  p_empresa_id uuid, p_importacao_id uuid, p_usuario_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item record;
  v_sincronizados integer := 0;
BEGIN
  SELECT * INTO v_importacao FROM public.erp_repasse_importacoes
  WHERE id = p_importacao_id AND empresa_id = p_empresa_id FOR UPDATE;
  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN RETURN 0; END IF;

  FOR v_item IN
    SELECT id FROM public.erp_repasse_importacao_itens
    WHERE empresa_id = p_empresa_id AND importacao_id = p_importacao_id
      AND previsao_franquia_id IS NOT NULL
      AND status_conciliacao IN ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO')
    ORDER BY linha, id
  LOOP
    IF public.tentar_sincronizar_item_repasse_313(p_empresa_id, v_item.id, p_usuario_id) THEN
      v_sincronizados := v_sincronizados + 1;
    END IF;
  END LOOP;
  RETURN v_sincronizados;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sincronizar_item_repasse_282()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog
AS $$
DECLARE v_recebimento_id uuid;
BEGIN
  IF NEW.previsao_franquia_id IS NULL OR NEW.status_conciliacao NOT IN
    ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO') THEN RETURN NEW; END IF;
  SELECT recebimento_id INTO v_recebimento_id FROM public.erp_repasse_importacoes
  WHERE id = NEW.importacao_id AND empresa_id = NEW.empresa_id;
  IF v_recebimento_id IS NOT NULL THEN
    PERFORM public.tentar_sincronizar_item_repasse_313(NEW.empresa_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tentar_sincronizar_item_repasse_313(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sincronizar_importacao_repasse_canonica_282(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sincronizar_item_repasse_282() FROM PUBLIC, anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
