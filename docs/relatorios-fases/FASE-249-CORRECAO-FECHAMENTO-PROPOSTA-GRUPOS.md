# Fase 249 — Correção do Fechamento de Propostas por Grupos

## Incidente identificado

No fechamento da proposta pública, o mecanismo de unificação por telefone podia encontrar uma proposta legada criada pelo fluxo de PDF. Esses registros não possuem `public_token`, portanto não podem ser abertos pelo wizard em `/proposta/{token}`. A resposta retornava sem token e a interface apresentava a mensagem genérica **Falha ao criar proposta**.

## Correção aplicada

- A busca por proposta ativa do dia agora exige `public_token` preenchido.
- Registros legados continuam preservados e disponíveis para consulta no ERP, mas não são reutilizados no fluxo público de contratação.
- Ao existir somente uma proposta legada para o mesmo telefone, o wizard cria uma proposta nova com token público e prossegue normalmente.

## Validação

- Foi confirmada no banco a ocorrência de uma proposta recente de grupos sem `public_token` para o telefone usado no teste.
- Foi adicionado teste de contrato para impedir a remoção dos filtros de token público.
