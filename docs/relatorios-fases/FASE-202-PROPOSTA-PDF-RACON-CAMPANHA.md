# Relatório de Conclusão — Fase 202: Proposta em PDF com identidade Racon e capa Conquiste+

**Data:** 01/09/2026
**Migration:** nenhuma (configuração nova reaproveita `configuracoes_sistema`, chave `propostas`)

## Objetivo

Substituir o PDF genérico gerado pelo menu **Grupos → Gerar proposta PDF** por um
documento com identidade da administradora Racon, que:

- peça nome do cliente (obrigatório) e observação/consultor (opcionais) antes de gerar;
- mostre início do grupo, taxas, composição financeira, **custo do plano diluído** (não
  "custo efetivo"), todos os tipos de lance com o escolhido em destaque, e evolução
  pós-contemplação;
- separe visualmente grupos de imóvel e de veículo na mesma proposta;
- seja enxuto (capa + 2 folhas para um segmento; capa + 3 para dois);
- ofereça duas capas configuráveis pelo site: documento padrão ou estilo da campanha
  "Conquiste+" (com o embaixador Rubinho Barrichello em selo pequeno);
- tenha os blocos e as linhas de "Dados do grupo" liga/desliga por configuração da
  empresa, sem arriscar o layout com liberdade campo a campo.

## Decisão de produto

Prévia visual foi desenhada e aprovada iterativamente com o usuário (capa documento →
capa campanha → blocos editáveis → paginação enxuta) antes da implementação, incluindo a
identidade da campanha real da Racon ("Conquiste+ Imóveis") encontrada em
`.claude/Conquiste+ imoveis (*).png`.

## Arquitetura

### Dados (sem migration)

`load-pdf-data.ts` continua a única porta de entrada para montar `PropostaPdfData`. Além
dos campos legados, quando a proposta tem `dados_simulacao.simulacao_grupo_id`:

1. busca `simulacoes_grupos_itens` (já existia);
2. busca `grupos_consorcio` e `grupos_modalidades_lance` pelos `grupo_id` dos itens —
   mesmo padrão de `assertSelecoesAutorizadasForEmpresa`
   (`src/lib/grupos/catalogo-autorizado-service.ts`);
3. `build-segmentos.ts` cruza tudo e devolve `segmentos: SegmentoPdf[]` (agrupados por
   `imovel` | `veiculo` | `outro`, cada um com seus grupos e totais) e `consolidado`;
4. lê `propostas` (chave `propostas` em `configuracoes_sistema`) para `capaEstilo`,
   `blocos` e `linhasGrupo`, com fallback total em `DEFAULT_PROPOSTAS`.

Quando não há `segmentos` (proposta de simulador avulso, carta contemplada), o documento
cai no layout legado — nenhuma proposta antiga muda de aparência.

### Custo do plano diluído

`custo-plano.ts` — `calcularCustoDiluido(taxaAdm, fundoReserva, prazoMeses)` — devolve
`{ basePercentual, percentualMes, percentualAno }` como diluição linear simples
(`base ÷ prazo`, `×12`), com teste cobrindo os exemplos do usuário (22%/220 = 0,10%/mês,
1,20%/ano; 16%/80 = 0,20%/mês, 2,40%/ano). Deliberadamente não é CET.

### Documento (`proposta-pdf-document.tsx`)

Reescrito para ramificar em `data.segmentos.length > 0`:

- **Capa padrão** — gradiente navy pré-renderizado, logo Racon, protocolo, cliente.
- **Capa campanha** — gradiente + cena de casa/carro esmaecida (`foto/Casa.png`), lockup
  "CONQUISTE+" (Archivo bold-itálico + seta), pill de oferta com os números reais da
  proposta, selo circular do Rubinho (`racon-rubinho-apontando.png`, baixa resolução —
  por isso só aparece pequeno).
- **Folha de resumo** — cards consolidados (2+ segmentos) ou do único segmento, fundidos
  com o primeiro `SegBlock` na mesma folha.
- **`SegBlock`** — bloco reutilizável por grupo: início do grupo, dados do grupo,
  composição financeira, custo do plano, tabela de tipos de lance (escolhido em destaque),
  evolução pós-contemplação — cada peça condicionada a `blocos`/`linhasGrupo`.
- **Folha de encerramento** — observação do consultor (se houver), contatos, assinaturas,
  aviso legal.
- Numeração de folhas dinâmica: 1 (resumo + 1º segmento) + 1 por segmento adicional + 1
  (encerramento).
- Layout legado original preservado integralmente como fallback (`LegacyDocument`).

react-pdf não suporta gradiente CSS nem seletores de combinador (`> * + *`); gradientes
da capa são PNGs pré-gerados (`assets/grad-*.png`) e cada componente define sua própria
margem.

### Fontes e imagens embutidas

`fonts.ts` registra **Archivo** (regular/medium/bold/bold-itálico) e **Roboto Mono**
(regular/medium) via `Font.register` com `data:` URI — sem dependência de rede em
runtime. A fonte originalmente escolhida para dados tabulares era IBM Plex Mono, mas o
`.ttf` servido pelo Google Fonts (`v20`) trava o parser `fontkit` do react-pdf
(`RangeError` no glifo de espaço); Roboto Mono foi validada glifo a glifo (acentos
pt-BR, `%`, `$`, `·`, travessões) e não tem esse problema.

`assets.ts` lê `fonts/*.ttf` e `assets/*.png|.jpg` de `src/lib/proposta/pdf/` via
`fs.readFileSync(process.cwd() + ...)` e cacheia como data URI. `next.config.ts` declara
`outputFileTracingIncludes` para `/api/**` e `/admin/**` garantindo que esses arquivos
sejam empacotados no build serverless (Vercel).

### Configuração (`Configurações → Propostas`)

`PropostasConfig` (`src/lib/config/defaults.ts`) ganhou `capaEstilo`, `blocos` e
`linhasGrupo`. `config-tabs.tsx` + `actions.ts` (`savePropostasConfigAction`) expõem um
seletor de capa e dois grupos de checkboxes. A regra de design: **blocos têm estrutura
fixa** (podem ser ligados/desligados inteiros); dentro de um bloco, apenas **linhas de
informação do grupo** específicas podem ser ocultadas — a grade se reorganiza sozinha, o
layout nunca quebra. Não existe campo-a-campo livre.

### Formulário do fluxo (menu Grupos)

`grupos-public-client.tsx` (modal de "Gerar proposta PDF", visível para consultores)
ganhou observação (textarea) e nome/telefone do consultor, opcionais. `route.ts`
(`/api/public/grupos/fluxo`) grava esses campos em `propostas` e os repassa como
overrides para `generateAndStorePropostaPdf`. O toolbar do admin
(`proposta-pdf-toolbar.tsx`) ganhou o mesmo campo de observação.

## Testes

- `custo-plano.test.ts` — diluição do custo (unitário).
- `proposta-pdf-document.test.ts` — renderiza PDF real (`renderToBuffer`) para: só
  imóvel/capa padrão, imóvel+veículo/capa campanha, e o fallback legado sem segmentos;
  valida o cabeçalho `%PDF-` e ausência de exceções (fontes/imagens carregam de fato).
- Verificação manual de paginação: extração de texto por página (`unpdf`) confirmando
  3 páginas (capa + 2) para um segmento e 4 páginas (capa + 3) para dois, com todos os
  valores (início do grupo, custo diluído, lance escolhido, observação) no lugar certo.
- `npx tsc --noEmit`, `npm run build` e a suíte completa (`vitest run`) passam; a única
  falha pré-existente (`repasse-reabertura-vinculos-contract.test.ts`) não tem relação
  com esta fase (confirmado com `git stash`).

## Compatibilidade

Nenhuma coluna ou tabela nova. Propostas existentes sem `segmentos` continuam no layout
legado, byte a byte equivalente ao anterior (mesmos estilos, mesma fonte Helvetica).
