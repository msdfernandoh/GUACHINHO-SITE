# Diagnóstico em produção da transferência — 20/10/2026

## Implantação confirmada
`vercel inspect` e os logs do build confirmam a versão de produção READY do commit `27d581e`, deploy `dpl_CQtJwou5cHJcMj3J63qJXR9CLzoB`, com aliases `raconsinop.com.br` e `www.raconsinop.com.br`. Build concluído em 21/10/2026 03:54:29 UTC (20/10 23:54:29 America/Cuiaba).

## Causa específica da tentativa
Log de produção às 23:50:17 de 20/10, POST `/erp/fechamento-socios`, digest `1205604008`: bloqueio de conciliação de 98 contas pagas pela empresa, total R$ 64.272,53, sem saída de caixa vinculada. Esse erro antecedeu o deploy da correção das mensagens.

O erro não ocorreu por conta pessoal de destino ausente: cada sócio tem uma conta financeira ativa vinculada ao participante e usuário da mesma empresa.

## Conferência somente leitura
- Conta Gauchinho Empresa: saldo no sistema R$ 97.826,52.
- 98 contas pagas sem saída vinculada: R$ 64.272,53.
- Saldo estimado após descontar essas despesas: R$ 33.553,99, sujeito ao extrato e a outras conciliações; não constitui confirmação de saldo bancário real.
- Treze das 98 contas não têm conta bancária cadastrada.
- Nenhuma das 98 tem movimento de caixa encontrado por `origem_tipo = conta_pagar` e `origem_id = conta.id`; nenhuma saída bancária foi encontrada por essa origem exata. Isso não descarta saídas genéricas sem referência.
- Nenhum registro com chave `retirada-socio:%` em financeiro_transferencias_contas.

| Mês do pagamento | Contas | Total |
| --- | ---: | ---: |
| Março/2026 | 1 | R$ 80,00 |
| Junho/2026 | 7 | R$ 2.737,91 |
| Julho/2026 | 1 | R$ 360,00 |
| Agosto/2026 | 40 | R$ 23.743,68 |
| Setembro/2026 | 49 | R$ 37.350,94 |

Lista individual produzida localmente em `tmp/CONTAS-PAGAS-SEM-SAIDA-2026-10-20.md`, sem publicar os detalhes financeiros individuais no Git. Leituras em lotes de 500, com tenant explícito.

## Próximo passo e limites
Conferir as contas contra o extrato da conta pagadora, identificar movimentos genéricos já existentes e informar o banco das treze sem cadastro. Só então vincular ou registrar saídas pelo fluxo auditado. A ausência de vínculo por si só não autoriza deduzir todo o lote automaticamente.

Nenhuma movimentação ou transferência foi executada. A implantação foi confirmada por metadados/build; não houve teste autenticado de efetivação em produção, que criaria uma transação real. Nenhuma alteração de código nesta fase; checks da versão 27d581e já concluídos na fase anterior.
