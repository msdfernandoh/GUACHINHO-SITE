# ERP Financeiro — contas a pagar e caixa

## Escopo

- cadastro de contas bancárias e centros de custo;
- lançamento de despesas com vencimento, fornecedor e competência;
- baixa de conta gera saída append-only no livro razão somente quando paga pela empresa;
- checkbox de pagamento pessoal por sócio; esse lançamento não reduz o caixa empresarial;
- fechamento mensal mostra reembolso devido pela empresa e ajuste igualitário entre sócios que adiantaram despesas;
- interface responsiva com cards grandes e atalhos para uso diário.

## Segurança

As tabelas são tenant-aware, com RLS explícita de leitura/escrita por empresa. O RPC de baixa valida tenant e mantém `caixa_movimentos` imutável.

## Estado

Migration `075_financeiro_operacional_contas_pagar.sql` está versionada e ainda requer aplicação explícita no Supabase.
