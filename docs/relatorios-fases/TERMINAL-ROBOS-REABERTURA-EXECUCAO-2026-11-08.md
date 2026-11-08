# Relatório — reabertura e acompanhamento de execução dos robôs

## Problema

Ao fechar o terminal, a execução continuava no servidor, mas o card não oferecia
uma forma clara de acompanhar o trabalho nem de reabrir os números já
processados. Isso podia levar o operador a clicar novamente em `Executar Agora`.

## Correção

- Execuções `PENDENTE` e `PROCESSANDO` são detectadas ao carregar a Central de
  Robôs.
- O terminal é reaberto automaticamente com a execução encontrada e o polling
  continua até o encerramento.
- Cards em execução mostram o status e o botão `Visualizar execução`.
- O botão abre a execução existente sem criar outra execução.
- O histórico também usa a mesma visualização, inclusive para execuções
  concluídas.
- O terminal mantém o nome/tipo do robô no topo e os indicadores de progresso,
  sucessos, falhas, início, fim e duração.

## Validação

TypeScript validado com `npm exec tsc -- --noEmit` no projeto `gauchinho-app`.
