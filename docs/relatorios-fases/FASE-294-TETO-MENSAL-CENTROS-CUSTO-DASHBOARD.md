# Fase 294 — Teto mensal de despesas por centro de custo

Data: 28/09/2026. Estado: estrutura SQL e tetos iniciais aplicados no banco; aplicação alterada localmente, ainda sem implantação.

## Regra

- Cada centro de custo pode ter um `limite_mensal` positivo; vazio significa sem teto.
- O painel principal compara o teto com a soma das contas **pagas** no mês corrente pela data `pago_em`, vinculadas ao centro. Contas abertas, canceladas, excluídas, de outros meses e guias com `retirar_reserva_impostos` não entram. O pagador ou a conta bancária não alteram a natureza da despesa da empresa.
- Até menos de 80%: **Dentro do teto**. De 80% até 100%: **Perto do teto**. Acima de 100%: **Passou do teto**. O painel mostra valor pago, teto e sobra ou excesso por centro; os dois últimos estados também aparecem em Atenção Necessária.
- O teto é informativo. Ele não impede pagamento; a decisão de bloquear despesas acima do teto não foi solicitada.

## Implementação

- Migration `supabase/migrations/294_limite_mensal_centros_custo.sql`: coluna opcional com validação no banco.
- Cadastro e edição em `Contas a pagar → Centros de custo`, com valor em reais e centavos, validado no servidor.
- Cálculo mensal isolado em `gauchinho-app/src/lib/gestao/tetos-centros-custo.ts`; consultas do painel filtradas por `empresa_id` e mês do pagamento.
- Quadro no dashboard principal e alertas por centro. O painel também passou a consultar `vencimento`/`aberta` nos alertas de contas vencidas, conforme o esquema real.
- Cards na Central dos Sócios para **todos os meses desde a primeira despesa operacional paga até o mês atual**, incluindo meses sem pagamentos. Cada mês detalha os tipos por centro de custo, o total pago e o excesso por tipo. Contas sem centro aparecem em linha própria. Os tetos atuais são usados na comparação histórica e a tela informa essa condição.
- Complemento do painel de acerto: resumo dos meses e do tipo de maior gasto, expansão de cada mês para ver cada conta paga com data, descrição e valor, além de link direto para editar o teto do centro escolhido.
- Alterações de teto, baixa e estorno revalidam o painel.

## Aplicação no banco e valores iniciais

Com autorização explícita do titular, o SQL da migration 294 foi executado diretamente no banco remoto, seguido de `NOTIFY pgrst, 'reload schema'`. Após conferir os objetos das fases 294–297, a versão 294 foi registrada como aplicada no histórico remoto do Supabase CLI. As versões 289–293 continuam pendentes e não foram executadas nesta entrega. O cadastro dos tetos foi feito em uma transação com validação de cinco centros ativos, tetos ainda vazios e quatro linhas atualizadas.

A média considera somente **meses com ao menos uma conta operacional efetivamente paga** no respectivo centro, até 28/09/2026. Não entram contas abertas, excluídas nem guias que consomem a reserva fiscal. O mês de setembro entra com os pagamentos registrados até a data de corte. Valores confirmados por consulta SQL e pela API após o recarregamento do esquema:

| Centro | Meses com pagamento | Total pago | Teto inicial editável |
|---|---:|---:|---:|
| Administrativo | 4 | R$ 43.685,31 | R$ 10.921,33 |
| Eventos | 3 | R$ 18.326,85 | R$ 6.108,95 |
| Investimento | 2 | R$ 7.739,49 | R$ 3.869,75 |
| Salário | 2 | R$ 4.450,00 | R$ 2.225,00 |
| Impostos Descontados na Comissão | — | — | Sem teto |

O histórico disponível contém uma conta paga em março, meses sem pagamento em abril e maio, e contas de junho a setembro. Valores sem centro de custo são exibidos nos cards, mas não possuem teto até receberem classificação. O titular pode alterar todos os tetos no cadastro de centros de custo.

Com os tetos atuais, os pagamentos de setembro até 28/09 excedem Administrativo em **R$ 13.954,09**, Eventos em **R$ 3.670,14** e Salário em **R$ 1.775,00**. São alertas de comparação de despesas efetivamente pagas com a média, não prova de pagamento indevido. Agosto também ultrapassa os tetos atuais em Administrativo, Eventos e Investimento; a tela mostra cada valor por mês e tipo.

## Verificação

- `npx tsc --noEmit --pretty false`: aprovado.
- 10 testes direcionados: aprovados. O teste do teto cobre contas abertas, outro mês, guias fiscais, exclusões e ultrapassagem; o histórico mensal testa tipos, data de pagamento e contas sem centro.
- ESLint dos arquivos afetados (`--quiet`): aprovado.
- `npm run build`: aprovado, inclusive compilação e geração de rotas.
- Após a inclusão dos cards mensais, TypeScript, testes direcionados e build foram executados novamente e aprovados.

## Implantação

`supabase migration list --linked` mostrou 289–293 ainda pendentes na produção. A estrutura da 294 já está presente por SQL direto, com os quatro tetos cadastrados e conferidos. Após revisar/aplicar a sequência pendente, processar 294 pelo histórico de migrations e implantar a aplicação. Até a implantação, os novos cards e campos de edição não aparecem na tela de produção.

A primeira tentativa de preview iniciada no subdiretório foi rejeitada pela configuração de Root Directory; outra, iniciada na raiz, expôs uma regra de exclusão excessiva de arquivos da aplicação e falhou na compilação remota. A regra `.vercelignore` foi corrigida para excluir documentos, SQL, credenciais e arquivos temporários da raiz sem excluir a pasta interna `src/lib/supabase` da aplicação. A terceira tentativa compilou e concluiu com êxito: [preview Vercel](https://guachinho-site-j55v6k6n6-hugo-8097s-projects.vercel.app). O preview não substitui o domínio de produção. A implantação em produção segue pendente de revisão do preview e da sequência de migrations 289–293.
