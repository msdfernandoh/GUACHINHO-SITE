# Fase 296 — Retiradas comprovadas no fechamento dos sócios

Data: 28/09/2026. A migration `296_retiradas_no_fechamento_socios.sql` cria o vínculo imutável entre sócio, corte, comprovante e saída da conta da empresa. A RPC de fechamento passa a verificar que cada retirada não supera o direito positivo do sócio, que a soma confere com o demonstrativo e que há caixa. Quando houver retirada, insere a saída bancária antes do corte e grava o fechamento e os vínculos na mesma transação. Qualquer erro reverte tudo. A retirada sem comprovante é recusada.

A migration foi aplicada ao banco ligado via SQL direto, com autorização do titular, e registrada como aplicada no histórico após conferência. A Gauchinho permanece com zero fechamentos e zero retiradas de fechamento. A aplicação ainda não foi implantada em produção.

A tela permite simular retirada de zero ou de ambos os sócios. Para registrar uma retirada positiva, exige a referência de uma transferência real. O demonstrativo mostra impostos guardados, lucro comum ainda na empresa, o valor deixado por cada sócio para despesas futuras, o saldo bancário após retiradas e eventual falta de cobertura. O primeiro fechamento continua bloqueado pelas conciliações descritas na análise de 28/09.

Validação: TypeScript, testes unitários do rateio e build Next aprovados. A conferência com extrato bancário real e a atribuição das contas pagas continuam pendentes antes de fechar.
