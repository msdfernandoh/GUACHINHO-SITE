# Fase 190 — Exclusão em lote antes da cota

## Objetivo

Permitir que o Master da empresa selecione e retire várias propostas ou contratações da fila operacional, sem permitir exclusão depois da geração de venda/cota.

## Implementação

- seleção múltipla nas telas ERP de Propostas e Contratações;
- confirmação explícita e retorno do resultado sem sair da página;
- autorização canônica para `admin_empresa` ou superadministrador da plataforma;
- RPC transacional, limitada ao tenant e a 200 registros por operação;
- bloqueio de qualquer proposta ou contratação vinculada a `vendas`;
- exclusão lógica com autor, data, motivo e auditoria central, preservando documentos e histórico;
- itens excluídos deixam de aparecer nas listas e não podem ser abertos pela rota de formalização.

## Segurança e integridade

A interface não decide se um registro pode ser excluído. A RPC bloqueia a transação inteira se um único ID não pertencer ao tenant, já estiver excluído ou já possuir venda/cota. Isso evita exclusão parcial e contorno por chamada direta.

## Validação

- contrato automatizado `exclusao-lote-pre-cota-190-contract.test.ts`;
- verificação TypeScript/lint;
- build de produção.
