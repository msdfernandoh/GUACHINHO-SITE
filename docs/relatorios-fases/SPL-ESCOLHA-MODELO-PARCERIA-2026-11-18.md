# Escolha do modelo de parceria na edição SPL

A edição do painel oferece os modelos para imobiliárias pendentes ou
recusadas e permite completar cadastros aprovados sem modelo registrado.
A gravação preserva o status e protege os modelos já definidos em
cadastros aprovados. O formulário e a API usam a mesma regra.

A gravação exige que o status e o modelo originais ainda coincidam com
o cadastro, para que uma edição simultânea não sobrescreva a aprovação
ou a escolha de outra pessoa. Ao mudar o modelo, uma remuneração
incompatível de vendedor volta ao modelo próprio.

Dois testes cobrem a escolha antes da aprovação e a proteção do modelo
aprovado. Sem migração ou escrita de dados em produção.
