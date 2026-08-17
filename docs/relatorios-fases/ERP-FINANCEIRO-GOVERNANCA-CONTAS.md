# ERP Financeiro — governança de contas pagas e a pagar

## Escopo

- período por vencimento ou pagamento;
- filtros por situação, banco, centro de custo e sócio;
- alteração, estorno, exclusão lógica e log detalhado exclusivos do master vinculado como `admin_empresa` no tenant;
- motivo obrigatório na exclusão;
- auditoria com data, usuário, fornecedor, despesa, valor, motivo e campos alterados.

## Preservação financeira

O caixa permanece append-only. Estorno e exclusão de despesa paga pela empresa criam uma entrada inversa com origem `estorno_conta_pagar`. A exclusão altera a despesa para `cancelada`, preservando registro, autor e motivo. Em despesas pagas, valor e forma de pagamento permanecem imutáveis até o estorno.

## Validação e estado

- migration 079 aplicada no Supabase principal em 17/08/2026; histórico local/remoto sincronizado de 001 a 079;
- 736 testes aprovados e 37 ignorados;
- TypeScript e ESLint aprovados;
- build de produção aprovado com Webpack (131 páginas); o Turbopack não foi usado na worktree porque o `node_modules` é um symlink externo ao seu filesystem root.
