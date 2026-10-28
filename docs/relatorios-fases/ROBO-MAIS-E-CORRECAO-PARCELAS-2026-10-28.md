# Robô: Mais e correção de parcelas — 28/10/2026

## Correção do carregamento

O portal renderiza inicialmente parte dos planos. O robô agora delimita o grupo expandido, clica repetidamente em Mais/Mostrar mais/Carregar mais e aguarda aumento efetivo de planos. Controle ambíguo, falta de progresso ou limite de cliques abortam a captura antes das gravações. Rolagem deixou de ser tratada como prova de carregamento completo.

O extrator separa Prorrogada e Diluída pelo texto de cada cartão, mesmo quando ambas aparecem juntas. Produtos são selecionados pelo texto exato. Planos são recolhidos também após erro/conferência, evitando pular grupos. Erros de captura passam a produzir erro de execução. Removido o teto arbitrário de mensalidade de 25% do crédito: grupos no fim do prazo podem legitimamente ultrapassá-lo. Permanecem validações de grupo, cartão individual, modalidade, valores positivos/finitos, duplicidade e conflito.

O processo-filho repassa dry_run e o filtro de grupos ao serviço. Conferência salva evidências e histórico de execução, sem alterar o catálogo. Mantidas as proteções contra inativação por ausência e contra gravação de grupo com créditos ativos omitidos.

## Execução e reparação

Conferência inicial: `1954edcc-4d70-457f-b745-c1e614689f57`. Conferência dos 28 grupos: `0718eda1-8ffd-4f34-9e81-62d078542a9a`, com erro explícito em quatro capturas e sem escrita no catálogo. Complemento 4088: `d6ceb90b-75ec-4a24-bf34-f5b0d987fcd1`, concluído. Consolidado: 29 fontes grupo/modalidade. No 5388, três cliques carregaram 32 planos; seis carregaram 64 quando ambas as modalidades estavam visíveis. O extrator separou 32 por modalidade.

Foram corrigidos **77 registros em 13 grupos** por valores presentes nos cartões oficiais: 1071, 1081, 1453, 1463, 1473, 1533, 1543, 1563, 4088, 5188, 5388, 5488 e 5588. Atualizações conferiram ID, grupo, modalidade, crédito e timestamp anterior, com cópias antes/depois. Campos de parcela encontrados e seus equivalentes de compatibilidade foram sincronizados. Campos de redução ausentes na fonte foram preservados para revisão comercial.

Uma cota do 5388 tinha crédito truncado em 52.230,00; foi corrigido para 52.230,90 conforme cartão oficial, preservando o ID. Não houve exclusão/inativação, recriação de IDs ou alteração de clientes/propostas.

Exemplo: 5388, crédito 36.561,63, parcela de 60% antes do seguro:

| Modalidade | Antes | Oficial gravado |
| --- | ---: | ---: |
| Prorrogada | 1.178,09 | 353,44 |
| Diluída | 1.178,09 | 530,11 |

## Conferência e limites

Consulta posterior confirmou **322 cotas ativas, nenhuma opção ativa anterior ausente e nenhuma divergência nos registros alterados**. Das 322, 151 têm correspondência nas fontes consultadas; nova comparação encontrou zero diferenças nos campos oficiais encontrados. Ambas as páginas públicas /grupos responderam HTTP 200 e entregaram o crédito 36.561,63 e a parcela 353,44 no HTML. Não houve teste visual de interação do site nesta fase.

Não representa homologação integral das 322 cotas: 171 não tiveram correspondência comprovada por grupo/modalidade ausente ou crédito diferente. Onze registros da auditoria inicial ainda conservam a parcela de 60% anterior, nos grupos 1041, 1193, 1253, 1270, 1273, 1283, 1503 e 4088. O 4088 apresentou somente integral nas fontes consultadas; reduções legadas exigem revisão comercial. Não associar valores por aproximação ou proporcionalidade presumida.

**Orientação final do titular:** manter os grupos antigos ativos porque, embora sem vagas, possuem clientes. A instrução intermediária de inativá-los foi revogada antes de qualquer alteração. Ausência de vagas ou de plano comercial no portal não autoriza inativar grupo, cota ou vínculo de cliente. Nenhuma quantidade de vagas foi inferida a partir da ausência de planos.

Em seguida, o titular autorizou ocultá-los do site ou apresentá-los sem vagas. Foi usada a apresentação sem vagas: 1041, 1193, 1253, 1270, 1273, 1283 e 1503 tiveram vagas_disponiveis definido em zero e o timestamp de vagas atualizado, mantendo ativo=true. A informação de ausência de vagas veio expressamente do titular. Cópia em tmp/auditoria-cotas/grupos-sem-vagas.json. A interface existente mostra 0 vagas/Aguardando novas vagas; nenhuma mudança estrutural no site foi necessária.

Evidências locais preservadas em tmp/auditoria-cotas: antes-correcao-oficial.json, final-correcao-oficial.json, aplicacao-parcelas-oficiais.json e plano-correcao-oficial.json; cartões em tmp/robo-screenshots/planos-g*.json. Arquivos operacionais não versionados.

**21 testes aprovados**, incluindo Chrome real com Mais assíncrono, menor crédito carregado por último, isolamento de grupos, botão sem progresso, limite, modalidades separadas e serviço dry-run com toda mutação de catálogo proibida.
