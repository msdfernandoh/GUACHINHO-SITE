-- 253 — Um ajuste confirmado no relatório de repasse precisa refletir na
-- comissão do participante. Sem esta sincronização a linha ajustada ficava
-- como "Aguardando liberação", mesmo com dinheiro recebido e ajuste aprovado.

BEGIN;

CREATE OR REPLACE FUNCTION public.erp_repasse_sincronizar_ajuste_participante_253()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  -- A decisão AJUSTAR_DIFERENCA torna o valor da linha do relatório canônico.
  -- A função 203 cria o rateio do recebimento, atualiza o líquido e recalcula
  -- valor_elegivel/status de todos os participantes da previsão.
  IF NEW.decisao = 'AJUSTAR_DIFERENCA'
     AND NEW.item_importacao_id IS NOT NULL THEN
    PERFORM public.sincronizar_item_repasse_canonico_203(
      NEW.empresa_id,
      NEW.item_importacao_id,
      -- O lançador de baixa é opcional. Não reutilizamos um usuário que possa
      -- ter sido removido da tabela de auditoria depois da decisão.
      NULL
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zzz_repasse_sincronizar_ajuste_participante_253
  ON public.erp_repasse_atencao_resolucoes;
CREATE TRIGGER trg_zzz_repasse_sincronizar_ajuste_participante_253
AFTER INSERT ON public.erp_repasse_atencao_resolucoes
FOR EACH ROW
EXECUTE FUNCTION public.erp_repasse_sincronizar_ajuste_participante_253();

-- Repara as decisões já confirmadas. A rotina é idempotente: se a linha já
-- estiver sincronizada, não cria novo rateio e apenas recalcula a elegibilidade.
DO $$
DECLARE
  v_resolucao record;
BEGIN
  FOR v_resolucao IN
    SELECT empresa_id, item_importacao_id
    FROM public.erp_repasse_atencao_resolucoes
    WHERE decisao = 'AJUSTAR_DIFERENCA'
      AND item_importacao_id IS NOT NULL
    ORDER BY created_at, id
  LOOP
    PERFORM public.sincronizar_item_repasse_canonico_203(
      v_resolucao.empresa_id,
      v_resolucao.item_importacao_id,
      NULL
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.erp_repasse_sincronizar_ajuste_participante_253()
  FROM PUBLIC, anon, authenticated;

COMMIT;
NOTIFY pgrst, 'reload schema';
