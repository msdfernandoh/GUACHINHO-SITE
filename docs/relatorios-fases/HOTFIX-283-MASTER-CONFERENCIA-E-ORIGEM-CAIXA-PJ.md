# Hotfix 283 — Conferência pelo master financeiro e origem do Caixa PJ

## Alterações

- A conferência de uma baixa pode ser feita pelo próprio participante ou por um usuário com a permissão `gerenciar_financeiro`, como o master Fernando. A coluna `conferido_por_usuario_id` registra quem realizou a operação.
- O modal **Ver detalhes** do Caixa Livre PJ exibe impostos retidos nas comissões, repasses pagos a outros vendedores e o resultado operacional das comissões antes de apresentar as reservas e o caixa livre.
- A composição declara que os valores comerciais explicam a origem dos recursos, enquanto o saldo bancário também reflete despesas e demais movimentações posteriores.
- Foi identificada a diferença de **R$ 540,89** da conta Fernando: em 15/09 houve uma saída de pagamento de comissão nessa própria conta. O novo bloqueio impede que contas vinculadas a participantes sejam selecionadas como origem de futuros pagamentos; somente uma conta sem participante (a conta PJ) pode ser usada.
- A regularização foi lançada de forma append-only como transferência auditável da conta **Gauchinho Empresa** para **Fernando**, restaurando o saldo Fernando para R$ 10.258,78. O card de entradas e o detalhamento PJ passam a discriminar impostos de Fernando, Eroni, demais colaboradores e o resultado operacional das comissões.
- Na publicação da migration 284, a coluna `participante_comercial_id` foi acrescentada ao fim da view `financeiro_contas_saldos`, preservando a ordem de suas colunas já existente no Postgres. Com isso, a tela identifica corretamente a conta PJ como origem institucional e volta a disponibilizá-la para pagar as parcelas selecionadas.
