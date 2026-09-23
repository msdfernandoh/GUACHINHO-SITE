# Fase 278 — Adoção auditável de lead legado

Data: 23/09/2026

## Incidente

Ao gerar uma proposta pelo site para um lead histórico sem `empresa_id`, o gatilho de proteção de escopo bloqueou a atualização e retornou `empresa_id não pode ser alterado fora do CRM staff`.

## Correção

- A migration 256 cria `leads_legacy_adocoes_tenant`, uma trilha de auditoria com `lead_id`, `empresa_id`, origem e data.
- A RPC privada seleciona apenas lead legado ativo para o telefone, registra a autorização do par e então executa a única transição permitida: `empresa_id NULL` para a empresa resolvida pelo host.
- O gatilho passa a permitir somente essa transição previamente autorizada. Trocas entre tenants permanecem bloqueadas.
- A aplicação não tenta mais adotar `empresa_id` no fallback. Se a RPC retornar erro, a proposta falha com a causa real sem alteração de escopo fora do banco.

## Preservação

Não há exclusão nem backfill. A tabela de auditoria é removida automaticamente se o lead for excluído, por chave estrangeira com `ON DELETE CASCADE`.
