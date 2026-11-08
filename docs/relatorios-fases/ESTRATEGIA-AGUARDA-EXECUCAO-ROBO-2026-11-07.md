# Estratégia de lance aguarda execução do robô — 07/11/2026

## Problema

Ao salvar uma estratégia, a tela preenchia automaticamente a data do lance e a validade em cinco meses. Isso fazia uma cota aparecer como válida/ativa mesmo sem o robô ter acessado o Newcon ou enviado qualquer oferta.

## Correção

- A estratégia continua ativa para ser localizada pelo robô.
- `data_lance` e `data_vencimento` ficam nulos enquanto não houver protocolo, horário de oferta ou confirmação auditável.
- A tela exibe `Aguardando robô` para uma estratégia configurada, e `Executado` somente após evidência da oferta.
- A validade só é exibida depois da execução efetiva.
- Foram limpas 5 datas pré-preenchidas sem evidência de execução, sem desativar as estratégias.

## Verificação

TypeScript (`tsc --noEmit`) passou sem erros. A migration foi aplicada no Supabase.
Consulta pós-correção: 39 estratégias totais, 34 com datas respaldadas por
execução, 0 datas sem execução e 39 estratégias prontas para o robô. Protocolos,
comprovantes e estratégias já executadas não foram alterados.
