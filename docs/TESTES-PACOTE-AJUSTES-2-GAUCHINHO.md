# Testes — Pacote de Ajustes 2 (Gauchinho)

## Financiamento por tipo

- Config salva em `configuracoes_sistema.chave = financiamento_config` como JSON `{ imovel, veiculo }`.
- Normalização legado: `src/lib/config/financiamento-por-tipo.ts` (`normalizeFinanciamentoStored`).
- Admin: aba Financiamento em `/admin/configuracoes` (formulário duplo Imóvel / Veículo).
- Runtime: `resolveFinanciamentoCfg(configs, tipoBem)` em `simulador-shared.ts`.

### Testar

1. Configurar prazos/taxas distintos para imóvel e veículo no admin.
2. `/simulador` → Financiamento → alternar Imóvel/Veículo e conferir prazos.
3. Home → simulador rápido → toggle Imóvel/Veículo → prazos de financiamento corretos.

## Comparativo financiamento × consórcio

- `detalharAlternativaConsorcio` em `comparativo.ts`.
- UI em `comparison-section.tsx` (parcela cheia/reduzida, saldo, lance, crédito líquido).
- Mesmo crédito (`valorBem`) e prazo (`prazoFin`) do financiamento.

## Menu público

- Ordem desktop: Início, Simulador, Grupos, Contempladas, Imóveis, Seguradoras, Mais (Calculadoras, Dicas), Especialista, Login.
- Mobile: mesma ordem + Especialista; menu abaixo do header (`top-14`).

## Dicas do Tchê

- Categorias de cadastro: `DICA_CATEGORIAS` em `lib/conteudo/types.ts` (sem Imóvel/Veículo).
- Conteúdos legados com categorias antigas continuam visíveis em “Todas”.

## Rodapé parceiros

- `PublicFooter` + `loadFooterPartners` (parceiros institucionais, imobiliárias ativas, seguradoras publicadas).
- Seção oculta quando lista vazia.

## Calculadora juros real

- Lib: `src/lib/calculadoras/juros-real.ts`
- UI: `juros-real-calculator.tsx` em `/calculadoras`
- Lead: `origem = calculadora_financeira`, `tipo_interesse = juros_real`
- Testes: `juros-real.test.ts`

## Mascote

- Componente: `MascoteGauchinho` (`/foto/ICONE.svg`)
- Simulador header, `ConteudoPageShell` (páginas de conteúdo, indicar, seguradoras, etc.)

## IA comercial

- Extração: `extrair-lead.ts` (tipo crédito público + valor obrigatórios para lead).
- Persistência: `tipo_credito`, `valor_credito` na tabela `leads`.
- Prompt: `system-prompt.ts` (fluxo tipo → valor → nome → WhatsApp).

## Calculadora de aplicação com comparativo de consórcio

- Lib: `aplicacao.ts` (aporte com reajuste anual), `aplicacao-consorcio-comparativo.ts`, `estimar-credito-por-parcela.ts`.
- CDI: taxa anual dos índices → mensal equivalente composta (`taxaAnualParaMensalPercentual`); exibição de CDI a.a. e equivalente a.m. na UI.
- Comparativo: parcela reduzida 60% (padrão simulador), crédito estimado por busca binária, crédito reajustado no prazo da aplicação, diferença patrimonial.
- Lead: `tipo_calculadora = aplicacao_comparativo_consorcio` em `dados_simulacao` (captura API).
- Aviso de estimativa obrigatório na tela (sem garantias).

### Testar manualmente

1. `/calculadoras` → Aplicação mensal → aporte R$ 500, prazo 120, CDI → conferir taxa a.a. e a.m.
2. Ativar comparativo consórcio → crédito estimado e crédito reajustado 6% a.a.
3. Aumento anual do aporte 6% → total investido maior que aporte fixo.
4. Gerar lead e conferir JSON em `dados_simulacao`.

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```
