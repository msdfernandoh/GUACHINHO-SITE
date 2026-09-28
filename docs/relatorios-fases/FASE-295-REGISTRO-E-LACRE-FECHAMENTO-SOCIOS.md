# Fase 295 — Registro e lacre do fechamento dos sócios

Data: 28/09/2026. O banco recebeu `financeiro_fechamentos_socios_cortes`, com período, demonstrativo JSON, observações, autor, data e chave de idempotência. O registro é imutável. A RPC exige permissão financeira do tenant, corte não futuro, continuidade após o corte anterior e ausência de fechamento legado. Reconfere despesas pagas e saldo da conta antes de gravar.

Gatilhos por `empresa_id` impedem alterações retroativas em contas pagas, recebimentos, pagamentos, movimentos bancários e de caixa, previsões de comissões, repasses importados, ledger e itens de recebimentos/pagamentos/rateios. Contas abertas anteriores podem ser quitadas em data posterior, mas seu valor e descrição não podem ser reescritos após o corte. Ajustes devem ser lançados com data do novo período. A trava transacional por empresa serializa o corte com novas escritas financeiras.

A migration `295_fechamento_socios_corte_lacrado.sql` foi aplicada via SQL direto no banco ligado, conforme autorização do titular, e o schema cache foi recarregado. Não houve fechamento criado. Leitura posterior: zero fechamentos da Gauchinho e 16 gatilhos de corte instalados. Uma transação de teste com `ROLLBACK` confirmou que uma conta retroativa é recusada; a leitura posterior confirmou zero registros de teste. A versão 295 foi então registrada como aplicada no histórico. As migrations 289–293 anteriores continuam pendentes e não houve `db push` cumulativo.

A rota `/erp/fechamento-socios` apresenta período acumulado, apenas contas pagas, impostos separados, comissão sob guarda, adiantamento pessoal, lucro comum confirmado, rateio e posição deixada na empresa. O primeiro fechamento fica bloqueado pelas divergências de repasse, contas atribuídas pessoalmente a Eroni e ajuste histórico de R$ 9.300. Valores de lucro e extrato exigem referência de conferência. Não se gravou valor manual nem fechamento nesta fase.

Validação: TypeScript, testes de cálculo e build Next aprovados. A interface ainda não foi implantada em produção.
