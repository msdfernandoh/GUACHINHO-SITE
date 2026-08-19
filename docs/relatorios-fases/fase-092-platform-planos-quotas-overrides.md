# Relatório de Execução — Fase 092: Motor Comercial de Planos SaaS, Assinaturas, Quotas e Overrides

**Data:** 18/08/2026  
**Status:** CONCLUÍDO / PUBLICADO  
**Migration Aplicada:** `092_platform_planos_limits_overrides_v2.sql`  

---

## 1. Escopo e Objetivos Atingidos

1. **Catálogo Global ERP:**
   - Adicionado botão e modal de criação de novos módulos (`+ Novo Módulo`) via `rpc_platform_criar_modulo_catalogo`.
   - Edição, ativação/inativação em 1 clique e ordenação padrão de exibição.
   - Resolução de dependências em cascata.

2. **Planos SaaS (CRUD Completo e Detalhe em 8 Abas):**
   - Criação (`+ Novo Plano`), edição, duplicação e exclusão segura (`rpc_platform_excluir_plano`).
   - Bloqueio estrito de exclusão destrutiva caso existam assinantes ativos vinculados.
   - Workspace em 8 abas: Geral, ERP & Módulos, Usuários, Site Principal, Sites de Parceiros, Valores, Empresas/Assinaturas, Histórico.

3. **Assinaturas SaaS & Quotas:**
   - Gestão operacional de contratos de Master Franquias vinculando plano, quantidade contratada de usuários, sites de parceiros e domínios próprios.
   - Bloqueio automático no backend quando a quantidade contratada excede o limite máximo permitido pelo Plano (`contratado > limite`).

4. **Sites e Domínios de Parceiros:**
   - Parceiro pertence à Master Franquia (não cria tenant, não cria nova empresa nem nova assinatura).
   - Reutilização da infraestrutura unificada de domínios (subdomínio ou domínio próprio).
   - Precificação diferenciada por site com ou sem domínio próprio.

5. **Onboarding da Master Franquia Conectado ao Plano:**
   - Herança automática de entitlements de ERP, módulos, limites de usuários, templates de site e limites de parceiros.
   - Resumo financeiro detalhado em tempo real na etapa de Revisão Final.

6. **Liberações e Overrides:**
   - Resolução hierárquica estrita: `Catálogo Global → Plano → Assinatura → Override da Empresa → Permissão do Usuário`.
   - Suporte a exceções comerciais individuais (ex: +5 usuários ou liberação de módulo específico) sem alterar o plano global.

---

## 2. Validações e Testes

- **Suíte de Testes:** 845 testes unitários e de contrato aprovados (`npm test`).
- **Contrato E2E 092:** `src/lib/platform/planos-e2e-092-contract.test.ts` validando o Plano Profissional, contratação da Master Franquia, estimativa de R$ 1.560,00/mês, bloqueios de limites sem override e permissão com override.
- **TypeScript:** 0 erros com `npx tsc --noEmit`.
- **Next.js Build:** Compilado e otimizado com sucesso.
