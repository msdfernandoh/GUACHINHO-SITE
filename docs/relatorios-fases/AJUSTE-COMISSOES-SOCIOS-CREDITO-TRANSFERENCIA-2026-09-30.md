# Relatório de Implementação — Crédito de Comissões de Sócios e Transferência de Retirada

**Data:** 30/09/2026  
**Módulo:** ERP / Minhas Comissões & Financeiro Societário  
**Status:** Concluído com Sucesso e Testado  

---

## 1. Contexto e Diagnóstico

Na rotina operacional da empresa, os sócios geram comissões de vendas, porém esse dinheiro **permanece na conta bancária da empresa** para honrar despesas operacionais correntes (aluguel, sistemas, marketing, contas de consumo, equipe).

### Diagnóstico do Funcionamento Anterior:
* Na tela de `Minhas Comissões` (`/erp/minhas-comissoes`), o formulário de pagamento agrupado exigia obrigatoriamente a seleção de uma conta bancária de saída (`conta_origem_id`) e acionava `rpc_registrar_pagamento_bancario`.
* Isso lançava prematuramente uma movimentação de `SAIDA` (`financeiro_conta_movimentos`) na conta da empresa no ERP, reduzindo o saldo bancário do sistema antes de qualquer Pix/TED pessoal ter sido realizado.
* Além disso, o sócio não conseguia declarar ou conferir seu crédito de forma direta sem antes passar pelo fluxo de saída bancária.
* Posteriormente, no fechamento periódico dos sócios (`/erp/fechamento-socios`), ao registrar a **Retirada de Sócio** real, ocorria o risco de debitar o caixa em duplicidade.

---

## 2. Ajuste Implementado

Alinhamos o sistema com a regra de negócio exata solicitada: **ao marcar conferido/pago, gera-se o crédito do sócio no ERP mantendo o dinheiro no caixa da empresa até a transferência de retirada, deixando saldo para pagamento de despesas.**

### Modificações Técnicas:

1. **Detecção Societária Automática no Server Component:**
   * Arquivo: `src/app/erp/minhas-comissoes/page.tsx`
   * Consulta a tabela `empresa_socios` para verificar se o participante selecionado é sócio ativo da empresa (`ehSocio`).
   * Inclui `usuario_id` na projeção dos participantes comerciais e repassa a flag `ehSocio` para o componente cliente.

2. **Ações de Servidor Resilientes:**
   * Arquivo: `src/app/erp/minhas-comissoes/actions.ts`
   * **`pagarComissoesAgrupadasAction`:**
     * Suporta a opção `manter_empresa` (padrão para sócios).
     * Quando mantido na empresa, não debita conta bancária (não envia `contaBancariaOrigemId`), invocando o registro contábil de pagamento que gera o crédito do sócio e preserva 100% do saldo bancário da empresa no ERP.
     * Marca automaticamente os itens como `conferido_por_participante = true` pelo usuário autenticado.
   * **`creditarEConferirComissaoAction`:**
     * Nova Server Action para permitir que o sócio ou gestor credite e confira uma comissão elegível diretamente da linha da tabela, gerando o crédito sem saída bancária.

3. **Interface Intuitiva com Diferenciação de Sócio:**
   * Arquivo: `src/components/erp/comissoes/minhas-comissoes-client.tsx`
   * Quando o participante for um sócio:
     * O bloco de liquidação agrupa com o título **"Creditar comissões do sócio no caixa da empresa"**.
     * O seletor traz por padrão: **"Manter no caixa da empresa (Crédito do sócio para cobrir despesas)"**.
     * Exibe aviso orientativo explicando que o valor fica na empresa para pagar despesas e que a saída bancária só ocorrerá na transferência de retirada.
     * Na tabela de parcelas, caso o item seja elegível para o sócio, exibe o botão direto **"Creditar e conferir"**.

---

## 3. Verificação e Testes

* Novo teste automatizado:
  * `src/lib/erp/minhas-comissoes-socio-credito-transferencia.test.ts` (3 testes aprovados).
* Testes de regressão:
  * `src/lib/erp/minhas-comissoes-equipe-contract.test.ts` (aprovado).
  * `src/lib/erp/minhas-comissoes-vendas.test.ts` (aprovado).
  * `src/lib/erp/minhas-comissoes-vendas-server.test.ts` (aprovado).
  * `src/lib/gestao/fechamento-socios.test.ts` (aprovado).
* Verificação TypeScript estrita:
  * `pnpm exec tsc --noEmit` executado com zero erros de tipagem.
