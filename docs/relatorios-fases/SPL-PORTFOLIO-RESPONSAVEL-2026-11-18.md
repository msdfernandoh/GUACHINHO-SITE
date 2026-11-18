# Painel de vendas pelo responsável da imobiliária

O botão **Painel de vendas** abre o portfólio comercial já usado pelo
vendedor. O servidor localiza o responsável pelo telefone cadastrado na
imobiliária. Se faltar seu registro de vendedor, o botão cria o vínculo
no modelo próprio e abre o portfólio correspondente. Pré-cadastros sem
nome ou telefone pedem que o cadastro seja completado.

A preparação do vendedor é feita sob demanda, usando o token do painel
na empresa ativa. Os clientes cadastrados pelo portfólio seguem o fluxo
existente de atribuição. Nenhuma migração é necessária.

Três testes confirmaram a seleção do responsável, a criação do vínculo
quando ausente e o tratamento de pré-cadastro incompleto.
