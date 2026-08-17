# Manual — Catálogo de Administradora, Grupos e Produtos

## Fluxo operacional canônico

1. A Platform cadastra a Administradora global.
2. Dentro dela, cadastra os Tipos oficiais (por exemplo, Imóvel e Automóveis).
3. Cadastra as Modalidades de pagamento próprias da Administradora.
4. Configura e homologa as regras de comissão por Administradora + Tipo + Modalidade + vigência.
5. Cria o Grupo e escolhe exatamente um Tipo oficial.
6. Em **Platform → Grupos → Gerenciar catálogo**, habilita uma ou mais Modalidades disponíveis.
7. Na mesma tela, cria os Produtos comerciais/Cotas do Grupo (`grupos_cotas`). Eles não são cotas de clientes.
8. Informa o valor oficial da parcela para cada Modalidade habilitada. Os valores são manuais enquanto não houver fórmula oficial comprovada da Administradora.
9. Confere a seção **Validação de comissão**. Modalidades sem regra homologada deixam a configuração pendente.
10. A empresa consome o catálogo autorizado sem poder alterar Tipos, Modalidades, Produtos ou regras globais.
11. Na venda, escolhe Grupo → Produto → Modalidade. O sistema congela crédito, parcela e modalidade e resolve a regra vigente correspondente.

## Legado e segurança

`grupos_consorcio.modalidade_comissao_id` e as colunas históricas de parcela permanecem para compatibilidade. Não devem ser usadas para inferir a modalidade de uma venda nova. Seguro é uma dimensão adicional da parcela, não uma modalidade de comissão. Produto utilizado deve ser inativado, nunca apagado destrutivamente.

