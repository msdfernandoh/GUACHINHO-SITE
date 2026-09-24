-- 284 — Uma comissão deve sair de uma conta da empresa. Contas vinculadas a
-- participantes são destino/conta pessoal e não podem ser usadas como origem.

BEGIN;

CREATE OR REPLACE VIEW public.financeiro_contas_saldos
WITH (security_invoker = true) AS
-- Preserve the existing view-column order. PostgreSQL only permits new columns
-- to be appended when replacing a view already consumed by the application.
SELECT c.id, c.empresa_id, c.nome, c.banco, c.agencia, c.conta_mascarada,
  c.tipo_conta, c.chave_pix, c.ativo,
  round(coalesce(c.saldo_inicial, 0) + coalesce(sum(CASE WHEN m.tipo = 'ENTRADA' THEN m.valor ELSE -m.valor END), 0), 2) AS saldo_atual,
  coalesce(sum(m.valor) FILTER (WHERE m.tipo = 'ENTRADA'), 0)::numeric(15,2) AS total_entradas,
  coalesce(sum(m.valor) FILTER (WHERE m.tipo = 'SAIDA'), 0)::numeric(15,2) AS total_saidas,
  c.participante_comercial_id
FROM public.financeiro_contas_bancarias c
LEFT JOIN public.financeiro_conta_movimentos m
  ON m.conta_bancaria_id = c.id AND m.empresa_id = c.empresa_id
GROUP BY c.id;

COMMIT;
NOTIFY pgrst, 'reload schema';
