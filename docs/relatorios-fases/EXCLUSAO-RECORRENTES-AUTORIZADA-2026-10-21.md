# Exclusão autorizada de recorrências abertas — 21/10/2026

Titular autorizou excluir todas as contas recorrentes sugeridas, em todos os
meses. Escopo anunciado antes da execução: salário, energia, piscineiro,
internet, eventos, limpeza/despesas diversas e aluguel, inclusive vencidas ainda
abertas. Contas pagas e parcelas de compras preservadas.

## Resultado

| Tipo | Quantidade | Total |
| --- | ---: | ---: |
| Salário | 3 | R$ 7.500,00 |
| Energia | 3 | R$ 2.100,00 |
| Piscineiro | 3 | R$ 1.050,00 |
| Internet | 3 | R$ 540,00 |
| Eventos | 3 | R$ 12.000,00 |
| Material de limpeza/Outras despesas | 3 | R$ 3.900,00 |
| Aluguel | 9 | R$ 31.500,00 |
| **Total** | **27** | **R$ 58.590,00** |

Períodos: outubro a dezembro/2026 para as seis primeiras categorias;
outubro/2026 a junho/2027 para aluguel. Inclui cinco recorrências já vencidas
em outubro, conforme instrução de todos os meses. Não cancela contrato,
prestação de serviço ou obrigação externa: remove os lançamentos do sistema.

Execução por lista fechada dos 27 IDs auditados, em uma transação, usando
`rpc_excluir_conta_pagar` com usuário interno do titular e validação de empresa.
Exclusão lógica: status cancelada, excluida_em/autor/motivo e log EXCLUSAO.
Histórico preservado; não houve DELETE físico nem estorno de pagamento.

## Verificação

- Primeiro executado sob rollback; assertions de 27 contas e R$ 58.590,00.
- Antes de excluir, cada alvo revalidado como aberto, sem pagamento, sem saída
  de caixa, em série recorrente e com descrição dentro do escopo autorizado.
- Commit confirmou 27 exclusões e 27 logs atribuídos ao titular.
- Hashes de caixa, movimentos bancários, pagamentos e todas as contas fora da
  lista permaneceram iguais, inclusive as contas pagas e as parcelas.
- Consulta independente após commit: 18 contas abertas restantes, R$ 5.400,06,
  correspondentes a ar-condicionado, papel de parede e impressora.

Sem migration ou alteração de código. Esta autorização substitui a etapa
anterior de mera sugestão registrada no relatório de contas futuras.
