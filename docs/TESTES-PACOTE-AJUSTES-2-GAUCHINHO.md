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

- Ordem desktop: Início, Simulador, **Calculadoras**, Grupos, Contempladas, Imóveis, Seguradoras, **Mais** (Dicas, Indicar cliente, FAQ, Parceiros), Especialista, Login.
- Calculadoras **não** fica dentro de Mais no desktop.
- Mobile: links principais + Mais + Login; menu abaixo do header (`top-14`).

## Correção layout Home / Menu / Parceiros / Mascote

### Parceiros sem duplicidade

- **Causa:** vitrine de logos em `PublicFooter` (via `loadFooterPartners`) **e** `HomeV2ParceirosStrip` na Home.
- **Correção:** rodapé só links (Parceiros, Indicar, FAQ) + copyright; logos apenas no módulo **Parceiros** da Home (`home-v2-parceiros-strip.tsx`).

### Módulos configuráveis da Home

- Chave: `configuracoes_sistema.home_modulos_config` (JSON `{ modulos: [{ id, nome, ativo, ordem }] }`).
- Admin: `/admin/configuracoes` → aba **Home** (`HomeModulosForm`).
- Runtime: `home-v2-client.tsx` usa `order` CSS flex + `hidden` por módulo; ordem numérica menor = mais acima.
- Módulos sem conteúdo (cartas, imóveis, casos, dicas, parceiros vazios) permanecem ocultos mesmo ativos.

### CTA simulador → calculadora de aplicação

- Componente: `SimuladorCalculadoraAplicacaoCta` abaixo do comparativo / resultados.
- Link: `/calculadoras?calc=aplicacao_mensal&aporte=…&prazo=…` (parcela estimada e prazo atuais).

### Logos de parceiros

- `PartnerLogoImage`: fallback com nome do parceiro se URL vazia ou erro de carregamento.

### Mascote

- `ConteudoPageShell` (FAQ, parceiros, indicar, seguradoras, etc.) + páginas de vitrine (grupos, cartas, imóveis, calculadoras) + Home hero + simulador shell.

## Dicas do Tchê

- Categorias de cadastro: `DICA_CATEGORIAS` em `lib/conteudo/types.ts` (sem Imóvel/Veículo).
- Conteúdos legados com categorias antigas continuam visíveis em “Todas”.

## Rodapé (atualizado)

- `PublicFooter` sem vitrine de logos — apenas navegação institucional.

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

## Correção CDI e comparativo consórcio por parcela reduzida

- **Consórcio na aplicação:** busca binária usa `parcelaReduzidaComparacaoAplicacao` — percentual sobre a **parcela integral**, alvo = aporte mensal (não parcela cheia como crédito ~80k).
- Campo **Parcela reduzida do consórcio (%)** (padrão 60 ou opção do simulador imóvel).
- **CDI admin:** série BCB **4389** (CDI a.a. ~14%); série **4390** era taxa mensal/diária (~0,05) — não gravar como anual.
- Validação em `validation.ts` impede CDI anual &lt; 1% ou &gt; 30%; falha preserva último valor válido.
- Cron Vercel: `GET /api/cron/indices-financeiros` com `Authorization: Bearer CRON_SECRET` (dia 1, 11:00 UTC).
- Admin: mensagens de sucesso/erro ao clicar **Atualizar agora**.

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```

## Correção final da calculadora de aplicação

- **Índices mantidos no dropdown:** Poupança, CDI, Selic, Tesouro Selic, Tesouro IPCA+, Taxa manual (+ comparar todos).
- **CDI:** taxa anual válida (≥ 1% a.a., série BCB 4389); percentual 90/100/110/manual; ignora cadastro errado (ex.: 0,05 como anual).
- **Total investido:** soma do valor inicial + aportes mensais reajustados; **rendimento** = valor final − total investido; **valor final** = saldo com juros compostos.
- **Consórcio:** prazo do consórcio (ex.: 220 meses) só para crédito/parcela; **crédito reajustado** usa **período da aplicação** (ex.: 120 meses). A tela exibe os dois prazos.
- **Exemplo CDI 110%:** 14,15% × 1,10 = 15,565% a.a. → mensal equivalente composta (~1,21% a.m.).
- Testes: `aplicacao-comparativo.test.ts`, `indices.test.ts`.

## Reorganização UI/UX das calculadoras e comparativo com consórcio

- **Layout `/calculadoras`:** tabs horizontais no topo (scroll no mobile); painel em largura total (`max-w-6xl`); CTA compacto logo abaixo do resultado.
- **Aplicação mensal:** grid desktop — coluna esquerda “Configurar aplicação”, direita “Resultado da aplicação”; comparativo em duas colunas (Aplicação financeira | Consórcio programado); faixa “Diferença patrimonial” em largura total.
- **Projeção consórcio:** mesma regra do simulador (`calcularProjecaoConsorcio` + linhas anuais em `projecao-financeira.ts`); crédito reajustado no **período da aplicação**; **Reajuste no final de {prazo consórcio} meses** = última linha da projeção (ano inteiro, ex. 19º ano em 220 meses).
- **CDI:** inalterado — todos os perfis no dropdown; anual → mensal composta.
- **Lead:** `dados_simulacao` com campos completos (`rendimento_estimado`, `reajuste_final_consorcio`, `credito_reajustado_periodo`, etc.).
- Testes: `aplicacao-comparativo.test.ts`, `projecao-financeira.test.ts`, `indices.test.ts`.

## Botões e campos monetários (público)

- Variante **`outlineGold`** em botões secundários sobre fundo escuro (`form-primitives`).
- **`MoneyInput`** + `src/lib/formatters/money.ts` — máscara BRL na digitação; salvar número no banco.
- Detalhes: `docs/TESTES-CORRECAO-MONEY-INPUT-BOTOES.md`.
