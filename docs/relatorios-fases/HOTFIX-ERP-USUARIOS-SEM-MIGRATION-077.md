# Hotfix — Usuários e ERP antes da migration 077

Data: 14/08/2026

## Incidente confirmado

O código publicado passou a consultar `empresa_usuarios.socio_pagador` e
`empresa_usuarios.erp_modulos_visiveis` antes da aplicação da migration 077 no
Supabase principal. A consulta somente leitura ao ambiente configurado retornou
`42703` para `socio_pagador`, confirmando a divergência de schema.

O mesmo erro causava os dois sintomas:

- `/admin/usuarios` lançava erro no servidor ao listar os vínculos;
- a resolução do tenant convertia o erro em uma lista vazia de vínculos, fazendo
  o ERP redirecionar o master para `/admin`.

## Correção

- A resolução do tenant tenta os campos 077 e, apenas quando identifica
  especificamente essas colunas ausentes, repete a consulta com o contrato
  legado.
- No fallback, `erp_modulos_visiveis = null` preserva todos os módulos já
  habilitados para a empresa; não concede módulo que o tenant não possua.
- A listagem de usuários usa o mesmo fallback e não oculta erros de permissão ou
  falhas de outras colunas.
- Criação e edição continuam salvando os dados legados. Os campos de sócio e
  menu individual são ignorados com aviso explícito enquanto a migration 077
  estiver pendente.

## Segurança e dados

- Nenhuma migration foi aplicada e nenhum registro foi alterado durante o
  diagnóstico.
- A consulta ao Supabase foi somente leitura.
- O fallback não contorna RLS, não troca empresa e não concede acesso fora da
  configuração ERP do tenant.
- A migration 077 continua necessária para sócios pagadores, permissões
  individuais e importação financeira; sua aplicação em Produção exige etapa
  operacional separada.

## Validação

- TypeScript: aprovado.
- Testes direcionados de compatibilidade e acesso ERP: aprovados.
- Suíte completa: 725 testes aprovados e 37 testes existentes ignorados.
- Build de produção com Webpack: aprovado, com 127 rotas geradas.
- ESLint dos arquivos alterados: aprovado sem erros ou avisos.
- `git diff --check`: aprovado.
