# Robôs: última execução e programação individual — 27/10/2026

## Pedido e entrega

A Central SaaS mostra em cada card a última execução com data completa e hora,
a programação automática e a próxima ocorrência prevista, no fuso America/Cuiaba.
A data é lida dos registros reais já existentes, sem fabricar datas ou exigir nova
execução. Configurações sem histórico exibem “Nenhuma execução registrada”.

O formulário oferece execução manual, diária, semanal ou mensal. Cada linha tem
horário próprio e, conforme a frequência, dia da semana ou dia do mês. É possível
adicionar e remover linhas, incluindo duas ocorrências mensais. Dias 29–31 são
executados somente nos meses em que existem, conforme orientação na tela.

## Implementação

- Programação em `robo_configuracoes.configuracao_tarefas.agendamento`, com
  `frequencia`, `horarios` e `definido_em`. Sem migration ou backfill.
- Validação compartilhada no formulário e serviço de gravação: frequência,
  dias, horários, duplicatas e timestamp. Tarefas operacionais preservadas.
- Histórico consultado com limite individual por robô, eliminando o limite global
  de 50 que podia ocultar robôs menos movimentados. Falhas de leitura são explícitas.
- Dia corrente apurado em Cuiabá, em vez de comparar com o dia UTC.
- O daemon usa o mesmo módulo de calendário da interface. Consulta paginada da fila,
  lease existente e índice único `idx_robo_exec_agendamento_unico` preservados.
- Um trabalho por ocorrência, sem repetição automática após erro; execução manual
  continua disponível. Pendentes/processando impedem sobreposição do mesmo robô.
- Agenda explícita recupera horários vencidos no próprio dia, sem acumular dias
  anteriores. Nova programação não dispara ocorrências anteriores à sua definição.
- Robôs sem agenda explícita preservam as janelas legadas 04h/20h, incluindo a
  janela da noite anterior antes das 04h e reconhecimento das chaves antigas.
- Nenhuma alteração em credenciais, vínculos N:N, RLS, identidade ou dados
  comerciais/financeiros. Nenhuma execução de robô disparada nesta implementação.

## Validação

Nove testes em `scripts/tests/robo-agendamento.test.mjs`: calendário diário,
virada UTC/Cuiabá, semana, duas ocorrências mensais, meses curtos/ano bissexto,
manual/inativo, entradas inválidas, deduplicação/fila, definição sem retroatividade
e compatibilidade das janelas antigas. Todos aprovados na primeira rodada.

Compilação TypeScript e build Next.js de produção aprovados. Lint direcionado:
zero erros, 18 avisos preexistentes nos arquivos antigos (nenhum aviso nos novos
componentes/módulo). `node --check scripts/robo-worker-daemon.mjs` e
`git diff --check` aprovados. Não houve teste autenticado nem homologação visual
em produção nesta fase.

## Implantação

Envio à `main` autorizado expressamente pelo titular em 27/10/2026, após as
validações locais. Publicação do frontend e reinício/atualização do daemon são
necessários para disponibilizar a entrega em produção. O daemon precisa permanecer
ativo para executar horários configurados. Deploy e homologação de produção não
confirmados nesta fase. Não houve escrita remota de dados; os testes de agenda não
acionam portais ou ofertas de lances.
