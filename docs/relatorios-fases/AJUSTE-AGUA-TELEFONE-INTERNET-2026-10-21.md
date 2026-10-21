# Sugestões de água, telefone e internet — 21/10/2026

Titular definiu água R$ 150,00, telefone R$ 50,00 e internet R$ 200,00 mensais
para a lista de outubro/novembro. Valores atualizados em Contas a pagar e no
orçamento canônico exibido em Metas.

- Criadas quatro contas abertas em estágio PREVISAO: água e telefone nos dois
  meses, com fornecedores históricos Aguas de sinop e Vivo. Chaves idempotentes
  por serviço, empresa e operação. Datas de referência do histórico: dia 09 para
  água, dia 24 para telefone; observação exige conferir fatura/vencimento real.
- Atualizadas as duas contas abertas de internet de R$ 180,00 para R$ 200,00
  usando a RPC canônica de edição, com log e observação da autorização.
- Orçamento dos três serviços classificado VARIAVEL, como estimativa. Água e
  telefone acrescentados; internet substitui o valor anterior, sem duplicar.
- Total de cada mês: **12 itens e R$ 8.681,31**, incluindo parcelas existentes.
  Aumento mensal R$ 220,00: água 150 + telefone 50 + internet 20.
- Nenhum condomínio ou despesa extra acrescentado; nenhum pagamento registrado.

Teste completo sob rollback antes da aplicação atômica. Assertions de contagem,
valor e preservação de contas fora do escopo e de hashes de banco/caixa.
Consulta independente após commit confirmou 12 contas abertas e 12 itens no
orçamento, R$ 8.681,31 por competência, outubro e novembro/2026.

Sem alteração de código ou migration; saldos bancários preservados.
