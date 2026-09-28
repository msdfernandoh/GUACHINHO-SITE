# Navegação e conciliação do fechamento — 28/09/2026

## Navegação

Os cards do painel de fechamento são links: abrem os lançamentos relacionados em nova aba. Meses e totais mensais levam à lista de contas pagas daquele mês. Categorias levam à lista já filtrada por centro de custo; “Sem categoria” abre o cadastro de centros de custo para a classificação.

A tela de Contas a Pagar passou a aceitar filtros pela URL para status, data de pagamento, intervalo e centro de custo. O Financeiro & Caixa aceita filtro de categoria do movimento, usado pelos cards de repasse e receita de evento.

## Conciliação de caixa

A auditoria identificou que o saldo de R$ 54.970,35 era o saldo de movimentos bancários já registrados, e não a posição financeira definitiva: havia 102 contas marcadas como pagas pela empresa, R$ 73.153,08, sem saída vinculada no caixa. As 20 contas de Fernando, R$ 9.790,61, seguem fora desse alerta porque são pagamento pessoal e não saída bancária da empresa.

O painel agora apresenta a pendência e a projeção após essas saídas. O fechamento fica bloqueado até que os pagamentos sejam conciliados, evitando lacrar um saldo bancário fictício. Não foram criadas saídas automáticas porque elas exigem a conta de origem e o comprovante reais de cada pagamento.

## Validação

`npx tsc --noEmit` foi concluído sem erros.
