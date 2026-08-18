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

- Homologar visualmente o Preview autenticado.
- Não aplicar migration em Produção, não mesclar `main` e não executar backfill sem autorização do proprietário.

## Migration 080 — correção forward-only do trigger 071

### Auditoria anterior

- Trigger: `trg_contratacoes_sync_cliente`.
- Timing/eventos: `BEFORE INSERT OR UPDATE OF contrato_assinado`.
- Função: `sync_cliente_from_contratacao()`.
- Tabelas tocadas: `clientes`, `clientes_historico` e `contratacoes_online` por `NEW.cliente_id`.
- FK envolvida: `clientes_historico_contratacao_empresa_fkey (contratacao_id, empresa_id) → contratacoes_online(id, empresa_id)`.
- Causa: no `BEFORE INSERT`, a função criava/reutilizava o Cliente, preenchia `NEW.cliente_id` e tentava inserir o histórico antes da contratação existir fisicamente.

### Correção aplicada no Preview

- `080_fix_sync_cliente_contratacao_historico.sql` preserva o `BEFORE` apenas para identidade, deduplicação por empresa/documento e atribuição de `NEW.cliente_id`.
- O novo `trg_contratacoes_sync_cliente_historico` executa `AFTER INSERT OR UPDATE OF contrato_assinado, cliente_id`.
- `registrar_historico_cliente_contratacao()` grava o histórico somente após a persistência da contratação e usa `NOT EXISTS` por empresa, cliente, contratação e evento.
- INSERT já assinado e UPDATE `false → true` foram aprovados. Retry mantém o mesmo cliente e exatamente um histórico.
- A atomicidade permanece na mesma instrução/transação PostgreSQL; falha do AFTER reverte contratação e cliente.

### Aplicação e testes

- Dry-run da branch `bfpgyralphzjozrcwjsn`: exclusivamente `080_fix_sync_cliente_contratacao_historico`.
- Migration 080 aplicada e registrada somente no Preview; Production não foi alterada.
- Cenário que falhava: PASS após a 080 — contratação assinada cria exatamente um Cliente e um histórico válido.
- Matriz transacional com `ROLLBACK`: cliente novo, cliente existente, INSERT assinado, UPDATE de assinatura, documento ausente, cross-tenant, grupo pendente, produto ausente, consultor inválido, comissão ausente, comissão ambígua, Venda, Cota, previsões, rastreabilidade e retry/idempotência — PASS.
- Resíduos após rollback: 0 contratações, 0 clientes, 0 documentos e 0 operações idempotentes de fixture.
- Testes direcionados: 6 PASS. Suíte completa: 739 PASS / 37 SKIP em 133 arquivos aprovados e 9 ignorados.
- TypeScript: PASS. Build: PASS, 132 páginas. Lint do arquivo novo: PASS.
- O lint ampliado encontrou 9 usos históricos de `any` em `/erp/contratacoes/[id]`; não são introduzidos pela 080 e permanecem como dívida de lint da implementação 079.

### Risco de numeração

Na branch de Contratações, 079 é `erp_contratacoes_formalizacao_v1` e a correção é 080. A arquitetura corrente de outra linha de desenvolvimento reserva 079 para Catálogo Grupo N:N Modalidades. Nenhuma promoção ou merge deve ocorrer antes de reconciliar essa colisão de numeração.

### Reconciliação para Production

Antes do merge autorizado, `origin/main` foi reconsultado e já continha `079_financeiro_contas_pagar_governanca` e `080_catalogo_grupos_modalidades_produtos`. Sem alterar o SQL homologado, os arquivos desta entrega foram renumerados para `081_erp_contratacoes_formalizacao_v1` e `082_fix_sync_cliente_contratacao_historico`. Assim, 079/080 identificam apenas o histórico do ambiente Preview desta branch, enquanto 081/082 são os números finais destinados a Production.

## Vercel Preview isolado

- Projeto Vercel: `hugo-8097s-projects/guachinho-site`.
- Branch Git: `codex/erp-contratacoes-formalizacao-v1`.
- As variáveis `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` foram configuradas com escopo exclusivo `Preview (codex/erp-contratacoes-formalizacao-v1)`.
- `project_ref` validado programaticamente antes da configuração: `bfpgyralphzjozrcwjsn`. Nenhum valor de chave foi registrado.
- A service role permaneceu server-side, sem prefixo público e sem inclusão em arquivo ou commit.
- Deploys manuais preliminares confirmaram build remoto aprovado e alvo `preview`, mas não herdaram o filtro Git da branch. Por segurança, as variáveis não foram ampliadas para o Preview global.
- O deployment definitivo foi acionado pela integração Git da branch no commit `8b27e97`, ficou `Ready` com alvo `preview` e recebeu o alias branch-specific `guachinho-site-git-codex-erp-contrat-5ec28f-hugo-8097s-projects.vercel.app`.
- URL imutável homologada: `https://guachinho-site-9hgy9byfo-hugo-8097s-projects.vercel.app`.
- O login do usuário técnico criado apenas em `bfpgyralphzjozrcwjsn` foi aceito nesse deployment. A mesma credencial havia sido recusada nos deploys manuais sem contexto Git, comprovando que o Preview definitivo consumiu o override branch-specific e não a configuração global/Production.
- Homologação visual aprovada em `/erp/contratacoes`: navegação e cards da fila, busca/filtros, contratos assinados aguardando formalização e ação `Conferir e formalizar` renderizaram sem erro.
- Uma contratação sintética assinada `FIXTURE-PREVIEW-080` foi criada somente no Preview. O detalhe exibiu Cliente canônico reutilizado, documento privado sem cópia, documento ausente como pendência operacional, campos de Grupo/Produto/Consultor e botão de formalização bloqueado enquanto os requisitos estavam incompletos; não houve erro 500.
- Evidência visual: `docs/relatorios-fases/evidencia-erp-contratacoes-preview-080.png`.
- A contratação, Cliente, histórico, participante, vínculo, usuário Auth e demais registros técnicos foram removidos. Verificação final: zero resíduos de fixture.
- Production permanece sem alteração; nenhum domínio ou deployment de Production foi promovido.
