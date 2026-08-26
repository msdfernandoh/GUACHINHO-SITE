# Fase 129 — Contas Recorrentes, Duplicação e Visão Futura

Data de implementação local: 26/08/2026  
Migration: `129_financeiro_contas_recorrentes_duplicacao.sql`  
Estado: implementada e validada localmente; aplicação no Supabase Production pendente.

## Objetivo

Permitir o lançamento seguro de despesas fixas por vários meses, duplicar uma despesa existente para competências futuras e consultar compromissos já lançados sem perder rastreabilidade.

## Modelo de dados

Foi criada `financeiro_contas_pagar_series`, sempre vinculada à empresa e com UUID próprio. A série registra:

- tipo `AVULSA`, `RECORRENTE` ou `DUPLICACAO`;
- primeiro vencimento;
- total de ocorrências;
- conta de origem, quando houver;
- chave de idempotência;
- usuário responsável.

Cada ocorrência continua sendo uma linha independente de `financeiro_contas_pagar` e recebe:

- `serie_recorrencia_id`;
- `recorrencia_indice`;
- `recorrencia_total`.

Uma constraint única impede duas ocorrências com o mesmo índice na mesma série e empresa.

## Operações transacionais

### Nova conta fixa

`rpc_criar_contas_pagar_recorrentes` cria a série e todas as competências dentro da mesma transação. A quantidade aceita é de 1 a 120 meses. Centro de custo, banco, fornecedor e sócio são validados contra a empresa ativa.

### Duplicação

`rpc_duplicar_conta_pagar_meses` recebe uma conta da empresa e cria de 1 a 120 contas futuras. A conta original permanece inalterada.

Por segurança, a duplicação não copia:

- comprovante/nota fiscal;
- status pago;
- data de pagamento;
- movimento de caixa.

### Idempotência

As duas operações usam chave única por empresa. Repetir a mesma requisição devolve a série já criada e não duplica despesas.

## Interface

- checkbox `Repetir mensalmente como conta fixa`;
- padrão inicial de 6 meses, ajustável até 120;
- explicação de que cada competência é independente;
- botão `Duplicar` em cada despesa;
- modal com quantidade, origem, valor e aviso de que o comprovante não será copiado;
- badge `Série X/Y` na listagem;
- barra acima dos cards com atalhos:
  - mês atual;
  - próximo mês;
  - próximos 3 meses;
  - próximos 6 meses;
  - próximos 12 meses.

## Compatibilidade de implantação

Enquanto a migration 129 não estiver aplicada, contas avulsas continuam usando o fluxo compatível anterior. Operações recorrentes e duplicações retornam uma mensagem explícita solicitando a migration, sem executar inserts parciais.

## Validação

- build Next.js e TypeScript: aprovado;
- geração das 146 páginas: aprovada;
- 6 testes contratuais específicos: aprovados;
- suíte completa deverá ser executada antes do commit/promoção desta fase.

## Próximas subfases

- paginação e agregação integral no servidor;
- fechamento imutável e conta corrente dos sócios;
- saldo bancário conciliado e projeção de caixa.
