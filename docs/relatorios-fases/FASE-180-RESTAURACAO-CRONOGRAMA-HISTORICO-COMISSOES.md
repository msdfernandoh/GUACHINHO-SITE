# Fase 180 — Restauração exata do cronograma histórico de comissões

Data: 31/08/2026

## Evidência adicional

Após a recomposição das linhas ausentes, a conferência comparativa detectou que
o perfil canônico das quatro vendas havia sido alterado para um programa atual de
4%. Os snapshots assinados preservavam o perfil histórico `Franquia Antiga`, o
percentual da franqueadora de 2% e as datas originais. A tela anterior também
registrava 23 parcelas, R$ 34.240,00 brutos, R$ 5.992,00 de imposto e R$ 28.248,00
líquidos.

## Ajuste realizado

A migration 177:

- cancela a operação se houver qualquer valor elegível ou pago;
- restaura o perfil canônico histórico nas quatro vendas;
- usa exclusivamente as duas regras históricas imutáveis de 2%, com seus
  cronogramas de cinco e seis etapas, sem alterar a configuração ou a vigência;
- exige, antes de concluir, exatamente 23 parcelas e R$ 34.240,00 tanto no
  cronograma da franqueadora quanto no do participante.

O procedimento é transacional: qualquer divergência desfaz todas as alterações.
