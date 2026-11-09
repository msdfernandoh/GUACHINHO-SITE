# Busca individual de boleto por login

Em produção, a busca da cota 0209 do grupo 1273 acionou o robô Eroni,
apesar da configuração Racon / Fernando. O filtro descartou a cota e
a execução terminou com zero PDFs armazenados.

A tela seleciona o robô ativo do login da cota na carteira atendida.
Caso a API retorne outra execução em andamento, a tela informa que o
robô está ocupado em vez de confirmar uma busca que não entrou na fila.

Correção local, sem migração. Publicação e nova execução no Newcon pendentes.
