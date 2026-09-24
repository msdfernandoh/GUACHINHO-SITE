-- 282 — Um vínculo de item do relatório só é completo quando sua baixa
-- financeira canônica também é registrada. As rotinas anteriores de releitura
-- podiam criar VINCULADO_AUTO após o recebimento já existir, deixando o valor
-- vinculado em zero e, consequentemente, a comissão do participante travada.

BEGIN;

CREATE OR REPLACE FUNCTION public.sincronizar_importacao_repasse_canonica_282(
  p_empresa_id uuid,
  p_importacao_id uuid,
  p_usuario_id uuid DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_importacao public.erp_repasse_importacoes%ROWTYPE;
  v_item record;
  v_sincronizados integer := 0;
BEGIN
  SELECT * INTO v_importacao
  FROM public.erp_repasse_importacoes
  WHERE id = p_importacao_id AND empresa_id = p_empresa_id
  FOR UPDATE;

  IF NOT FOUND OR v_importacao.recebimento_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR v_item IN
    SELECT id
    FROM public.erp_repasse_importacao_itens
    WHERE empresa_id = p_empresa_id
      AND importacao_id = p_importacao_id
      AND previsao_franquia_id IS NOT NULL
      AND status_conciliacao IN ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO')
    ORDER BY linha, id
  LOOP
    PERFORM public.sincronizar_item_repasse_canonico_203(
      p_empresa_id,
      v_item.id,
      p_usuario_id
    );
    v_sincronizados := v_sincronizados + 1;
  END LOOP;

  RETURN v_sincronizados;
END;
$$;

-- A releitura pode criar um vínculo depois que o recebimento já foi gravado.
-- Este trigger fecha essa lacuna sem reintroduzir o antigo trigger duplicado.
CREATE OR REPLACE FUNCTION public.trg_sincronizar_item_repasse_282()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recebimento_id uuid;
BEGIN
  IF NEW.previsao_franquia_id IS NULL
     OR NEW.status_conciliacao NOT IN ('VINCULADO_AUTO', 'VINCULADO_MANUAL', 'LANCADO_LEGADO') THEN
    RETURN NEW;
  END IF;

  SELECT recebimento_id INTO v_recebimento_id
  FROM public.erp_repasse_importacoes
  WHERE id = NEW.importacao_id AND empresa_id = NEW.empresa_id;

  IF v_recebimento_id IS NOT NULL THEN
    PERFORM public.sincronizar_item_repasse_canonico_203(NEW.empresa_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repasse_item_sincronizar_baixa_282 ON public.erp_repasse_importacao_itens;
CREATE TRIGGER trg_repasse_item_sincronizar_baixa_282
AFTER INSERT OR UPDATE OF previsao_franquia_id, status_conciliacao
ON public.erp_repasse_importacao_itens
FOR EACH ROW
EXECUTE FUNCTION public.trg_sincronizar_item_repasse_282();

-- Quando o recebimento é registrado depois da leitura do PDF, liquida todos
-- os vínculos já existentes usando a mesma rotina idempotente.
CREATE OR REPLACE FUNCTION public.trg_sincronizar_importacao_repasse_282()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.recebimento_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.recebimento_id IS DISTINCT FROM NEW.recebimento_id) THEN
    PERFORM public.sincronizar_importacao_repasse_canonica_282(NEW.empresa_id, NEW.id, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repasse_importacao_sincronizar_baixa_282 ON public.erp_repasse_importacoes;
CREATE TRIGGER trg_repasse_importacao_sincronizar_baixa_282
AFTER INSERT OR UPDATE OF recebimento_id
ON public.erp_repasse_importacoes
FOR EACH ROW
EXECUTE FUNCTION public.trg_sincronizar_importacao_repasse_282();

-- Corrige as importações históricas. Uma importação sem saldo suficiente não
-- impede a migration nem recebe baixa fictícia; o aviso identifica que ela
-- precisa de conferência financeira.
DO $$
DECLARE
  v_importacao record;
BEGIN
  FOR v_importacao IN
    SELECT empresa_id, id
    FROM public.erp_repasse_importacoes
    WHERE recebimento_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM public.sincronizar_importacao_repasse_canonica_282(
        v_importacao.empresa_id, v_importacao.id, NULL
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Repasse % não foi sincronizado automaticamente: %', v_importacao.id, SQLERRM;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sincronizar_importacao_repasse_canonica_282(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sincronizar_item_repasse_282()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_sincronizar_importacao_repasse_282()
  FROM PUBLIC, anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
