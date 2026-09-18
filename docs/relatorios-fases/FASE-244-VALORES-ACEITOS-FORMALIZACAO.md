# Fase 244 — Valores comerciais aceitos na formalização

Data: 18/09/2026

## Diagnóstico

A contratação `GC-2026-000007` foi assinada com 14 cotas de R$ 200.000, crédito
total de R$ 2.800.000 e primeira parcela total de R$ 16.445,10. A modalidade
Reduzida estava habilitada no grupo 1553, mas a preparação exigia uma linha em
`grupo_cota_modalidade_valores`, tabela auxiliar que não contém os valores da
maior parte do catálogo.

A auditoria encontrou 185 produtos ativos, dos quais 178 não possuem linha
ativa nessa tabela. Portanto, preencher apenas o produto da venda esconderia
uma inconsistência estrutural e repetiria o bloqueio em outros grupos.

## Correção

A migration `234_preparacao_preserva_valores_comerciais_aceitos.sql` restaura a
arquitetura definida na fase 138:

- confirma que produto e grupo são canônicos e ativos;
- confirma que a modalidade pertence à administradora e está habilitada para
  o grupo;
- usa `credito_selecionado` e `parcela_estimada` congelados na contratação;
- mantém os fallbacks equivalentes do snapshot assinado;
- deixa a cardinalidade e o crédito unitário para a RPC multicotas, que valida
  o total contra produto × quantidade.

Nenhum valor artificial foi inserido no catálogo e nenhum dado histórico foi
apagado.
