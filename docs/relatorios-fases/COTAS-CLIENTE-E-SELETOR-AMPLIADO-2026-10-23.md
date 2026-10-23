# Cotas do cliente e seletor ampliado — 23/10/2026

Campo Cotas do cliente no grupo ao lado do percentual de atraso, iniciando em 1. Quantidade inteira positiva, limitada às cotas a entregar do grupo; memória local separada por grupo, sem persistência no banco. Atualização imediata dos resultados ao editar. Ranking permanece por cota e passa a explicitar essa base no título.

Projeção solicitada = chance média por cota × quantidade, limitada a 100%. Base por cota fica visível em cada cenário, com multiplicador. É identificada como projeção proporcional/soma das chances, não probabilidade conjunta exata de pelo menos uma contemplação, pois as posições e o desempate sequencial correlacionam resultados. Quando a soma alcança o teto, mostra Até 100%, sem promessa de garantia. Cenários de origem indisponíveis continuam indisponíveis. Nenhuma mudança no cálculo histórico, população elegível ou dados oficiais.

Seletor de grupo ocupa toda a largura livre da linha com flex, mantendo adaptação no celular e leitura mais ampla do nome e das tags. Continua com cores de alto contraste.

34 testes em seis arquivos aprovados, incluindo quantidade fracionária, saldo máximo, cenário indisponível, multiplicação e limite. Build/TypeScript e lint do escopo aprovados. Smoke autenticado local HTTP 200: 0,1543% por cota para 0,6172% com quatro cotas, quantidade zero recusada, memória por grupo e campos lado a lado; seletor com 916 px e texto selecionado de 418 px, sem corte; oito ativas preservadas e zero erros JavaScript. Evidências em tmp/contemplacoes/cotas-cliente.png e seletor-ampliado.png. Sem migration, alteração de permissão ou escrita de negócio. Publicação ainda não confirmada nesta subfase.
