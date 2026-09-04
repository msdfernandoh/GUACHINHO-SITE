# Fase 218 - Proposta PDF resumida

Data: 04/09/2026

## Entrega

O formulário de geração de proposta da tela Grupos agora permite escolher a
versão resumida. O PDF usa a identidade visual já adotada no documento e
apresenta somente o mesmo recorte do link público resumido: crédito, parcela
inicial, prazo, grupos selecionados, parcela integral, lances efetivamente
usados, crédito líquido, saldo pós-contemplação e prazo pós-contemplação.

A versão detalhada permanece como padrão e não sofreu alteração de conteúdo.

## Validação

- `npx vitest run src/lib/proposta/pdf/proposta-pdf-document.test.ts` aprovado
  (4 testes).
- `npx tsc --noEmit` aprovado.

