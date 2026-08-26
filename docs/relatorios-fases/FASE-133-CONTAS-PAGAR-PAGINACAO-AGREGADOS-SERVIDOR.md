# Fase 133 — Contas a Pagar com Paginação e Agregados no Servidor

Data: 26/08/2026  
Migration: `131_financeiro_contas_pagar_consulta_escalavel.sql`  
Estado: **implementada, aplicada e verificada no Supabase Production em 26/08/2026**.

## Objetivo

Eliminar o carregamento inicial de até 10.000 despesas, todos os movimentos de caixa e 500 logs. A interface passa a receber somente a página solicitada, enquanto totais, saldo, cards mensais e equalização dos sócios são calculados no banco sobre o conjunto integral da empresa.

## Contrato da consulta

`rpc_consultar_contas_pagar` exige sessão autenticada e vínculo de leitura na empresa. A função recebe filtros, ordenação e paginação e retorna:

- no máximo 100 despesas por página;
- contagem total independente da página;
- saldo contábil completo do caixa;
- cards de pagas, abertas, futuras e entradas do mês;
- composição completa das contas pagas pela empresa e pelos sócios;
- contas abertas atribuídas a cada sócio;
- auditoria paginada, limitada a 100 eventos por página;
- uso agregado de fornecedores para o autocomplete.

O cliente nunca informa ou escolhe `empresa_id`: ele é obtido do contexto tenant no servidor. A RPC repete a autorização com `can_read_tenant_internal` e todas as CTEs filtram a empresa explicitamente.

## Comportamento da interface

- filtros e busca consultam o servidor com debounce;
- paginação não recalcula saldo nem equalização sobre a página visível;
- a opção perigosa “Todas” foi removida;
- alterações financeiras invalidam e recarregam a consulta;
- a auditoria possui paginação própria;
- um indicador informa quando os dados estão sendo atualizados.

## Índices

Foram adicionados índices forward-only por empresa/status/vencimento, empresa/status/pagamento, banco/centro e sócio pagador. Nenhum dado histórico é alterado.

## Gates

- build Next.js, TypeScript e 146 rotas: aprovado;
- 17 testes focais: aprovados;
- suíte completa: 182 arquivos aprovados, 9 ignorados; 1.012 testes aprovados e 37 ignorados;
- compilação da migration em Production sob `BEGIN/ROLLBACK`: aprovada;
- teste da RPC com sessão tenant real: 25 de 84 despesas e 50 de 52 logs, com saldo, cards e balanço presentes;
- migration `131` aplicada e registrada no histórico remoto;
- pós-check: quatro índices e RPC presentes, execução concedida a `authenticated` e negada a `anon` e `service_role`;
- lint focal da UI: zero erros; lint global permanece com 175 erros históricos fora do escopo, sem impedir build ou testes.
- `main`: `ef49086ff3c7de93484fca1e3c8474365f01599f`;
- deployment Production: `dpl_91iYrPAuZhUgYfD28nNTwHD64Qqj`, estado `Ready`;
- smoke: domínio principal `200`; ERP e Platform anônimos redirecionados corretamente ao login.

Nenhum lançamento, movimento, log ou documento foi alterado pela migration.
