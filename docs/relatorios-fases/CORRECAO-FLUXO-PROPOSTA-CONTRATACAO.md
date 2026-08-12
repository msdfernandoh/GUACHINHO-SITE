# Correção do fluxo Proposta → Contratação

## Causa raiz

O wizard mantinha o início da simulação no navegador, porém a rota
`/api/public/contratacoes/rascunho/materializar` chamava `criarContratacaoOnline`
ao concluir CPF/CNPJ e endereço. Isso inseria `contratacoes_online` antes do
upload de documentos, da escolha de pagamento e da confirmação final. O modo
`sdr_link` também inseria diretamente em `contratacoes_online` ao gerar o link.

## Regra implementada

- nenhuma persistência quando a simulação é apenas aberta;
- proposta criada somente após nome e telefone válidos;
- CPF/CNPJ, endereço, documentos e pagamento permanecem associados à proposta;
- documento é válido somente após objeto e metadata persistidos com tamanho maior que zero;
- a finalização baixa novamente o objeto privado no backend, evitando aceitar metadata órfã;
- contratação criada exclusivamente pelo POST de confirmação final;
- backend revalida tenant, proposta, nome, telefone, e-mail, pessoa, endereço,
  grupo/cota, pagamento e pelo menos um documento;
- RPC transacional usa lock na proposta e vínculo único `proposta_id`, retornando
  a contratação existente em retry/double-click;
- status existentes preservados: `Gerada` durante preenchimento e `Enviada` após confirmação final;
- ERP Propostas continua exibindo propostas em andamento; ERP Contratações lista apenas registros formalizados com `finalizado_em`.

## Auditoria read-only de Produção

Executada em 11/08/2026 (`2026-08-12T00:49:38Z` UTC), sem alteração ou exclusão:

- propostas: 25;
- contratações: 11;
- documentos de contratação: 15;
- propostas sem nome: 9;
- propostas sem telefone: 9 (os mesmos nove IDs);
- contratações sem nome/telefone: 0;
- contratações sem documento persistido: 2;
- prováveis fixtures/homologação: 4 propostas; 0 contratações.

### Propostas sem nome/telefone

`149d6397-7f61-4b6a-851c-61479c71874c`, `9f841b9d-ebeb-407e-9a20-3bf8cc5e14a0`,
`5c94ddd1-ff69-402d-a42f-90398c9a05d4`, `7558096e-6592-4909-9d68-96ca66d3e1e9`,
`5d987ccb-0484-4afa-9015-fb2b95607ca6`, `21f6ce15-3003-4e90-9d71-2e4834982ca6`,
`0e749bfa-d477-4ba5-b4d9-a2799626c3b1`, `5b6d0066-df52-40a1-a94a-b631fb55cc1f`,
`a42ddd61-6385-4cf6-93eb-97042447ccfb`.

### Contratações sem documento persistido

- `9f94fd43-a84e-4680-bdb7-82d881dc2460` — `proposta_aberta`;
- `d5e3eaeb-2648-489c-9a5e-b7a1614989cb` — `dados_preenchidos`.

### Prováveis fixtures/homologação

`b5b34094-41fa-4e00-b543-00e57246d8ae`, `105522a9-e0ef-4474-92a3-2e0983aca834`,
`db167d10-1f5e-4123-905d-d33577ee7bbb`, `6535fffd-a4c6-494a-9b8a-4d811f7f1eea`.

Nenhum desses registros foi apagado ou modificado.

## Migration e arquivos

- `068_fluxo_proposta_contratacao_final.sql`, forward-only;
- adiciona token e preenchimento de contratação à proposta;
- cria `propostas_documentos` tenant-aware;
- adiciona vínculo único `contratacoes_online.proposta_id`;
- adiciona FKs compostas `(proposta_id, empresa_id)` em documentos e contratação;
- cria `rpc_finalizar_contratacao_proposta`, somente `service_role`;
- serviço: `gauchinho-app/src/lib/contratacoes-online/proposta-flow.ts`;
- rotas: `gauchinho-app/src/app/api/public/contratacoes/`;
- wizard: `gauchinho-app/src/components/contratacao/contratacao-wizard.tsx`;
- mínimo compartilhado: `gauchinho-app/src/lib/proposta/minimum.ts`.

## Testes e infraestrutura

- casos A–I: PASS em `proposta-finalizacao-contract.test.ts`;
- validação mínima: PASS em `minimum.test.ts`;
- suíte: 680 PASS / 37 SKIP;
- TypeScript: PASS;
- build: PASS, 120 páginas;
- Supabase isolado: `codex-fluxo-proposta-068-data-v2` (`with_data=true`), `ACTIVE_HEALTHY`;
- migration 068 isolada: aplicada e registrada na branch `codex-fluxo-proposta-068-data-v2`;
- teste SQL transacional: PASS; sem documento bloqueado, uma contratação em retry,
  cross-tenant bloqueado, documento copiado e zero fixtures após `ROLLBACK`;
- teste runtime no Preview: PASS; abertura vazia não persistiu, nome+telefone criaram
  somente proposta, finalização sem documento retornou erro, upload foi baixado novamente
  pelo backend e duas confirmações concorrentes retornaram a mesma contratação;
- limpeza do teste runtime isolado: zero propostas, contratações e documentos residuais;
- npm audit (registro oficial): PASS, 0 vulnerabilidades; lockfile atualizado somente com correções transitivas;
- branch: `codex/correcao-proposta-contratacao`;
- commit auditado: `43aa4ab`;
- Preview isolado: `dpl_DreFe5fBDYVtqTFHhA9bAPbXFEjL`, READY;
- Production: não alterada;
- smoke Production: pendente.

## Estado

Implementação local validada por testes e build. A declaração final de Produção
permanece bloqueada até migration isolada, Preview, aplicação autorizada já
condicionada aos gates, merge/deploy e smoke final.
