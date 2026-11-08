# Correção da contagem do terminal de robôs — 08/11/2026

## Problema

O terminal de execução mostrava `0/N` durante robôs de contemplação e de
lances mesmo quando os logs já indicavam grupos ou cotas em processamento.
O resumo da interface reconhecia apenas o formato de sucesso do robô de
boletos e não persistia o resultado específico do robô de lances.

## Correção

- A contagem agora interpreta o fluxo selecionado: grupo para contemplação,
  cota para lances e cota para boletos.
- Sucessos e falhas são derivados dos eventos reais do log, com deduplicação
  por grupo/cota.
- O total é obtido do progresso corrente e, ao finalizar lances, também fica
  registrado em `resultado.lances` com cotas elegíveis e processadas.
- O progresso continua atualizando durante a execução e permanece disponível
  para reabrir o terminal depois de fechar a janela.

## Validação

- ESLint direcionado do componente do terminal: aprovado.
- Nenhuma migration ou dado operacional foi alterado nesta fase.
