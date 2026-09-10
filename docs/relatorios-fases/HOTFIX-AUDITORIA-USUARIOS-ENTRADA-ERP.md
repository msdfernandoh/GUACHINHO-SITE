# Hotfix — auditoria de usuários e entrada segura no ERP

Data: 10/09/2026

## Escopo auditado

Foram conferidos no ambiente de produção os usuários de autenticação, os perfis
de negócio em `usuarios`, os vínculos N:N de `empresa_usuarios`, os papéis e
permissões canônicos, a configuração e a seleção individual de módulos do ERP,
as empresas ativas, os domínios e o site parceiro publicado.

O levantamento encontrou:

- 11 contas no Auth e 11 perfis de negócio, todos os perfis ativos com identidade
  correspondente no Auth;
- 13 vínculos ativos de empresa e 2 empresas ativas;
- 1 site parceiro publicado, com empresa anfitriã, responsável, domínio e vínculo
  administrativo válidos;
- nenhuma inconsistência nos usuários do site principal ou do site parceiro;
- vínculos históricos ativos para empresas inativas, preservados sem efeito no
  login porque a resolução canônica elimina empresas inativas ou suspensas;
- dois usuários operacionais, Laura Cervelheira e Enos, com módulos autorizados
  no ERP, mas sem o módulo `painel` na seleção individual.

## Causa do erro 404 da Laura

O botão **ERP Sistema** do painel administrativo apontava sempre para `/erp`.
Essa rota exigia especificamente o módulo `painel`. A Laura possui vínculo ativo
com a empresa Gauchinho, papel `consultor`, permissões comerciais e diversos
módulos operacionais autorizados, mas sua seleção individual não inclui
`painel`. Assim, o botão a enviava para uma rota que o próprio guard recusava
com 404, apesar de ela poder usar outras áreas do ERP.

## Correção

A entrada do ERP passa a ser calculada com a mesma matriz canônica usada pelos
guards e pelo menu interno. O painel permanece como destino preferencial quando
autorizado. Se ele não estiver disponível, `/erp` redireciona para o primeiro
módulo efetivamente autorizado. O botão **ERP Sistema** já recebe esse destino
calculado e só aparece quando existe ao menos uma rota acessível.

A correção não concede módulos, não muda papéis, não altera RLS e não modifica
dados de usuários. Laura passa a entrar por `/erp/leads`, módulo já atribuído e
permitido pelo papel dela. O mesmo mecanismo evita o 404 para Enos e impede que
usuários sem acesso efetivo vejam um atalho inválido.

## Validação

- testes unitários cobrem painel autorizado, fallback para o primeiro módulo e
  ausência total de destino;
- a seleção do destino usa `resolveAuthorizedErpUserAccess`, mantendo a
  interseção entre contratação da empresa, escolha individual, papel e
  permissões;
- nenhuma migration foi necessária porque a causa estava na navegação, e uma
  mudança de dados ampliaria o acesso da Laura ao painel sem necessidade.
