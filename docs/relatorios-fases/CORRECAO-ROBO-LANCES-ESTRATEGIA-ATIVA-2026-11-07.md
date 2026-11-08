# Relatório — Correção do robô de lances

Data: 07/11/2026  
Fase: Execução automatizada de lances

## Diagnóstico

O terminal registrou acesso bem-sucedido ao Newcon, mas todas as cotas foram
descartadas como `SEM ESTRATÉGIA`. O filtro do serviço exigia
`estrategia.confirmado === true`. Esse campo só é preenchido depois que uma
oferta é efetivamente registrada ou confirmada; portanto, a exigência impedia
o primeiro envio de qualquer lance configurado.

## Correção

O robô agora processa uma cota quando há estratégia `ativa` e pelo menos uma
modalidade habilitada (`lance_livre_ativo`, `lance_fixo_ativo` ou
`segundo_lance_fixo_ativo`). A confirmação continua sendo usada para auditoria
e para o bloqueio de repetição das assembleias, sem bloquear a primeira oferta.

## Validação

- Sintaxe do serviço validada com `node --check scripts/robo-lances-service.mjs`.
- TypeScript do aplicativo validado com `npm exec tsc -- --noEmit`.
- O terminal precisa ser executado novamente para confirmar as ofertas no
  ambiente Newcon; a execução anterior terminou sem processar cotas porque o
  filtro antigo descartou todas.
