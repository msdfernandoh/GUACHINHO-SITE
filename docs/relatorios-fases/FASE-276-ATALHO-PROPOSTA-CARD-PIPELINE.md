# Fase 276 — Atalho de proposta no card do Pipeline CRM

Data: 23/09/2026

## Entrega

O rodapé de cada card do Pipeline CRM agora possui o botão **Proposta**. Ele abre `/grupos` em nova aba, preservando o Pipeline aberto para o consultor.

## Segurança e vínculo

- A URL recebe apenas `lead_id`; nome e WhatsApp não são expostos no histórico, nos favoritos ou em logs de URL.
- A tela de grupos carrega o lead somente para sessão com permissão de gerar propostas e somente no tenant resolvido pelo host, aceitando registro legado sem empresa apenas para a reconciliação canônica já existente.
- Nome e WhatsApp são preenchidos no modal de geração do PDF. A emissão usa a consolidação por telefone e associa a proposta ao mesmo lead ativo; venda ganha continua abrindo uma negociação nova.

## Validação planejada

- O botão usa `target="_blank"` com `noopener noreferrer`.
- A consulta de prefill restringe `id` e `empresa_id` ao tenant atual, sem confiar em dados de contato enviados pelo navegador.
