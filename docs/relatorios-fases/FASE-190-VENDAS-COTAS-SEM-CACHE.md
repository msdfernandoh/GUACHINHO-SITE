# Fase 190 — Cotas atuais na tela de vendas

## Incidente

O banco principal possuía sete cotas definitivas e duas cotas ativas para a
venda do cliente Janser. A tela publicada exibia um retrato anterior com seis
cotas e somente uma linha do cliente, enquanto o módulo de comissões já lia os
dois cronogramas.

## Correção

- o cliente Supabase administrativo passou a aceitar consultas explicitamente
  sem cache;
- a página de Vendas utiliza essa opção em todas as leituras;
- a rota modular `/erp/[modulo]` foi marcada como dinâmica e com revalidação
  zero;
- a individualização por `cotas_definitivas` permanece uma linha por cota.

## Evidência no banco

- cota 1: `8b52fe60-a525-4c3e-8f1c-c999146d05f3`;
- cota 2: `c74baa93-1adf-43db-b139-af63e8a56d8b`;
- ambas ativas, com crédito individual de R$ 127.200,00 e parcela de R$ 484,63;
- 10 etapas de comissão da franquia vinculadas a cada cota.
