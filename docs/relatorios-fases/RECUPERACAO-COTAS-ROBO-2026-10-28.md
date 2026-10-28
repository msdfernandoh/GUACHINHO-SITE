# Recuperação de disponibilidade após importação parcial — 28/10/2026

## Incidente e causa

A execução autorizada `9028baa0-0479-4485-8fbd-e47c96137fde` capturou somente parte dos planos do portal. A regra de reconciliação do serviço tratava créditos ausentes da extração como indisponíveis e os inativava. No grupo 5388, capturou três dos oito créditos PRORROGADA, ocultando as cinco opções menores. A leitura incompleta não é evidência de retirada de um crédito pela administradora.

A execução foi interrompida e registrada com erro. Nenhuma cota foi excluída. A extração também revelou repetição legítima do mesmo crédito no título e corpo de um cartão; o parser agora aceita essa repetição quando o valor numérico é idêntico.

## Recuperação executada e conferida

Foi utilizada a cópia anterior `tmp/auditoria-cotas/antes.json`. A restauração foi restrita a IDs anteriormente ativos e disponíveis, atualmente inativos, alterados entre 16:42 e 16:48 UTC de 28/10. Cada UPDATE conferiu o timestamp lido, evitando sobrescrever alterações concorrentes. Uma falha transitória de conexão interrompeu a primeira tentativa após seis registros; a continuação restaurou os outros doze.

Somente `ativo` e `status` foram restaurados. Não foram inventados valores de parcelas nem revertidos indiscriminadamente outros dados.

Consulta posterior salva em `tmp/auditoria-cotas/restaurado.json` confirmou:

- 18 cotas restauradas; registro em `tmp/auditoria-cotas/restauracao-disponibilidade.json`.
- 322 cotas ativas antes e 322 depois.
- Nenhum ID anteriormente ativo permanece inativo.
- 5388 PRORROGADA: oito créditos ativos: 36.561,63; 41.784,72; 47.007,81; 52.230,00; 57.453,99; 62.677,08; 67.900,17; 73.123,26.

## Proteções no código e limites

Removida a inativação por ausência na extração. Antes de gravar dados de um grupo existente, o serviço verifica se todos os seus créditos ativos da modalidade constam no lote; se faltar algum, aborta o grupo antes das gravações. Os 13 testes do extrator/serviço passaram.

A restauração foi conferida diretamente no banco; ainda não há confirmação visual da página pública após a recuperação. O problema original de parcelas incorretas permanece pendente: a execução parcial alterou alguns valores e não constitui uma sincronização homologada. Não executar novamente em produção antes de validar carregamento completo, isolamento entre grupos/modalidades e valores por cartão. As proteções locais não comprovam essa homologação.
