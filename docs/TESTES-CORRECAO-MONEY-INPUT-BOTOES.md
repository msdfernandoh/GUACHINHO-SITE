# Testes — MoneyInput e botões públicos

## Botões

- **Primário (`gold`):** fundo âmbar, texto escuro.
- **Secundário público (`outlineGold`):** fundo escuro, borda âmbar, texto âmbar claro; hover âmbar sólido + texto preto.
- **Secundário admin (`outline`):** fundo claro/escuro conforme tema admin.

Correção principal: `/indicar` — botão **+ Adicionar outra indicação** (antes `outline` + `text-amber-200` sobre `bg-white`).

## Campo monetário

- Lib: `src/lib/formatters/money.ts` — `formatBRL`, `parseBRLMoney`, `maskBRLMoneyInput`.
- Componente: `src/components/ui/money-input.tsx`.
- Regra de digitação: centavos acumulados (`100000` → `R$ 1.000,00`).
- Persistência: número em reais (ex.: `1000000`), não string formatada.

## Onde aplicado (prioridade)

- `/indicar` — valor do crédito
- Modal Especialista — valor do crédito
- Assistente IA — fallback valor
- `/calculadoras` — aplicação, financiamento, valor futuro, juros real, correção aluguel
- `/simulador` — `CurrencyInput` (mesma máscara)

## Testes automatizados

```bash
cd gauchinho-app
npm test -- src/lib/formatters/money.test.ts
```

## Manual

1. `/indicar` → digitar `1000000` no crédito → `R$ 1.000.000,00` → enviar → lead com `valor_credito = 1000000`.
2. Conferir botão adicionar indicação legível e hover.
