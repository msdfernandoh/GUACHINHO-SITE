# Hotfix 245 — Perfil `parceiro` no Supabase de Produção

## Incidente

O cadastro público do Programa de Parceiros criava corretamente o usuário de autenticação, mas falhava ao inserir o registro em `public.usuarios` com a mensagem `usuarios_perfil_check`. A interface exibia o erro técnico ao visitante na última etapa do cadastro.

## Causa confirmada

Consulta direta e somente leitura ao banco de produção confirmou que a constraint `usuarios_perfil_check` ainda aceitava apenas `master`, `srd`, `imobiliaria` e `visualizador`. A migration versionada `232_usuario_parceiro_perfil_legado_seguro.sql` ainda não constava no histórico remoto.

## Correção aplicada

- Executada em produção a alteração forward-only da migration 232: substituição da constraint para incluir o perfil legado técnico `parceiro`.
- Registrada a migration `232` como aplicada no histórico do Supabase, após a execução bem-sucedida do mesmo SQL.
- Verificação pós-aplicação confirmou a definição contendo `parceiro`.

## Segurança

O hotfix não alterou papéis, permissões, RLS, módulos ou dados existentes. `parceiro` é somente o valor de compatibilidade em `usuarios.perfil`; o acesso do indicador continua derivado de `empresa_usuarios`, do papel vinculado e de `erp_modulos_visiveis`.
