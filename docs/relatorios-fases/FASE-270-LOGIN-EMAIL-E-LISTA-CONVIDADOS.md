# Fase 270 — Login por e-mail e lista de convidados do indicador

## Entrega

- O login do app de indicação aceita CPF ou e-mail, sempre com a senha da mesma
  conta Auth já cadastrada.
- Usuários que já estejam autenticados no ERP não precisam criar uma conta
  paralela para acessar `/app-indicador`.
- O evento ativo do painel possui o botão **Lista de convidados**.
- A nova tela mostra apenas a lista cuja autoria é o usuário autenticado do
  indicador, com nome, empresa/telefone, presença, acompanhante e vagas.

## Escopo e segurança

O filtro de lista combina `evento_id` com `consultor_usuario_id` da sessão. Os
itens são consultados exclusivamente pela `lista_id` encontrada nesse escopo;
nenhuma lista de outro indicador é exposta.

## Validação

- Teste contratual de login por e-mail e escopo da lista própria.
- TypeScript, ESLint e build de produção executados.
