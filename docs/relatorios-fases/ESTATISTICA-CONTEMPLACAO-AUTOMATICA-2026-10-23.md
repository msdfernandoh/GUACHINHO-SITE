# Estatística automática de contemplação e contraste — 23/10/2026

## Escopo confirmado
Titular solicitou cálculo ao abrir o grupo, atraso inicial de 30% editável com atualização automática, comparação com/sem lance livre, participação no sorteio normal, lance fixo e segundo fixo e tags de destaque nos grupos. Informou chamada da próxima cota elegível acima da sorteada em ordem crescente. Campo de abstenção de lance livre removido da proposta.

## Modelo implementado e limites
Estimativa média por cota elegível na próxima assembleia; não estima a posição individual da cota na sequência da pedra. Toda a série verificada de 1 até a última é usada, incluindo assembleias sem contemplação. Última versão de cada assembleia, somente confirmadas ATIVA, cota única por assembleia. Canceladas, desclassificadas, lance fidelidade e limitado não entram nas modalidades desta simulação.

N = cotas ativas menos entregues, pela regra já confirmada. E = N × (1 − atraso/100), mantido sem arredondamento no cálculo. Sem livre: média histórica de sorteio + fixo + segundo fixo, dividida por E, vezes 100. Com livre: acrescenta a média das contemplações por lance livre e divide pela mesma população E. São vagas distintas, sem somar probabilidades de eventos independentes. Pressupõe todas as cotas elegíveis oferecendo os fixos e, no cenário com livre, também o teto. Não há contagem real das ofertas perdedoras nem verificação de que os livres históricos estavam todos no teto; essa hipótese e a diferença entre média do grupo e chance individual ficam explícitas na UI.

A regra crescente informada descreve o desempate; sem a lista completa de cotas elegíveis e ofertas, não há previsão individual de qual posição será chamada. A fórmula média não pressupõe distribuição uniforme entre números de cotas e não simula sorteios independentes entre modalidades. Ela projeta a quantidade histórica de contemplações sobre a população elegível atual, condicionada às hipóteses exibidas e à existência futura de vagas/recursos.

Se a média histórica igualar ou superar E, a chance afetada é nula/Não estimável e o cenário fica fora da classificação; não produzir 100% artificial em grupos no fim. Histórico incompleto, zero assembleias, saldo ausente/zerado, menos de uma cota elegível ou hipótese inválida não produzem percentuais. Nenhuma probabilidade individual ou promessa de contemplação.

## Classificação e interface
Ranking por chance média no cenário com lance livre no teto. Tags Top 3 em chance com livre e Top 3 em contemplações por assembleia separam chance de volume. Empates recebem a mesma posição, incluindo todos os empatados nas primeiras três posições; zero não gera destaque. Grupos sem cenário válido ficam fora, com quantidade informada. Top cards clicáveis selecionam o grupo. Opções do seletor identificam os destaques. Percentual local inicia em 30; edição recalcula o grupo imediatamente e reconsulta ranking com debounce de 300 ms e proteção contra resposta antiga. Sem gravação de preferência ou hipóteses no banco.

Filtros em superfícies brancas com texto #0f172a, borda #94a3b8 e color-scheme light, incluindo option/optgroup; seletor de grupo permanece no topo. Modo ativo azul com texto branco; CSS restrito ao painel, sem alterar navegação global.

## Acesso e preservação
Nova action requer acesso ERP assembleias e usa grupos do catálogo concedido à empresa. Snapshots são lidos pelo cliente autenticado/RLS, em páginas de 500. Apenas resultados agregados do ranking são enviados ao browser. Grupo selecionado mantém validação de concessão existente. Sem service role no browser, migration, alteração de permissão ou escrita em dados de negócio.

## Validação
31 testes em seis arquivos aprovados: todas as modalidades, assembleia vazia, cotas repetidas, exclusões, saldo/percentuais inválidos, cenário saturado, empate no ranking, grupo menor com maior chance, paginação além de mil e acesso. TypeScript/build de produção e lint do escopo aprovados. Smoke local autenticado HTTP 200: grupo 1473 com 0,1543% no cenário com livre a 30% de atraso e 0,216% a 50%, atualização automática, hipótese inválida 101% sem resultado, zero assembleias sem chance falsa e sem erros JavaScript. Contraste computado no seletor: fundo rgb(255,255,255), fonte rgb(15,23,42). Smoke final também conferiu o grupo 4088 saturado sem percentual artificial nem tag de maior chance, seleção pelo card de destaque e filtro acima da estatística. Evidências em tmp/contemplacoes/estatistica-*.png (ignoradas pelo Git).

## Estado
Implementação publicada e homologada em produção em 23/10/2026. Commit funcional 76f4e643dfed35aa7e5968aecbfe005fba350215; deployment dpl_Fmq2oZEkF77ToKUrNXfoW23YoP2n, READY nos domínios oficiais. A correção anterior de médias e importação permanece publicada. Cálculos não alteram os resultados oficiais nem as médias de lance existentes.

## Homologação em produção
Smoke autenticado HTTP 200 no domínio www.gauchinhoconsorcios.com.br: atraso inicial 30%, resultado com livre 0,1543% no 1473; alteração para 50% atualizou para 0,216% sem botão; 101% não gera chance; grupo sem assembleias não gera percentual; 4088 saturado não recebe tag nem 100% artificial; clique de destaque seleciona o grupo; filtro permanece acima da estatística. Cores computadas branco/#0f172a e zero erros JavaScript. Evidências ignoradas pelo Git em tmp/contemplacoes/estatistica-producao-*.png e deploy-estatistica.json. Diretório local limpo após o envio; servidores locais próprios encerrados.
