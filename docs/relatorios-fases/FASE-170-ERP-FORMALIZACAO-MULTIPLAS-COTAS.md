# Fase 170 — ERP Formalização com múltiplas cotas

## Objetivo

Corrigir o seletor vazio de Grupo/Produto em **ERP → Contratações → Conferir e
formalizar** e materializar todas as cotas aceitas na contratação, sem duplicar
a venda nem recalcular comissão.

## Diagnóstico

A página consultava `empresa_administradoras.ativo = true`. Essa coluna não
existe no contrato atual: a concessão usa `status = 'ATIVA'`. O PostgREST
retornava erro, a aplicação o ignorava e montava a lista de administradoras
permitidas vazia. Em seguida, a consulta de grupos recebia um UUID impossível,
por isso nenhum Grupo/Produto aparecia apesar de existirem 21 grupos ativos.

## Implementação

- a concessão passa a usar `empresa_id + status = 'ATIVA'` e erros de leitura
  deixam de ser convertidos silenciosamente em lista vazia;
- a quantidade é lida da coluna canônica ou do snapshot aceito
  (`selecoes[0].config.quantidadeCotas`, resultado ou `totais.totalCotas`);
- propostas imutáveis exibem a quantidade congelada sem permitir divergência;
  registros legados permitem informar de 1 a 100 cotas;
- `contratacoes_online` e `vendas` recebem `quantidade_cotas`; cada cota recebe
  `ordem_cota`;
- permanece uma venda por contratação, agora com N cotas definitivas por venda,
  únicas por `(venda_id, ordem_cota)`;
- o crédito unitário vem do produto canônico e a soma precisa coincidir com o
  crédito total aceito. A parcela total é distribuída em centavos, com o resíduo
  na última cota, preservando exatamente o total;
- o conversor canônico continua responsável por tenant, participantes,
  comissão e idempotência. A extensão multicotas roda na mesma transação e a
  comissão é gerada uma única vez sobre o total da venda.

## Segurança e preservação

- tenant resolvido no servidor pelo vínculo ativo; nenhum `empresa_id` do
  navegador é aceito como autoridade;
- RPC disponível somente para `authenticated` e exige `formalizar_vendas`;
- grupo e produto precisam pertencer ao catálogo concedido e o produto precisa
  reconciliar com o total contratado;
- snapshots assinados rejeitam mudança da quantidade;
- quatro cotas históricas existentes foram preservadas como ordem 1; nenhuma
  venda, comissão, contratação ou cota histórica foi excluída ou recalculada.

## Evidências

- migration `168_formalizacao_venda_multiplas_cotas.sql` aplicada no Supabase
  principal;
- pós-check: 2 concessões ativas, 21 grupos ativos e novas colunas disponíveis;
- pós-check: 4/4 cotas históricas com chave `(venda, ordem)` única e ordem válida;
- TypeScript sem erros;
- lint do escopo sem erros;
- 26 testes direcionados aprovados, incluindo leitura de snapshot, concessão
  canônica, cardinalidade 1:N e compatibilidade financeira;
- suíte completa: 218 arquivos/1.154 testes aprovados, com 9 arquivos/37 testes
  live intencionalmente ignorados;
- build de Produção aprovado com 148 páginas.

## Roll-forward

O banco foi expandido de forma compatível. Em caso de regressão visual, a
aplicação anterior continua operando com a primeira cota. A estrutura e os dados
novos não devem ser removidos; qualquer correção será forward-only.
