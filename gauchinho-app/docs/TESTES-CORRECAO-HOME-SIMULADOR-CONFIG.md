# Correção — simulador rápido da Home e configuração oficial

## Causa do R$ 0,00

1. **Taxa mensal zerada no admin** — `saveFinanciamentoConfigAction` usava `numField(..., fallback 0)`. Se o campo vinha vazio ou inválido, a taxa era salva como **0** e o Price retornava parcela **0**.
2. **Formatação manual na Home V2** — `toFixed(2)` + regex de milhar podia distorcer valores pequenos; com parcela 0 exibia **R$ 0,00/mês** como se fosse resultado válido.
3. **Prazo livre (24–220)** — a Home não usava a lista de prazos do admin/simulador, gerando divergência com `/simulador`.

## Fonte oficial

- `getSimuladorConfigsPublic()` em `src/server/config.ts` (chaves `simulador_imovel`, `simulador_automovel`, `financiamento_config`).
- Cálculos: `calcularParcelaConsorcio`, `simularFinanciamento`.
- Helpers centralizados: `src/lib/simulador/config.ts`, `preview-home.ts`, `prazos.ts`, `financiamento-entrada.ts`.

## Arquivos alterados

- `src/app/(public)/home-v2-client.tsx` — UI do simulador rápido
- `src/lib/simulador/preview-home.ts` — `computeQuickSimulatorResult`
- `src/lib/simulador/config.ts` — exports + `getQuickSimDefaults`
- `src/lib/simulador/prazos.ts` — prazos compartilhados
- `src/lib/simulador/financiamento-entrada.ts` — entrada e validação de taxa
- `src/components/simulador/simulador-app.tsx` — mesma lista de prazos de financiamento
- `src/app/admin/configuracoes/simulador-forms.tsx` — labels e prazos de financiamento
- `src/app/admin/configuracoes/actions.ts` — salvar prazos + fallback taxa 1% se campo vazio
- `src/lib/config/defaults.ts` — `prazosDisponiveis` em financiamento
- Testes: `config.test.ts`, `preview-home.test.ts`

## Como testar

1. Admin → Configurações → Financiamento: preencher **Taxa mensal**, **Prazos disponíveis** (ex.: `60, 120, 220, 360, 420`), salvar.
2. Abrir `/` → aba Financiamento → parcela > 0.
3. Clicar **Ver simulação completa** → URL com `solucao`, `valor`, `prazo`, `origem`.
4. Confirmar parcela coerente em `/simulador`.
5. Repetir para Consórcio (prazos do imóvel + opção de parcela padrão do admin).

## Taxa ausente

Se `taxaMensalPadrao <= 0`, a Home exibe:

> Configure as taxas de financiamento no admin para exibir a simulação.

Não exibe R$ 0,00 como resultado válido.

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```
