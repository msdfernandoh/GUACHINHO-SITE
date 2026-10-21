# Auditoria dos 342 avisos e atualização do dashboard — 20/10/2026

## Escopo e evidência
Pedido do titular: verificar os 342 avisos restantes. Levantamento individual
classificado por arquivo, regra, prioridade de revisão, situação e avaliação no
arquivo AUDITORIA-342-AVISOS-2026-10-20.json. As linhas desse inventário são do
relatório original; não devem ser confundidas com linhas posteriores à edição.
A classificação estática não é homologação funcional dos módulos pendentes.

| Categoria | Antes | Depois | Avaliação |
| --- | ---: | ---: | --- |
| any explícito | 209 | 208 | Enfraquece o contrato de tipos; não comprova valor incorreto. Priorizar entradas de API e módulos financeiros. |
| Identificadores não usados | 65 | 65 | Inclui omissões intencionais de campos com rest e cálculos de teste sem asserção. Não apagar efeitos ou exclusões de campos. |
| Estado síncrono em efeito | 43 | 42 | Pode causar render adicional; não significa necessariamente loop. Revisar rascunho, hidratação, elegibilidade e cancelamento. |
| Imagem HTML sem otimização Next | 12 | 12 | Recomendação de performance. URLs dinâmicas e previews precisam preservar proporção e carregamento antes de migrar. |
| Texto alternativo | 7 | 0 | Eram um ícone lucide e seis componentes Image do renderer PDF. Nomes ImageIcon/PdfImage evitam o falso positivo sem mexer em imagens HTML. |
| Dependências de hooks | 4 | 1 | Dashboard, comissão e vagas corrigidos. Campo percentual requer desenho de rascunho que preserve digitação parcial. |
| Expressão sem uso | 1 | 0 | Seleção add/delete convertida de ternário a if/else explícito. |
| Diretiva sem efeito | 1 | 0 | Diretiva inválida removida; preservada outra diretiva de imagem que já existia e era efetiva. |
| Total | 342 | 328 | 14 avisos resolvidos, zero erros. Teto original continua 353. |

## Defeito funcional corrigido: concorrência no dashboard
Antes, cada alteração de período/administradora iniciava fetch independente.
Se o operador escolhesse A e depois B, uma resposta lenta de A poderia chegar
por último e substituir a de B. Não existia cancelamento na desmontagem.
O efeito de carregamento inicial também omitia dependências.

Agora a consulta reage aos filtros/recarregamento, utiliza AbortController e
cancela a anterior no cleanup. A leitura do JSON também verifica o cancelamento,
pois transportes podem terminar após abort. Resultados, erros e estado de carga
somente são aplicados quando a consulta continua ativa. Atualizar/tentar de novo
funcionam inclusive com filtros inalterados, e dados iniciais SSR continuam
preservados até uma consulta ser solicitada.

Falha HTTP agora tem mensagem explícita. Havendo dados anteriores, a tela avisa
que são da última consulta concluída, em vez de apresentá-los como atualização
bem-sucedida. Não houve mudança nos cálculos de indicadores.

## Outros ajustes
- Período da API do dashboard validado contra lista permitida, com fallback para
  mes_atual; removida coerção any. Empresa e autorização continuam resolvidas
  exclusivamente por requireGestaoApiAccess.
- Datas dos filtros de comissão usam dependências primitivas de ano/mês,
  evitando que new Date invalide o memo a cada render sem congelar a data.
- Funções dos filtros de vagas em lote usam useCallback com vagasEditadas, e o
  helper de vagas originais é puro fora do componente. Critérios preservados.
- Aliases ImageIcon/PdfImage esclarecem semântica e preservam o renderer PDF.

## O que não foi tratado como correção automática
Os 42 efeitos restantes incluem recuperação de localStorage, portais/SSR,
rascunhos de moeda/percentual, retorno de ações e seleção por regra comercial.
Não foram substituídos por setTimeout, nem removidos apenas para eliminar aviso.
Os 208 any precisam de contratos reais; substituir por unknown ou casts sem
validação não resolve o risco. O inventário prioriza produção e separa fixtures.
Os 65 unused incluem campos removidos intencionalmente de objetos com rest;
apagá-los pode reenviar dados indevidos. Esta fase não afirma que os 328 avisos
foram funcionalmente saneados: eles permanecem registrados para revisão.

## Validação
- Cinco testes novos cobrem filtro de período inválido, parâmetros escapados,
  resposta antiga posterior à nova, cancelamento durante JSON e falha HTTP.
- Suíte completa: 352 arquivos aprovados e 9 opt-in ignorados;
  1.821 testes aprovados, 37 ignorados, nenhuma falha.
- TypeScript e build de produção aprovados.
- ESLint completo passou sob teto 353. Após revalidar isoladamente o arquivo de
  eventos com a diretiva preexistente preservada, consolidação por arquivo:
  zero erros e 328 avisos. Não foram alteradas regras ou limites de lint.
- git diff --check aprovado. Sem migration, leitura/gravação de dados remotos
  ou alteração de schema. Publicação Vercel não homologada nesta fase.
