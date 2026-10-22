# Contemplações, médias e histórico — 22/10/2026

## Regras confirmadas pelo titular
Cotas entregues = cotas ativas já contempladas por sorteio ou lance, mesmo sem usar o crédito. A entregar = cotas ativas oficiais menos entregues. Canceladas e desclassificadas são informativas, fora da quantidade contemplada ativa e da média. Média somente de LANCE_LIVRE/ATIVA com percentual positivo nas últimas 1/3/6/12 assembleias, ponderada por cota vencedora.

## Diagnóstico
O parser antigo lia todas as TRs, incluindo abas ocultas, e aplicava a situação da aba atual às linhas de outras abas. A coluna Sequência das canceladas virava percentual (0001 = 1%). A média incluía qualquer modalidade contendo lance, inclusive fixos/canceladas. Grupos com qualquer data de atualização eram pulados permanentemente. A tela não paginava e truncava em 1.000 linhas.

Auditoria real: 191 grupos no catálogo; 19.166 linhas legadas em 29 grupos, com 1.555 assembleias por grupo no conjunto. Esses 29 têm numeração desde 1 até a última armazenada, mas a classificação é inválida e a última pode estar desatualizada. O ponto de venda oferece 30 grupos: 29 com legado e 1553 sem histórico. Outros 161 não estão na listagem por ponto de venda; a ausência não prova indisponibilidade. Consulta direta confirmou histórico do 1081 e demais grupos omitidos. O titular delimitou expressamente o escopo aos 28 grupos usados no ERP.

## Implementação
- Parser por tabela visível e cabeçalho, validação da seleção das três abas, sorteio com percentual zero. Resultado completo por assembleia, inclusive sem contemplação. Falha não gera snapshot parcial.
- Snapshots imutáveis grupo/assembleia/execução, sem apagar/reclassificar legado por suposição.
- Actions com tenant, módulo e concessão; paginação de 500; última coleta por assembleia; mês por limites DATE, sem ILIKE sobre DATE.
- Tela separa contagem ativa, canceladas e desclassificadas; Sorteada/Confirmada/Desclassificada; cards entregues e a entregar. Histórico incompleto não gera total cumulativo; janelas não avançam para compensar lacuna. Total mensal informa cobertura incompleta. Respostas antigas não substituem seleção nova.
- Robô relê a última e reutiliza somente histórico anterior verificado contíguo até 1; falhas são pendências, não sucesso. Limite do worker para histórico ampliado a seis horas; demais rotinas preservam dez minutos.

## Banco e preservação
Migrations 329 e 330 aplicadas no Supabase canônico eaeuoynprurmmulzhydt após ensaio com ROLLBACK. A 330 foi inicialmente recusada pela revisão automática de aprovação e aplicada após autorização explícita do titular. Tabela grupo_assembleias_resultados tem RLS e proteção contra UPDATE/DELETE; escrita somente pelo job.

As 19.166 linhas antigas mantêm MD5 df846efb9530ec2896bb5758933b4891 antes e após todas as escritas desta fase. Teste real após 330: 100 linhas para usuário autorizado, zero para identidade sem vínculo; sem SELECT anônimo, INSERT authenticated ou UPDATE service_role. A quantidade cresce com a coleta.

## Caso informado
1473 validado de 11 a 1. Assembleia 11, 15/10/2026: 0645-00 Sorteio/ATIVA/0%; 0657-01 Sorteio/CANCELADA/0%. Uma contemplada ativa; duas linhas sem duplicação. Histórico: 12 entregues; 1.022 ativas; 1.010 a entregar. Médias 1/3/6 sem lance livre vencedor; 12 assembleias 56,2244% (um lance livre na assembleia 2).

## Verificações e estado final
23 testes Vitest aprovados em cinco arquivos: cálculos, actions com paginação/acesso, regras de assembleias e migrations/PGlite com RLS. Parser Chromium aprovado com as três abas, sequência não percentual e tabela de opções ignorada. TypeScript e build de produção aprovados; lint do escopo sem erros/avisos. Smoke autenticado local HTTP 200, cards 12/1010 e sorteio 0645/0657 confirmados sem erro JavaScript. Smoke final confirmou também zero/218 no 1563 e total mensal 161. Grupos com zero oficial e primeira assembleia futura não geram aviso de coleta incompleta. Superfícies claras melhoram o contraste do painel.

Conferidos os 28 grupos usados no ERP: 25 com histórico integral de 1 até a última, 1.174 assembleias distintas; três com zero realizadas (1553/1563/5618). Outubro/2026: 161 contempladas ativas, 32 canceladas e 42 desclassificadas, separadas. Total acumulado: 5.710 entregues e 22.072 a entregar. Todas as quatro médias de cada grupo coincidem com recálculo SQL independente. Ajustados três arredondamentos de 0,0001 ponto percentual; código usa unidades inteiras de quatro casas para evitar deriva binária. O hash das 19.166 linhas legadas permanece idêntico.

Coleta final de produção db68a380-0b59-4f6f-a6ef-0c525887c026 concluída com 28 grupos e sem pendências; complementar 1f9678ae-1fcf-4d2c-aa66-8193bd14f438. Coletas exploratórias repartidas e encerradas mantêm snapshots já obtidos; não representam lacunas no resultado final. Banco atualizado, frontend ainda sem publicação confirmada.

## Evidências e recuperação
Auditoria detalhada: tmp/contemplacoes/auditoria-2026-10-22.json. Snapshots: tmp/robo-downloads/contemplacoes-v2/{execucao}. Ausências/pendências em tmp/robo-downloads/. Arquivos ignorados pelo Git. Inventário de todos os grupos no relatório CONTEMPLACOES-COBERTURA-2026-10-22.md.

Recuperação: interromper coleta ou voltar aplicação compatível; preservar snapshots/legado e usar roll-forward. Não reutilizar médias antigas como fonte verificada.

Conferência visual final local: superfícies claras/contraste corrigidos, HTTP 200, desktop com cards e mês sem erro JavaScript. Layout estreito do shell ERP em celular é preexistente; não foi ampliada a alteração para a navegação global.

## Grupo sem assembleias realizadas
Evidência oficial do 1563: zero realizadas; primeira em 14/12/2026. Snapshot visual local racon-detalhe-grupo-001563-1792701128291.png. O código diferencia esse caso de lacuna, mantém médias nulas, zero entregues e 218 a entregar quando a confirmação do portal está persistida. A data cadastral anterior não substitui a primeira assembleia oficial.
