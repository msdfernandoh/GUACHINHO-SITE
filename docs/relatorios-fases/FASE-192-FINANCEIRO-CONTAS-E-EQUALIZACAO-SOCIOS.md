# Fase 192 — Financeiro por conta e equalização dos sócios

## Objetivo

Organizar o fluxo entre os repasses recebidos pela empresa, o pagamento de
comissões, as contas internas dos sócios e as transferências realizadas para
equalizar despesas empresariais pagas pessoalmente.

## Fluxo implantado

1. O relatório importado credita a conta bancária empresarial selecionada.
2. O pagamento agrupado de comissões exige uma conta de saída da empresa.
3. Quando o beneficiário é sócio, o pagamento aparece em seu extrato interno;
   colaboradores continuam aceitos sem conta interna de destino.
4. Despesas empresariais pagas pessoalmente aparecem como crédito interno do
   sócio responsável.
5. Transferências entre sócios podem ser vinculadas à instrução imutável de um
   fechamento e recebem referência de comprovante.
6. Transferências entre contas da própria empresa debitam uma conta e creditam
   outra, sem alterar o caixa consolidado.

## Segurança e preservação

- os novos livros são tenant-aware, append-only e usam `numeric(15,2)`;
- RPCs financeiras exigem `gerenciar_financeiro`, salvo o registro da própria
  transferência por um sócio devedor;
- nenhuma movimentação histórica de caixa é atualizada ou removida;
- repasses existentes com conta bancária são vinculados por backfill idempotente;
- estornos geram lançamentos compensatórios na mesma conta;
- a conta do sócio é um extrato interno e não afirma representar saldo bancário
  pessoal.

## Correção operacional 188

A leitura de `financeiro_estornos` foi liberada exclusivamente por política RLS
tenant-aware para o papel autenticado. Isso permite que a visão
`financeiro_socios_extrato` desconsidere pagamentos estornados sem expor dados de
outras empresas ou liberar escrita na tabela imutável.
