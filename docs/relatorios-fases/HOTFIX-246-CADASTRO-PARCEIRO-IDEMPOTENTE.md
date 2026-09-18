# Hotfix 246 — Cadastro de Parceiro Idempotente

## Problema

Após uma tentativa de cadastro, um novo envio com o mesmo CPF podia retornar erro de duplicidade e impedir a continuação dos testes, mesmo quando a intenção era somente corrigir PIX ou dados comerciais.

## Correção

- O endpoint `cadastrar_parceiro` localiza primeiro o indicador pelo CPF e empresa.
- Quando já existe, atualiza os dados de contato, PIX, qualificação, origem/UTM e modelo de interesse em vez de criar outra conta.
- O participante comercial relacionado recebe atualização de nome e telefone.
- Solicitações de modelos que exigem aprovação são gravadas de forma idempotente.
- A interface informa **Cadastro atualizado** e oferece o acesso ao painel mobile.

## Segurança

A senha e a identidade autenticada preexistentes não são modificadas por um reenvio público. O tratamento continua tenant-aware por `empresa_id`; não há atualização de registros de outra empresa ou concessão de permissões.
