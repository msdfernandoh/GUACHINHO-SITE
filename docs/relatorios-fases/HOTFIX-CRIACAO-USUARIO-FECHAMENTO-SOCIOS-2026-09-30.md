# Hotfix — Criação de usuário com menu Fechamento dos Sócios

Data: 30/09/2026

## Diagnóstico

O Master da Sorriso possui `gerenciar_usuarios` e a página de usuários carrega
normalmente. Os papéis `admin_empresa`, `consultor`, `visualizador`,
`parceiro_imobiliaria` e `parceiro_comercial` estão ativos no banco.

Ao criar um usuário, o formulário envia os menus ERP habilitados para a
empresa. Como a Sorriso possui o módulo Financeiro, a lista inclui o ID
`conta-corrente-socios`, apresentado como **Fechamento dos Sócios**. A constraint
introduzida pela migration 077 não incluía esse ID, e o `INSERT` em
`empresa_usuarios` era recusado. Portanto, o incidente não era de permissão.

## Correção

A migration 301 recria exclusivamente a constraint
`empresa_usuarios_erp_modulos_visiveis_check`, preservando os IDs já permitidos
e acrescentando `conta-corrente-socios`.

Enquanto o histórico remoto não puder receber a migration isoladamente, a
Server Action trata somente a violação dessa constraint antiga e repete a
gravação sem o atalho de Fechamento dos Sócios. Assim, o usuário e seu vínculo
N:N são criados sem abrir permissões adicionais nem retornar erro 500. Quando
a migration 301 for aplicada por uma janela de banco reconciliada, a primeira
tentativa já preservará esse menu individual.

## Segurança e dados

- O vínculo continua usando o tenant resolvido no servidor e o papel N:N.
- A migration não atualiza nenhum vínculo existente.
- Aceitar o identificador na constraint não concede acesso: autorização final
  permanece na interseção de módulo contratado, papel e permissões.
- A mudança é forward-only e reversível operacionalmente por outra migration
  corretiva, sem apagar dados.
