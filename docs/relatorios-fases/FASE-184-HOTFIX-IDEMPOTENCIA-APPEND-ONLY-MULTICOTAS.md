# Fase 184 — Hotfix de idempotência append-only na formalização multicotas

## Incidente

Depois da liberação do evento `COTAS_DEFINITIVAS_GERADAS`, a formalização de
duas cotas alcançou a etapa seguinte e foi revertida pelo trigger append-only de
`operacoes_idempotentes`. A RPC multicotas tentava atualizar a resposta gravada
pelo conversor canônico.

## Correção

A migration `181_corrige_idempotencia_append_only_formalizacao_multicotas.sql`
remove exclusivamente o `UPDATE` incompatível da função já instalada. A
proteção append-only permanece intacta. Em repetição, a RPC consulta a venda e
reconstrói a resposta final a partir de `cotas_definitivas`, mantendo uma venda
com N cotas e sem reescrever o ledger de idempotência.

## Preservação

- nenhum trigger ou privilégio append-only foi relaxado;
- nenhuma venda, cota ou operação idempotente existente é alterada;
- a migration falha de forma explícita se a função remota não tiver exatamente
  o bloco esperado, evitando alteração silenciosa de outra versão.

