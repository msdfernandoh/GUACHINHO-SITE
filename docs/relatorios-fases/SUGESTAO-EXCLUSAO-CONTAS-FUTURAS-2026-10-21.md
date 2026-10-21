# Revisão das contas futuras — 21/10/2026

Pedido: verificar salários, energia e demais contas que não sejam parcelas e
sugerir exclusões. Auditoria somente leitura da empresa Gauchinho. Nenhuma
exclusão, baixa, mudança de obrigação ou alteração do banco foi executada.

## Critério e resultado

45 contas abertas não excluídas: 27 recorrentes e 18 parcelas de compras.
Recorrentes têm serie_recorrencia_id e foram criadas antecipadamente em
01/09/2026; o contador de recorrência não significa parcela de uma compra.
Parcelas de ar-condicionado, impressora e papel de parede têm índice explícito
na descrição e origem CSV_CONTAS_PAGAR_V1; ficam preservadas.

Futuro = vencimento posterior a 21/10/2026. Das 27 recorrentes abertas, 22
atendem a esse critério; cinco já venceram em outubro, apesar de continuarem
abertas. Essas cinco não devem ser excluídas como se fossem previsão futura.

## Sugestão para revisão/exclusão: 14 contas futuras, R$ 23.360,00

Valores repetidos, fornecedores genéricos em parte dos casos, sem documento
anexado, nota fiscal ou observação nessas séries. Ausência de anexo não prova
ausência de obrigação: antes de excluir, confirmar que se trata de previsão
antecipada, e não de folha, fatura ou serviço já contratado. Sugestão operacional:
retirar previsões genéricas de Contas a pagar e manter orçamento separado;
cadastrar o título real quando houver valor e vencimento confirmados.

| Conta | Vencimento | Valor | ID para eventual decisão |
| --- | --- | --- | --- |
| Eventos | 2026-10-30 | R$ 4.000,00 | f6e54198-c18f-47a3-a38b-199b04e36a50 |
| Material de Limpeza, Outras despesas | 2026-10-30 | R$ 1.300,00 | 6120c7d5-94f1-44b1-8d88-7692ce1b4060 |
| Salario | 2026-11-07 | R$ 2.500,00 | ad9320d6-9923-46e1-b390-68147525e76c |
| Piscineiro | 2026-11-15 | R$ 350,00 | 8791051b-eb74-48f0-87b3-e828578df051 |
| Energia | 2026-11-20 | R$ 700,00 | 462b3064-d9ed-4bc1-9c70-161876951b2d |
| Internet | 2026-11-20 | R$ 180,00 | 5c1b1519-f6e9-4d7a-933b-1fd2e743b114 |
| Eventos | 2026-11-30 | R$ 4.000,00 | 97115a8e-03b1-4e27-901a-1641862ee503 |
| Material de Limpeza, Outras despesas | 2026-11-30 | R$ 1.300,00 | 4fe8e5e4-12d6-476f-8572-397e27290426 |
| Salario | 2026-12-07 | R$ 2.500,00 | 6b51bc3d-6dac-41fd-8765-acba0852bd06 |
| Piscineiro | 2026-12-15 | R$ 350,00 | e5b4d933-e8fa-43ee-a168-638ac040888d |
| Energia | 2026-12-20 | R$ 700,00 | 42076bb2-d0e1-4a34-9c1e-dfa5de3b08e2 |
| Internet | 2026-12-20 | R$ 180,00 | be7086e7-fd26-4f1d-9273-d1ab524d30e7 |
| Eventos | 2026-12-30 | R$ 4.000,00 | adf99d1a-e840-46e9-99a3-f30c8db15016 |
| Material de Limpeza, Outras despesas | 2026-12-30 | R$ 1.300,00 | 8083e2f6-f330-4109-ad01-c48b467be71b |

Prioridade maior: Eventos (três × R$ 4.000,00) e Material de limpeza/Outras
despesas (três × R$ 1.300,00), descrições de orçamento genérico, total R$ 15.900,00.
Energia está estimada em R$ 700,00 por mês; duas futuras totalizam R$ 1.400,00.
Salário aparece sem funcionário na descrição (Folha de Pagamento), duas futuras
de R$ 2.500,00; revisar contra a folha real. Internet: duas de R$ 180,00;
Piscineiro: duas de R$ 350,00; confirmar contrato e prestação.

## Aluguel: revisar contrato antes de excluir

Oito lançamentos futuros, R$ 3.500,00 cada, novembro/2026 a junho/2027:
**R$ 28.000,00**. Não são parcelas de compra, mas aluguel pode ser obrigação
contratual mensal. Manter se contrato, valor e datas estiverem vigentes;
excluir apenas se forem projeções que o titular quer retirar do contas a pagar.

| Vencimento | ID |
| --- | --- |
| 2026-11-15 | a8eb2f70-e44f-49c7-9d5c-989369b1e206 |
| 2026-12-15 | 6fa03f19-74f6-412e-be3b-d9f3194036ab |
| 2027-01-15 | 25f0b012-6861-4d4e-bbe4-bf6655cf32f9 |
| 2027-02-15 | ad4a1c4d-416f-4bfd-a7e8-f1a21edf4b06 |
| 2027-03-15 | 293f6bd0-a211-406d-bcc9-8a42f3f62abb |
| 2027-04-15 | 1425843f-d6b6-4d8f-9858-24dcd426deca |
| 2027-05-15 | 5aa6d5cb-70bd-4635-90da-d7d4109ba712 |
| 2027-06-15 | 86883b2e-4225-4edd-8c3a-5538d91eb78e |

## Outubro já vencido: conferir quitação, sem excluir por ser futuro

Salário R$ 2.500,00 (07/10), aluguel R$ 3.500,00 e piscineiro R$ 350,00
(15/10), energia R$ 700,00 e internet R$ 180,00 (20/10): cinco contas,
**R$ 7.230,00**. Verificar se foram pagas e não baixadas ou se ainda são devidas.

## Parcelas a preservar

- Ar-condicionado: oito abertas, parcelas 3/10 a 10/10, R$ 350,00 cada.
- Papel de parede: quatro abertas, parcelas 3/6 a 6/6, R$ 479,00 cada.
- Impressora: seis abertas, parcelas 3/8 a 8/8, R$ 114,01 cada.

Total das 18 parcelas abertas: **R$ 5.400,06**; inclui três já vencidas em
outubro. Não houve sugestão de apagar essas compras parceladas.

## Limites e autorização

Sugestão baseada nos registros existentes, sem contratos, folhas ou faturas
anexadas que confirmem obrigação. A solicitação atual pede sugestão e não
autoriza exclusão; nenhuma conta foi modificada. Consulta ordenada e totals
validados por contagem e soma decimal. Sem mudança de código ou migration.
