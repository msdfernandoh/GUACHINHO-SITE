# Hotfix — ativação da Master com assinatura em rascunho (migration 157)

## Problema

O onboarding vincula o Plano SaaS à Master Franquia criando a assinatura no
status `RASCUNHO`. O HUB exibia corretamente o plano escolhido, mas a RPC de
ativação aceitava somente `ATIVA`, `TREINAMENTO` ou `PENDENTE`, produzindo uma
pendência contraditória no momento da ativação.

## Correção

A migration `157_fix_ativacao_master_assinatura_rascunho.sql` torna a ativação
explícita da Master o gate que efetiva a assinatura vinculada. A RPC:

- aceita `RASCUNHO` como assinatura válida já vinculada ao plano escolhido;
- mantém os gates de administradora ativa e usuário ativo;
- ativa empresa e assinatura na mesma transação;
- registra o identificador e a transição de status da assinatura na auditoria;
- preserva a execução exclusiva pelo Platform Superadmin autenticado.

Não há backfill, criação de assinatura, duplicação de plano ou alteração
histórica. Somente a assinatura selecionada é promovida quando a ativação for
explicitamente confirmada pelo operador.
