# ERP Contratações — Formalização V1

## Estado anterior

`/erp/contratacoes` renderizava diretamente a página administrativa escura do site. A lista refletia estados do fluxo público, oferecia exclusão e não funcionava como fila de conferência operacional.

## Arquitetura reutilizada

- `contratacoes_online`, `propostas` e `contratacoes_documentos` permanecem como origem.
- `clientes` e a deduplicação por documento/empresa da migration 071 são reutilizados.
- `rpc_converter_contratacao_venda` continua como única transação de Venda + Cota + previsões.
- `grupos_consorcio`, `grupos_cotas`, `participantes_comerciais` e as regras 060–078 são apenas conferidos/mapeados.
- Documentos permanecem no bucket privado, sem cópia.

## Novo fluxo

A migration 079 adiciona somente estado operacional, pendência e histórico append-only. Um RPC de preparação valida tenant, assinatura, Grupo, produto e participantes. O gatilho de Venda marca a contratação formalizada dentro da mesma transação do motor canônico.

A UI branca do ERP inclui cards reais, busca, filtros, fila ordenada, tempo de espera, ações contextuais e detalhe próprio com seções de Cliente, Documentos, Dados comerciais, Participantes, Regra de comissão, Resumo e Histórico.

## Idempotência e integridade

O serviço chama `converterContratacaoEmVenda` com chave estável `erp-formalizacao:<contratacao_id>`. O RPC canônico trava a operação, verifica Venda existente e reutiliza a resposta. A restrição existente de uma Cota por Venda e a deduplicação de Cliente por documento/empresa permanecem vigentes.

## Testes e homologação

- Contrato estático garante ausência de INSERT paralelo em `vendas`/`cotas_definitivas`.
- TypeScript: aprovado pelo build de produção local.
- Teste direcionado: 4/4 PASS.
- Suíte completa: 737 PASS / 37 SKIP em 132 arquivos aprovados e 9 ignorados.
- Lint das novas rotas/serviços: aprovado.
- Build Next.js: aprovado, 132 páginas estáticas geradas e rotas `/erp/contratacoes` e `/erp/contratacoes/[id]` reconhecidas.

## Supabase isolado — bloqueio de infraestrutura

- Branch solicitada: `codex-erp-contratacoes-079`, branch id `811d5907-e58a-458d-8e35-38418749f1ae`, project ref `llvkybltnrmznvrntxng`.
- A criação foi explicitamente autorizada com cópia de Production, exclusivamente para homologação.
- O provisionamento terminou em `MIGRATIONS_FAILED` antes de disponibilizar as tabelas via REST. O mecanismo de branches tentou reconstruir a cadeia histórica antes de tornar a cópia utilizável; migrations antigas dependentes de dados impedem esse replay limpo.
- A branch Preview saudável `bfpgyralphzjozrcwjsn` foi auditada como alternativa, mas possui 076 e não possui 077. Ela foi rejeitada porque exigiria migrations inesperadas, contrariando a regra de aplicar somente 079 após alinhamento até 078.
- Uma consulta somente de schema confirmou que `status_operacional_erp` continua ausente em Production; portanto 079 não foi aplicada no principal.
- Nenhuma fixture foi criada, nenhum contrato real foi modificado e nenhuma integração externa foi disparada.
- O Vercel Preview não foi criado, pois não seria seguro permitir herança das credenciais de Production e a branch Supabase autorizada não ficou operacional.

## Pendências antes de produção

- Corrigir o provisionamento da branch Supabase (ou obter snapshot isolado comprovadamente alinhado até 078) sem reexecutar migrations históricas inesperadas.
- Aplicar 079 somente após `migration list` e dry-run mostrarem exclusivamente 079.
- Executar fixtures transacionais isoladas (novo cliente, cliente existente, retry, grupo pendente, comissão, venda compartilhada, documentos e cross-tenant).
- Homologar visualmente o Preview autenticado.
- Não aplicar migration em Produção, não mesclar `main` e não executar backfill sem autorização do proprietário.
