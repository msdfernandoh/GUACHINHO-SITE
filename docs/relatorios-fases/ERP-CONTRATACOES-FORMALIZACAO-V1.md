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
- TypeScript: aprovado durante implementação.
- Testes SQL isolados, suíte completa, build, screenshots e URL do Preview serão registrados após implantação no Supabase isolado.

## Pendências antes de produção

- Aplicar 079 somente no Supabase isolado.
- Executar fixtures transacionais isoladas (novo cliente, cliente existente, retry, grupo pendente, comissão, venda compartilhada, documentos e cross-tenant).
- Homologar visualmente o Preview autenticado.
- Não aplicar migration em Produção, não mesclar `main` e não executar backfill sem autorização do proprietário.
