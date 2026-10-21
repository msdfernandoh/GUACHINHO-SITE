# Contas fixas e orçamento em Metas — 21/10/2026

Titular autorizou criar a lista de outubro/novembro em Contas a pagar e Metas,
adicionando R$ 800,00 de outros e incluindo contador conforme cadastro existente.
Salário de R$ 2.500,00 continua excluído. Zeladora mensal: R$ 1.500,00.

## Composição mensal aplicada

| Item | Valor | Dia de planejamento | Fonte |
| --- | ---: | ---: | --- |
| Aluguel | R$ 3.500,00 | 15 | Lista autorizada e histórico |
| Salario Zeladora | R$ 1.500,00 | 07 | Valor autorizado, fornecedor Maria Madalena |
| Piscineiro | R$ 350,00 | 15 | Lista autorizada, fornecedor Ronaldo piscineiro |
| Energia | R$ 700,00 | 20 | Estimativa autorizada; conferir fatura |
| Internet | R$ 180,00 | 20 | Lista autorizada; fornecedor Giga byte |
| Outras despesas | R$ 800,00 | 30 | Novo valor autorizado; estimativa mensal |
| Contabilidade | R$ 488,30 | 24 | OST, último cadastro de setembro |
| Ar-condicionado | R$ 350,00 | 01 | Parcela existente, sem duplicar |
| Papel de parede | R$ 479,00 | 09 | Parcela existente, sem duplicar |
| Impressora | R$ 114,01 | 10 | Parcela existente, sem duplicar |
| **Total** | **R$ 8.461,31** | | |

Despesas mensais novas: R$ 7.518,30/mês. Parcelas existentes: R$ 943,01/mês.
Criadas 14 contas abertas (sete × dois meses), R$ 15.036,60; nenhuma quitação ou
saída bancária. Datas são referências dos cadastros anteriores e planejamento,
conforme observações, não confirmação de vencimentos de novas faturas.
Energia e Outros estão classificados como variáveis no orçamento.

Criadas 20 linhas de orçamento na tabela canônica financeiro_previsoes_orcamento,
dez por competência. Consulta posterior confirmou dez contas abertas e dez
linhas de orçamento, R$ 8.461,31, em cada um dos dois meses. Não há soma dupla:
orçamento é a meta de despesa, enquanto Contas a pagar contém os títulos.

## Histórico do contador e sugestões adicionais

OST Contabilidade já tinha pagamentos de R$ 488,00 (junho), R$ 488,50 (agosto)
e R$ 488,30 (setembro). Usado o último valor, com vencimento cadastrado dia 24,
como referência de planejamento para outubro e novembro.

Também encontrados no histórico de setembro: água R$ 552,09, condomínio
R$ 303,52 e telefone Vivo em dois títulos, R$ 182,56 e R$ 220,00. Itens sugeridos
para confirmação; não adicionados silenciosamente à lista autorizada. Em
especial, ainda é necessário identificar as duas linhas de telefone.

## Tela de Metas

Adicionada seção Orçamento de contas fixas e parcelas, por competência, com
valor planejado, tipo e observação, consumindo tabela canônica existente.
Metas comerciais mantidas. Endpoint somente leitura exige acesso de gestão e
permissão gerenciar_financeiro, confere empresa ativa, aplica filtro de tenant,
pagina e responde private/no-store. Sem nova permissão, tabela ou migration.
Consulta de erro não retorna lista parcial e usuário sem acesso financeiro não
recebe o orçamento.

## Validação e preservação

- Preparação SQL primeiro sob rollback, depois aplicação atômica com RPC
  rpc_criar_contas_pagar_recorrentes e chaves estáveis por categoria.
- Bloqueio contra conta ativa já existente na mesma descrição/período quando
  ainda não existe a série da operação. Orçamento usa chave única canônica.
- Assertions de quantidade, valores, preservação por snapshot de todas as contas
  anteriores e hashes de caixa/banco. Parcelas e exclusões anteriores intactas.
- Consulta independente após commit comprovou correspondência mensal entre
  contas e orçamento: 10 itens e R$ 8.461,31 em cada tela/competência.
- 17 testes passaram em três arquivos: API de orçamento (tenant, permissão,
  paginação, erro sem dados parciais), recorrências e decisões de duplicidade.
- TypeScript sem erros; build de produção conferido antes de envio.

Nenhuma guia de imposto ou despesa extra foi estimada sem valor confirmado.
