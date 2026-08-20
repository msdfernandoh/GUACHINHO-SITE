# ERP Financeiro — governança de contas pagas e a pagar (Fase 079 & Fase 101)

## Escopo e Regras Operacionais

- Período por vencimento ou pagamento;
- Filtros avançados por situação, banco, centro de custo e sócio pagador;
- **Edição de Contas:** Operadores financeiros podem editar contas abertas e dados cadastrais informativos de contas pagas (descrição, fornecedor, centro de custo, conta bancária, observação) registrando log detalhado com `campos_alterados`;
- **Exclusão de Contas:** 
  - Contas abertas (A Pagar) podem ser excluídas por operadores com motivo obrigatório (mín. 3 caracteres).
  - Contas pagas só podem ser excluídas exclusivamente pelo usuário **Master**, com motivo obrigatório e estorno reverso no caixa. Consultores/usuários comuns são bloqueados com mensagem explicativa no modal.
- **Estorno de Contas Pagas:** 
  - Permissão concedida a usuários Master ou consultores/usuários autorizados via flag `pode_estornar_contas` na tabela `empresa_usuarios` (configurável na tela de gestão de Usuários/Consultores no Admin);
  - Reverte o status para "A Pagar", desfaz a liquidação, gera movimento contábil de estorno no caixa e registra log de auditoria com motivo obrigatório.
- **Aba de Utilização (Log de Auditoria):**
  - Visível para todos os operadores do Contas a Pagar na empresa ativa;
  - Exibe histórico com data/hora, autor (nome e e-mail), ação (`CRIACAO`, `ALTERACAO`, `BAIXA`, `ESTORNO`, `EXCLUSAO`), fornecedor, valor, motivo informado e badges de campos alterados;
  - Filtros por ação, período de datas e busca por texto livre.

## Preservação Financeira e Imutabilidade

O caixa permanece append-only e transacional. Estorno e exclusão de despesa paga pela empresa criam uma entrada inversa com origem `estorno_conta_pagar`. A exclusão altera a despesa para `cancelada`, preservando registro histórico, autor e motivo.

## Balanço entre Fernando e Eroni

- Os cards exibem quanto cada sócio pagou, o débito total da empresa e a cota individual de 50%;
- O acerto em dinheiro equivale à metade da diferença entre os pagamentos, pois a transferência reduz um saldo e aumenta o outro simultaneamente;
- Como alternativa, o sócio que pagou menos pode assumir novas despesas no valor integral da diferença;
- Os cards de despesas e do balanço entre sócios acompanham período, tipo de data, situação, banco, centro de custo e sócio selecionados;
- O balanço entre sócios respeita integralmente os filtros; o saldo contábil geral permanece exibido separadamente como informação auxiliar.
- A listagem é ordenada por vencimento crescente;
- Os cards operacionais mostram pagas no mês atual, a pagar no mês atual, contas futuras a pagar e entradas de caixa no mês atual; banco, centro de custo e sócio continuam aplicados aos três cards de despesas;
- Cada card é clicável e filtra a listagem correspondente; o card de entradas troca a lista de despesas pelos movimentos de entrada do mês e um segundo clique remove o atalho.

## Validação e Estado

- Migration `101_contas_pagar_governanca_permissoes_estorno.sql` criada com DDL, RPCs seguras e RLS auditável;
- Testes automatizados contratuais em `src/lib/erp/financeiro-contas-governanca-contract.test.ts` 100% aprovados;
- Suíte completa de 909 testes passando sem regressões;
- Checagem estática TypeScript (`npx tsc --noEmit`) 100% limpa sem erros.

