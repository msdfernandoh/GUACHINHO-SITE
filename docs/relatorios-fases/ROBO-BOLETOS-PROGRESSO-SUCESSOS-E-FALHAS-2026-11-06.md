# Robô de boletos — progresso, sucessos e falhas — 06/11/2026

## Diagnóstico

A execução `9125a8b3-e8d3-46ca-b8f6-be5c06dd230f` processou e gravou 16 boletos
antes de atingir o limite global de 10 minutos. O histórico do banco confirmou os
16 registros em `vendas_boletos_envios` e no Storage, mas a execução foi encerrada
como erro sem um resumo final para a interface. A falha observada em uma cota foi
timeout ao abrir Emissão de Cobrança; o robô continuou processando as cotas seguintes
até o timeout global.

## Correções

- A execução de boletos passa a retornar sucesso parcial com listas de sucessos e
  falhas por grupo/cota, preservando os boletos já armazenados.
- O terminal interpreta os logs durante a execução e exibe progresso, sucessos,
  falhas, início, fim e duração.
- O terminal usa fundo claro e texto escuro para leitura adequada.
- A interface oferece nova tentativa somente das cotas que falharam.
- O limite do worker para rotinas comuns foi ampliado para 45 minutos, evitando
  interromper filas legítimas antes do término.
- A execução pode receber uma lista temporária de cotas-alvo, sem alterar a fila
  permanente do robô.

## Validação

- `npx tsc --noEmit` aprovado.
- `npm run build` aprovado.
- Nenhuma migração de banco foi necessária.
