# Relatório de Execução — Fase 095: Gestão Operacional de Exceções e Overrides por Master Franquia

**Data:** 19/08/2026  
**Status:** CONCLUÍDO / PUBLICADO  
**Migration Aplicada:** `095_platform_overrides_gestao_operacional.sql`  

---

## 1. Escopo e Objetivos Atingidos

1. **Gestão Centralizada de Overrides (`/platform/overrides` e `/platform/recursos`):**
   - Central operacional para criação, monitoramento e encerramento de exceções por Master Franquia sem alteração dos Planos SaaS globais.
   - Tipos suportados: `MODULO_ERP` (Liberar / Bloquear), `LIMITE_USUARIOS`, `LIMITE_PARCEIROS`, `LIMITE_SITES`, `LIMITE_DOMINIOS_PROPRIOS`, `ERP_HABILITADO` e `RECURSO_CATALOGO`.
   - Indicadores executivos no topo: Total de Overrides, Overrides Ativos, Temporários com Vigência e Expirados/Encerrados.
   - Filtros combinados: Busca textual, Master Franquia, Tipo de Override, Status (`ATIVO`, `EXPIRADO`, `ENCERRADO`, `FUTURO`) e Vigência (Permanente vs Temporário).

2. **Fluxo de Novo Override (`+ Novo Override`):**
   - Modal assistido com seleção da Master Franquia e exibição clara dos valores herdados do Plano/Assinatura (`PLANO | CONTRATADO | OVERRIDE | EFETIVO`).
   - Motivo obrigatório padronizado (`condição comercial`, `cortesia`, `negociação especial`, `teste / degustação`, `suporte e implantação`, `ajuste contratual`, `outro`) com campo de observação livre.
   - Vigência temporária ou permanente com retorno automático à herança do Plano após expiração sem necessidade de exclusão ou mutação manual.
   - Resolução de conflitos no backend: substituição segura e encerramento auditado de overrides ativos anteriores para o mesmo recurso.

3. **Encerramento Seguro e Preservação de Histórico:**
   - Ação `Encerrar Override` via RPC `rpc_platform_encerrar_override` registrando data, motivo e usuário que encerrou, restaurando quotas e acessos sem perda de dados históricos.
   - Bloqueio de módulo ERP por override restringe acessos futuros sem deletar movimentações financeiras, propostas ou registros anteriores da empresa.

4. **Integração com HUB da Master Franquia:**
   - Card `Overrides & Exceções Ativas` integrado na Visão Geral do HUB `/platform/empresas/[id]` com lista de concessões ativas e atalho de navegação.

---

## 2. Validações e Testes

- **Suíte de Testes:** 863 testes unitários e de contrato aprovados (`npm test`).
- **Contrato E2E 095:** `src/lib/platform/overrides-governanca-095-contract.test.ts` aprovado (7 testes).
- **TypeScript:** 0 erros com `npx tsc --noEmit`.
- **Next.js Build:** Compilado e otimizado com sucesso (144 rotas dinâmicas e estáticas).
