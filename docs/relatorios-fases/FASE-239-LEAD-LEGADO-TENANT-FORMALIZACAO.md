# Fase 239 — Reconciliação segura de lead legado na formalização

Data: 17/09/2026

## Problema

A contratação da cliente Mônica possuía um `lead_id` válido, mas o lead havia
sido criado pelo fluxo público histórico com `empresa_id` vazio. A proteção de
integridade multiempresa da tabela `vendas` rejeitou a formalização com “lead
não pertence ao tenant da venda”.

## Correção

A migration `229_adocao_segura_lead_legado_na_formalizacao.sql` mantém a
validação multiempresa estrita e adiciona uma reconciliação anterior à venda.
Um lead sem empresa só é associado quando está ligado a contratações de uma
única empresa. Se houver contratação do mesmo lead em outra empresa, a operação
continua bloqueada para análise manual.

O backfill encontrou 16 leads sem empresa, mas apenas um ligado a contratação;
esse vínculo era exclusivo da Gauchinho e não havia conflito entre tenants. Os
outros registros permaneceram intocados.

## Preservação

Nenhum lead é duplicado ou removido. O histórico, a contratação e o
participante selecionado são preservados, e a trigger de integridade da venda
continua ativa.
