# Aceite dos termos de imobiliária e vendedor no SPL

O painel abre o termo aplicável após salvar a edição da imobiliária. O
aceite vale para a versão e o modelo exibidos. Se o modelo mudar, a
imobiliária deve aceitar o termo correspondente. O PDF e o painel
administrativo conferem o mesmo vínculo.

Vendedores com modelo remunerado usam o termo vigente da área logada do
Seja Parceiro na empresa. Pelo convite, o vendedor lê e marca **Li e aceito**
no cadastro. Se a imobiliária cadastrar o vendedor, recebe o link individual
para que ele marque o aceite no próprio painel. O modelo próprio segue sem
termo de remuneração do Seja Parceiro.

A migration 352 foi aplicada isoladamente no Supabase de produção em
18/11/2026 e registrada no histórico. A verificação confirmou as cinco
colunas esperadas e a preservação do aceite anterior da imobiliária.
O esquema da API foi recarregado antes do envio do código.
