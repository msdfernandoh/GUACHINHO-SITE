# Importação assistida — carteira antiga do Eroni

Data: 19/10/2026. Empresa: Gauchinho Consórcios, Supabase canônico
`eaeuoynprurmmulzhydt`.

## Autorização e escopo

O titular solicitou importar três PDFs exclusivamente no modo **Incluir
relatório antigo — somente cadastro e controle**, sem gerar receita ou
comissões. Autorizou incluir somente clientes/cotas ausentes e preservar os
cadastros comerciais atuais de Fernando, Eroni e demais consultores.

O participante correto do Eroni foi confirmado pelo vínculo com usuário,
perfil MICROFRANQUIA/CONSULTOR e carteira comercial existente. O homônimo
INDICADOR não foi usado. A identidade Auth do operador foi resolvida
separadamente do participante comercial.

## Conferência e resultado

| PDF | Páginas | Linhas lidas | Cotas distintas no PDF | Cotas novas | Clientes novos |
|---|---:|---:|---:|---:|---:|
| 2025 repasse.pdf | 5 | 59 | 29 | 21 | 9 |
| 2025 repasse-2.pdf | 6 | 76 | 37 | 15 | 8 |
| 2025 repasse-3.pdf | 6 | 101 | 59 | 8 | 6 |
| Total criado | 17 | 236 | 81 distintas entre os arquivos | 44 | 23 |

As 37 chaves grupo/cota preexistentes foram integralmente preservadas:
27 vinculadas ao Eroni, 9 ao Fernando e 1 ao Enos. Algumas possuem registros
duplicados no legado; todos foram preservados, sem fusão nem nova duplicação.
Repetições entre os três arquivos também foram reconhecidas.

Uma cliente preexistente, comprovada por suas cotas já cadastradas e vínculo
do Eroni, foi explicitamente reutilizada nas duas cotas faltantes. Nenhum
cliente existente foi editado ou fundido por heurística de nome. Os demais
23 clientes novos compartilham cadastro somente entre as próprias linhas deste
lote. Nenhum grupo novo foi necessário.

Os novos registros são incompletos, com tag Antigos, vendas
`somente_controle=true`, `afeta_faturamento=false` e origem
`IMPORTACAO_LEGADO`. A data da venda vem da primeira data de alocação da cota
nos PDFs; não houve divergência dessa data entre os arquivos. Crédito,
parcela e prazo não confirmados não foram inventados.

## Contemplações provisórias autorizadas

O titular informou expressamente: usar a data de hoje e crédito R$ 1,00,
para posterior correção. Foram aplicados somente nos novos cadastros:

- Grupo 5288 / cota 0974: LANCE, 19/10/2026, R$ 1,00.
- Grupo 1463 / cota 0704: SORTEIO, 19/10/2026, R$ 1,00.

Ambas estão `contemplada=true`, status `contemplada`, com observação e snapshot
indicando dados provisórios autorizados. Não foi acionada geração de comissão.

## Execução e preservação

PDFs originais guardados no bucket privado `repasse-documentos`, sob caminhos
tenant-aware `empresa/antigos/competencia/hash.pdf`, usando sessão autenticada
do titular. Os relatórios completos e seus resultados foram persistidos em
`repasse_relatorios_antigos`, separados de `erp_repasse_importacoes` financeiro.
As competências arquivísticas derivadas dos pedidos são 2025-09, 2025-12 e
2026-08; os nomes dos arquivos originais foram preservados.

A RPC padrão 306 rejeita cotas existentes de consultor diferente. Para atender
à preservação solicitada sem mudar o comportamento geral do produto, esta
operação usou uma função exclusivamente temporária `pg_temp`, derivada da 306,
com os mesmos guards de identidade, permissão, tenant e administradora, e
omissão explícita de toda cota já existente antes da criação de novos fatos.
Não houve migration, alteração de função pública, concessão de permissão,
modificação de RLS ou deploy de código.

Transação única com locks e comparação integral de `to_jsonb` dos fatos
preexistentes. Antes do COMMIT foram confirmados:

- nenhum cliente, venda, cota ou relatório antigo preexistente alterado;
- nenhuma previsão de comissão de franquia ou participante criada/alterada;
- recebimentos, itens de recebimento, pagamentos, itens de pagamento,
  movimentos bancários, caixa e ledger de sócios idênticos ao início;
- importações financeiras e suas linhas idênticas ao início;
- 44 novas vendas/cotas exclusivamente para o participante correto do Eroni;
- 23 novos clientes e duas contemplações provisórias exatamente autorizadas;
- reenvio dos três hashes retornando idempotência sem novos registros.

A mesma operação passou previamente sob ROLLBACK. Após o COMMIT, consulta
independente confirmou 44 cotas, consultor correto, zero previsões novas e as
duas contemplações provisórias. O arquivo SQL com dados pessoais e as evidências
operacionais ficam fora do Git; os PDFs originais permanecem no Storage privado.

IDs dos relatórios:
`c1220110-94d0-4243-a4cb-4c7bd1d0f5ec`,
`5eae8525-6fe9-4f35-844b-a4ab11df83be`,
`79d869ac-995c-4bee-b5e3-f73fe50f6f2f`.

Reversão: nenhuma exclusão automática autorizada. Se necessária, realizar
operação assistida pelos IDs do lote, conferindo antes uso posterior das cotas,
clientes e boletos e preservando histórico/auditoria. Nunca reverter comissões
ou fatos comerciais anteriores ao lote.

Smoke autenticado no domínio `www.raconsinop.com.br`: Repasse da Franquia,
Vendas e Clientes responderam HTTP 200; os três arquivos apareceram na seção
Relatórios antigos. Nenhum deploy foi necessário para disponibilizar os dados.
