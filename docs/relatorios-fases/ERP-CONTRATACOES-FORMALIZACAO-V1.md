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

## Supabase isolado — repair e aplicação controlada

- Branch solicitada: `codex-erp-contratacoes-079`, branch id `811d5907-e58a-458d-8e35-38418749f1ae`, project ref `llvkybltnrmznvrntxng`.
- A criação foi explicitamente autorizada com cópia de Production, exclusivamente para homologação.
- O provisionamento terminou em `MIGRATIONS_FAILED` antes de disponibilizar as tabelas via REST. O mecanismo de branches tentou reconstruir a cadeia histórica antes de tornar a cópia utilizável; migrations antigas dependentes de dados impedem esse replay limpo.
- A branch Preview saudável e expressamente autorizada `bfpgyralphzjozrcwjsn` tinha o conteúdo material da correção operacional aplicado, mas registrado no metadata antigo como `077_fix_076_fluxo_administradora_operacional` (50 statements). O conteúdo material da 077 atual ainda não existia.
- Production foi consultada somente por `SELECT`: seu histórico confirmou `077_erp_importacao_socios_permissoes` e `078_fix_076_fluxo_administradora_operacional`, com os dois marcadores materiais presentes.
- O repair alterou exclusivamente o metadata da branch isolada, de 077 para `078_fix_076_fluxo_administradora_operacional`; os 50 statements não foram reexecutados e nenhum repair foi feito em Production.
- A 077 atual foi aplicada uma única vez na branch e registrada como `077_erp_importacao_socios_permissoes`. A validação posterior encontrou 78 versões, nenhuma lacuna em 001–078 e os mesmos nomes 077/078 de Production.
- O dry-run retornou exclusivamente `079_erp_contratacoes_formalizacao_v1`. A 079 foi então aplicada e registrada somente em `bfpgyralphzjozrcwjsn`.
- O primeiro teste transacional de cliente novo descobriu um defeito anterior à 079: `sync_cliente_from_contratacao()` é `BEFORE INSERT`, mas tenta inserir `clientes_historico` com FK para a contratação ainda não materializada. PostgreSQL abortou com FK `clientes_historico_contratacao_empresa_fkey`; a transação foi revertida e não deixou fixture residual.
- A bateria foi interrompida nesse ponto. Cliente existente, retry, venda/cota, comissões, cross-tenant e rastreabilidade ponta a ponta ainda precisam ser reexecutados após correção autorizada do trigger da migration 071.
- O bucket `contratacoes-documentos` foi confirmado privado. Nenhum contrato real clonado foi formalizado ou modificado, e nenhuma integração externa foi disparada.
- O Vercel Preview e a homologação visual permanecem pendentes; não houve herança das credenciais de Production.

## Pendências antes de produção

- Criar uma migration forward-only para corrigir a ordem do trigger `sync_cliente_from_contratacao()` sem reescrever a 071; exige autorização antes de qualquer alteração.
- Reexecutar fixtures transacionais isoladas (novo cliente, cliente existente, retry, grupo pendente, produto ausente, consultor inválido, comissão ausente/ambígua, documentos e cross-tenant).
- Homologar visualmente o Preview autenticado.
- Não aplicar migration em Produção, não mesclar `main` e não executar backfill sem autorização do proprietário.
