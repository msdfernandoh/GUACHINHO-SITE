# Fase 273 — Exclusão de leads com convites Network

A exclusão individual e em lote de leads passou a remover também os registros dependentes em `programa_convites_network`. A migration `254_leads_exclusao_cascata_convites_network.sql` altera a chave estrangeira para `ON DELETE CASCADE`, preservando a integridade referencial e eliminando o bloqueio causado por `ON DELETE RESTRICT`.

As Server Actions também removem explicitamente esses vínculos como compatibilidade para ambientes cuja migration ainda não tenha sido aplicada.
