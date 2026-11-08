# Relatório — Cancelamento e identificação dos robôs

## Objetivo

Permitir que o operador pare uma execução em andamento e eliminar a
ambiguidade visual entre o robô de lances e o robô de contemplações.

## Implementação

- Criado `DELETE /api/automacoes/robos/[id]/executar?execucaoId=...` para
  cancelar somente a execução pertencente ao robô informado e que ainda esteja
  `PENDENTE` ou `PROCESSANDO`.
- Incluído o botão `Parar robô` no terminal, com confirmação, estado de
  processamento e atualização imediata para `CANCELADO`.
- O daemon consulta o status da execução periodicamente e encerra o processo
  filho quando o operador cancela.
- O processo filho e o robô de lances verificam o cancelamento antes das
  próximas etapas/cotas e preservam o status `CANCELADO` no encerramento.
- A classificação do terminal agora reconhece “Contemplações e Médias de
  Lance” como contemplação antes de procurar a palavra “lance”.

## Validação

- `node --check scripts/robo-execucao-child.mjs`
- `node --check scripts/robo-worker-daemon.mjs`
- `node --check scripts/robo-lances-service.mjs`
- `git diff --check`
- Execução em andamento `52483945-7ad8-4b92-9b1c-4c06acb9b490` cancelada no
  Supabase e confirmada com status `CANCELADO`.

## Resultado esperado

Ao fechar e reabrir o terminal, a execução permanece acompanhável. Ao clicar
em `Parar robô`, nenhuma nova cota é iniciada e o histórico registra o
cancelamento sem transformá-lo em sucesso ou erro.
