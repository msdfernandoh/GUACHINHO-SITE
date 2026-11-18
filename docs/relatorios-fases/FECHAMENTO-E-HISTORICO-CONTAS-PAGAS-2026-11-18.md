# Fechamento dos Sócios e histórico de contas pagas

O relatório de 21/10/2026 registra que as despesas fixas de outubro e novembro
foram cadastradas em aberto. O quadro mensal do Fechamento agrupava despesas
pagas pela data da baixa e usava apenas o corte corrente para detalhar totais
de meses históricos.

O Fechamento agora oferece **Contas em aberto por vencimento**, com seleção
do mês, despesas e total. O detalhamento de pagas usa o mesmo conjunto de
contas que os totais mensais, inclusive para períodos lacrados em modo de
consulta. A leitura das contas é paginada por empresa. O resumo, as regras
de acerto e os bloqueios continuam vinculados ao corte corrente.

No topo de Contas a Pagar, **Pagas desde o início** remove a restrição de
período e **Ver pagas do mês** aplica o mês escolhido. Os atalhos filtram
pela data do pagamento, limpam os critérios da lista e ordenam da baixa
mais recente para a mais antiga.

O TypeScript, a análise estática dos arquivos alterados e os 22 testes
existentes de fechamento, períodos e consulta financeira passaram.
Nenhuma migração ou alteração de dados foi realizada. Publicação e
conferência autenticada em produção pendentes.
