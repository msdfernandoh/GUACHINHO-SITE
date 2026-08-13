# ERP — usuários existentes como participantes

## Objetivo

Exibir no ERP os usuários ativos já associados a cada empresa, sem duplicar identidade nem criar credenciais paralelas.

## Migration 074

- percorre somente `empresa_usuarios` e `usuarios` ativos;
- reutiliza participante ativo já vinculado ao mesmo usuário/tenant;
- cria participante somente quando não existe vínculo operacional ativo;
- atribui uma atuação inicial pelo perfil atual e mantém sincronização para novos vínculos;
- não inativa, exclui ou reclassifica registros históricos existentes.

## Interface

O ERP passa a abrir Participantes comerciais quando `participantes_comerciais` existir; a flag histórica deixa de bloquear a tela.
