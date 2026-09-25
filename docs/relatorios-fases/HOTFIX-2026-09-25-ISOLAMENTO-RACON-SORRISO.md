# Hotfix de segurança — Isolamento da Racon Sorriso

Data: 25/09/2026.

## Incidente e causa

O dashboard no host `raconsorriso.com.br` exibia totais e linhas de clientes de outra master. A consulta do pipeline já aplicava `empresa_id`, mas o dashboard consultava leads, propostas, grupos e cotas sem escopo de empresa. No banco, políticas `leads_staff` e `propostas_staff` baseadas apenas em `is_staff()` autorizavam leitura cruzada para perfis internos, inclusive `visualizador`.

## Evidência em produção

- A empresa `sorriso` é independente e possui 0 leads e 0 propostas próprios.
- A empresa `gauchinho` possui 122 leads e 104 propostas identificados, além de 18 leads e 5 propostas históricos sem `empresa_id`.
- Antes da correção, uma sessão autenticada vinculada à Sorriso enxergava 140 leads e 110 propostas. Depois da migration 289, a mesma sessão enxergou 0 leads e 0 propostas. A sessão master da Gauchinho continuou enxergando 140 leads e 110 propostas.
- A migration 290 foi aplicada em produção. `has_function_privilege` confirmou `false` para `anon` e `authenticated` e `true` para `service_role` nas três funções de upsert envolvidas.

## Alterações

1. A migration 289 restringe RLS de leads, propostas e histórico ao tenant do usuário, reservando linhas legadas sem empresa à Gauchinho.
2. A migration 290 fecha as RPCs privilegiadas a chamadas diretas de clientes e impede que outra master adote lead legado por coincidência de telefone.
3. O dashboard e consultas de CRM recebem escopo obrigatório da empresa ativa. Ações de leitura e escrita por ID verificam a propriedade do lead; ações em lote validam todos os IDs. O fallback de upsert não busca linhas legadas fora da Gauchinho.
4. A conversão de contato em lead resolve usuário e empresa no servidor antes de usar a RPC privilegiada.

Nenhum registro de cliente foi movido ou excluído. Racon Sinop permanece fora deste hotfix; sua relação comercial com Gauchinho deve ser avaliada na configuração de parceiro, sem misturá-la à master independente Sorriso.

## Validação

- Supabase SQL Editor: simulação das sessões Sorriso e Gauchinho antes e depois da migration 289; inspeção das permissões efetivas após a migration 290.
- `npx tsc --noEmit`, ESLint sem erros, 12 testes de upsert de leads e `npx next build --webpack` aprovados. O build Turbopack local não iniciou porque o `node_modules` do worktree é um symlink fora da raiz que ele aceita.
