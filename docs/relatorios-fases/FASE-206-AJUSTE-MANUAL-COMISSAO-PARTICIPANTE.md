# Fase 206 — Ajuste manual auditado da comissão do participante

## Objetivo

Permitir a correção excepcional de previsões migradas cujo antigo campo de comissão
a pagar resultou em elegibilidade zero na tela Comissões da empresa.

## Entrega

Cada comissão de participante possui **Editar manualmente**, com valor gerado, valor
disponível e motivo obrigatório. A RPC tenant-aware executa a alteração em uma única
transação e recalcula o status da previsão.

## Proteções

- o disponível não pode exceder o gerado;
- gerado e disponível não podem ficar abaixo do valor já pago;
- valor pago nunca é alterado;
- previsões suspensas ou canceladas não são ajustáveis;
- valores anteriores e novos, motivo, usuário e data ficam no snapshot e em
  `audit_logs_central`;
- Comissões da empresa, Minhas comissões e Financeiro são revalidados.

## Validação

Contrato automatizado, TypeScript e build de produção.
