# Desempenho dos sites Racon e seguro no mobile — 28/10/2026

## Escopo e estado

Análise de raconsinop.com.br e raconsorriso.com.br, com ajustes locais de baixo impacto. Layout institucional, rotas, catálogo, regras financeiras, autenticação e dados preservados. Sem migration, escrita operacional, commit, push ou publicação nesta fase.

Arquitetura master e documento de estado-alvo lidos antes das alterações. O contexto continua derivado dos headers confiáveis do proxy, com vínculo N:N e controles existentes.

## Evidência em produção

As homes e /grupos dos dois domínios abriram no navegador. Sinop redirecionou para www; Sorriso permaneceu no apex. Os dois GETs de /grupos retornaram HTTP 200.

Amostra pontual do navegador, sem throttling e sem limpeza de cache: após recarregar /grupos, foram observadas 21 respostas de antecipação de rotas (_rsc) em Sinop e 20 em Sorriso. Tempo entre envio e recebimento dos cabeçalhos dessas respostas: Sinop 714–1.522 ms, mediana 910 ms; Sorriso 223–568 ms, mediana 279 ms. Esses tempos não representam o carregamento completo nem uma comparação controlada de infraestrutura. Não há medição de ganho pós-publicação.

Em viewport mobile de 390 × 844, a produção apresenta cartões de grupos. O seguro está somente no painel recolhido “Ajustar lance e seguro”.

## Diagnóstico e mudanças locais

1. `getResolvedTenant` era chamado por layouts, metadata e páginas, repetindo a resolução de branding/modelo/parceiro. Envolvido em `React.cache`, que deduplica apenas durante o mesmo render RSC. Não há cache persistente de sessão, autorização ou tenant entre requisições.
2. `/grupos` aguardava em sequência catálogo, usuário, contexto, configuração e empresa. Leituras independentes iniciam em `Promise.all`, mantendo validações e filtros existentes. A lista autorizada e o preenchimento de lead continuam dependentes do contexto resolvido.
3. Rotas públicas não tinham `loading.tsx`. Adicionado fallback leve que permite antecipação parcial e feedback durante o carregamento, mantendo o layout compartilhado interativo quando disponível. O proxy e o primeiro carregamento do layout ainda podem bloquear a entrada; não se promete navegação instantânea.
4. Cartão mobile mostra “Com seguro” e “Sem seguro” após selecionar uma cota e quantidade positiva. Botões de pelo menos 44 px, estado `aria-pressed` e primeira parcela visível. Usam `handlers.patch({ usaSeguro })` e o motor existente. A taxa canônica define disponibilidade; seguro obrigatório após contemplação continua preservado.

## Próximas otimizações possíveis sem redesenho

- Medir separadamente a resolução de domínio/parceiro e a autenticação do proxy, que antecedem todas as rotas. Manter os gates de publicação e autorização.
- Deduplicar o view model do parceiro entre metadata, layout e página, usando um wrapper exclusivamente servidor, com empresa/site/preview explícitos. Evitar cache global sem invalidação de publicação e concessões.
- Avaliar antecipação por intenção nos links menos usados do menu/rodapé. A amostra mostra múltiplas requisições antecipadas; desativar tudo pode piorar o clique e não foi feito.
- O template desativa otimização para todas as imagens HTTPS. Habilitar variantes dimensionadas somente para origens autorizadas, avaliar bytes reais e compressão WebP/AVIF. Imagens de origens arbitrárias precisam manter comportamento compatível.
- Separar sob demanda o gerador offline e módulos secundários de Grupos após medir o bundle. Preservar os fluxos de propostas e sorteios.

## Validação

- TypeScript: aprovado (`tsc --noEmit`).
- Build: aprovado (`next build`, Next.js 16.3.0).
- Testes: 21 arquivos e 146 testes aprovados (cálculo, seguro e isolamento tenant).
- Lint direcionado: aprovado, sem erros ou avisos.
- Smoke local no build de produção, identidade Sorriso, 390 × 844: cartão com largura 358 px; botões Com seguro/Sem seguro visíveis após quantidade 1, estado aria-pressed correto. Grupo 1041: primeira parcela R$ 3.217,85 com seguro e R$ 3.016,73 sem seguro; pós-contemplação R$ 3.488,91 preservada nas duas escolhas. Nenhuma contratação ou proposta criada.
- Loading público observado no navegador antes de concluir o carregamento de Grupos.
- Primeira execução Vitest: não executou testes devido a `EPERM rename` na pasta temporária do sandbox. A reexecução com TEMP/TMP no workspace concluiu com 146 testes aprovados; a execução fora do sandbox também aprovou os mesmos 146 testes.

## Riscos, implantação e reversão

A latência percebida também depende de rede, cache, servidor e consultas do proxy. As medições acima são exploratórias. Ganho quantitativo exige comparação após publicação, em mobile e desktop, com cache frio e quente.

Reversão: restaurar os três arquivos alterados e remover o novo loading público. Nenhum dado exige rollback. Publicação e homologação em produção pendentes.
