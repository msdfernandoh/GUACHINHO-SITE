# Fase 171 — Portais de parceiros com ERP compartilhado

## Objetivo

Concluir a atribuição de origem dos novos sites de parceiros sem alterar os
domínios, sites, registros ou permissões já existentes.

## Decisão de arquitetura

Um site de parceiro é um portal comercial subordinado à empresa/franquia. O
domínio identifica o portal e a organização parceira; o ERP, catálogo, usuários
internos e dados financeiros continuam pertencendo à `empresa_id` da franquia.

ERP próprio não é criado dentro de `parceiro_sites`: é uma nova Master Franquia,
com `empresas`, vínculo N:N em `empresa_usuarios`, domínio institucional e
publicação próprios. Assim não há empresa duplicada nem mistura de permissões.

## Implementação

- A resolução pública do domínio do parceiro permanece validada no servidor.
- Chamadas `/api/*` em um domínio de parceiro deixam de ser reescritas para a
  página institucional; chegam ao handler original com o contexto interno.
- `authorizePublicIngress` resolve novamente o domínio no servidor quando ele
  for de parceiro; nenhum UUID de empresa, site ou organização fornecido pelo
  navegador é aceito como autoridade.
- Leads de especialista e indicações agora gravam `parceiro_site_id` e
  `organizacao_parceira_id` somente quando o host resolvido comprovar esse
  vínculo. A área do parceiro já filtra pelo vínculo da organização e, por isso,
  exibe apenas seus próprios registros e os originados no próprio portal.

## Preservação e rollout

- Não há migration nem backfill: os campos canônicos já foram introduzidos pela
  migration `045_participantes_organizacoes_parceiro_sites`.
- Linhas históricas permanecem com origem nula/legada e não mudam de visibilidade.
- O comportamento novo só é acionado em hosts de parceiro publicados e com
  `FASE3_PARCEIRO_PUBLIC_SITE_ENABLED=true`.
- Rollback operacional: desligar a flag; não há dado a desfazer.

## Validação

- TypeScript sem emissão.
- ESLint sem erros nos arquivos modificados.
- Fluxo preservado para hosts institucionais, pois a resolução normal de tenant
  continua sendo a primeira tentativa.
