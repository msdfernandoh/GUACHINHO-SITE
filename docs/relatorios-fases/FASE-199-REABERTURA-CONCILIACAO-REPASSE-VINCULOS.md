# Fase 199 — Reabertura da conciliação e conferência dos vínculos do repasse

Data: 01/09/2026

## Problema corrigido

O conciliador do PDF exibia sempre a importação mais recente. Por isso, recebimentos
anteriores que permaneciam pendentes na aba **Recebimentos da Administradora** não
reabriam o respectivo relatório ao acionar **Conciliar**. O card **Vinculados** também
mostrava apenas a quantidade, sem permitir conferência das linhas.

## Entrega

- cada recebimento é relacionado à importação pelo `recebimento_id` já persistido;
- **Conciliar** reabre e posiciona a tela no relatório correto, sem importar novamente
  o PDF e sem criar uma segunda entrada de caixa;
- o conciliador mantém seleção explícita entre os relatórios carregados;
- a área **Relatórios já importados** lista data, competência, arquivo, valor e situação,
  com ação para abrir cada conferência na mesma UI da importação;
- o histórico acompanha os 100 recebimentos exibidos na página, em vez de se limitar aos
  12 PDFs mais recentes;
- depois de uma importação nova ou idempotente, a UI seleciona automaticamente o relatório
  retornado pela operação;
- o card **Vinculados** é acionável e abre a relação das linhas vinculadas;
- a lista apresenta cliente, grupo/cota, parcela, valor do relatório e valor efetivamente
  vinculado no livro `financeiro_recebimento_itens`;
- vínculos ainda sem baixa podem ser alterados pela RPC tenant-aware existente;
- vínculos já baixados exigem primeiro o estorno compensatório do recebimento, evitando
  que uma troca visual duplique a classificação ou reescreva o livro financeiro.

## Preservação e segurança

A alteração é de navegação, leitura e apresentação. O tenant continua resolvido no
servidor e todas as consultas permanecem filtradas por `empresa_id`. Nenhum recebimento,
movimento de caixa, previsão ou histórico foi removido ou recalculado. A alteração de
vínculo continua passando por `rpc_vincular_item_repasse_manual`, que valida permissão,
tenant e unicidade da previsão.

## Validação

- ESLint sem erros nos três componentes alterados;
- TypeScript completo com `--noEmit`;
- teste contratual `repasse-reabertura-vinculos-contract.test.ts`.
