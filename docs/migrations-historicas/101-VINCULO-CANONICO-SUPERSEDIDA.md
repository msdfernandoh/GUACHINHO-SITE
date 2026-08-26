# Migration 101 de vínculo canônico — registro histórico

O repositório possuía duas migrations locais com o mesmo prefixo `101`:

- `101_contas_pagar_governanca_permissoes_estorno.sql`;
- `101_vinculo_canonico_saas_grupos_cotas_vendas.sql`.

O Supabase registra uma única migration por versão. A implementação de vínculo
canônico de grupos, cotas e vendas foi posteriormente revisada e supersedida
pelas migrations `126_hardening_multitenant_escala_franquias.sql` e
`127_formalizacao_canonica_e_comissoes_estritas.sql`, que são o contrato vigente.

Por isso, o arquivo duplicado foi removido da pasta ativa de migrations durante
a reconciliação da fase 135. Seu conteúdo permanece integralmente recuperável no
histórico Git, principalmente nos commits `9d828a8`, `863648f` e `14b4da1`.

Esta decisão não removeu objetos ou dados do banco. A auditoria de sentinelas
confirmou o conversor canônico atual e a migration `133` não sobrescreveu a
formalização das migrations `126–127`.
