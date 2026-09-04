# Hotfix — Upload de mídia no editor de modelos Platform

## Objetivo

Corrigir o envio de imagens no editor de modelos para que a arte de uma marca própria possa substituir mídia herdada sem causar erro de React no navegador.

## Implementação

- A chamada da Server Action `uploadTemplateMediaPlatformAction` passou a ser executada dentro de `startTransition` no componente cliente `MediaFieldControl`.
- O upload preserva a autorização existente de `PLATFORM_SUPERADMIN`, a validação de tipo/tamanho e o caminho tenant/template-scoped no bucket `site-template-assets`.
- Não houve migration, alteração de RLS, mudança de dados comerciais, nem reescrita de mídia existente.

## Validação

- Lint direcionado do componente: aprovado com `npx eslint --quiet src/components/platform/media-field-control.tsx`.
- O cenário manual que antes exibia o erro React #441 é coberto pelo contexto de transição exigido pelo React/Next para a execução de Server Functions a partir de evento do cliente.

## Rollback

A reversão é somente de aplicação: restaurar a chamada direta anterior. Não há mudança de banco, Storage ou dados persistidos a reverter.
