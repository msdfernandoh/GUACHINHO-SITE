# Fase 216 - Proposta PDF: cenários de lance

Data: 04/09/2026

## Objetivo

Alinhar a proposta em PDF emitida pela tela pública de Grupos com os valores
comerciais exibidos na simulação selecionada e apresentar, sem repetir taxas,
uma alternativa rápida sem lance embutido.

## Alterações

- O quadro **Composição financeira** passa a mostrar o **Saldo pós-lance** e a
  **Parcela pós-contemplação** da seleção gravada na proposta.
- Quando há lance na seleção, o PDF inclui uma faixa inferior **Simulação rápida
  - contemplação sem lance embutido**. Ela apresenta lance zero, crédito líquido
  integral, saldo pós-lance, parcela pós-contemplação e prazo aproximado.
- A alternativa é calculada a partir do mesmo grupo, prazo, cota e primeira
  parcela do snapshot. Não persiste dados, não modifica a simulação original e
  não altera taxas, catálogo, tenancy ou regras de lance.

## Validação

- `npx vitest run src/lib/proposta/pdf/proposta-pdf-document.test.ts` aprovado
  (3 testes).
- `npx tsc --noEmit` aprovado.

