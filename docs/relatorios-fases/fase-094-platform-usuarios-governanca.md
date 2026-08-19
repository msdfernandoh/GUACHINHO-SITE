# Relatório de Execução — Fase 094: Governança Global de Usuários e Responsáveis das Master Franquias

**Data:** 19/08/2026  
**Status:** CONCLUÍDO / PUBLICADO  
**Migration Aplicada:** `094_platform_usuarios_governanca.sql`  

---

## 1. Escopo e Objetivos Atingidos

1. **Lista Global de Usuários (`/platform/usuarios`):**
   - Central de governança com listagem completa de usuários vinculados às Master Franquias.
   - Colunas: Nome, E-mail, Master Franquia, Papel, Status (`CONVIDADO`, `ATIVO`, `INATIVO`, `SUSPENSO`), Responsável Principal (⭐), Módulos Efetivos, Último Acesso e Ações.
   - Indicadores executivos no topo: Total de Usuários, Usuários Ativos, Convites Pendentes e Responsáveis Principais.
   - Filtros combinados: Busca textual (nome, e-mail, franquia), Master Franquia, Status, Papel e Convite (Pendente/Aceito).

2. **Fluxo de Convite Seguro (`+ Novo Usuário / Convidar`):**
   - Modal com seleção da Master Franquia de destino e visualização em tempo real das vagas ocupadas vs limites contratados (`X de Y vagas disponíveis`).
   - Bloqueio no backend caso o limite efetivo de usuários da franquia seja atingido (`rpc_platform_convidar_usuario`), considerando quotas e overrides comerciais.
   - Envio de convite seguro sem geração ou mutação manual de senhas de autenticação.
   - Resolução hierárquica estrita de módulos permitidos: `Catálogo Global ERP → Plano SaaS da Franquia → Overrides da Empresa → Vínculo do Usuário → Efetivo`. O usuário nunca recebe acesso a módulos bloqueados para sua Master Franquia.

3. **Responsável Principal Único por Master Franquia:**
   - Suporte a marcação de 1 responsável principal ativo por franquia com índice parcial único no banco de dados (`empresa_usuarios_responsavel_unico_idx`).
   - Transferência auditada via RPC `rpc_platform_definir_responsavel_empresa` desmarcando o anterior automaticamente.

4. **Ações Operacionais e Auditoria:**
   - Reenvio de convite com timestamp atualizado (`rpc_platform_reenviar_convite_usuario`).
   - Edição de papel, status e módulos efetivos (`rpc_platform_alterar_usuario`).
   - Registro de todas as operações na trilha central `public.plataforma_auditoria`.
   - Aba de Usuários do HUB `/platform/empresas/[id]` atualizada com os mesmos dados canônicos e métricas.

---

## 2. Validações e Testes

- **Suíte de Testes:** 856 testes unitários e de contrato aprovados (`npm test`).
- **Contrato E2E 094:** `src/lib/platform/usuarios-governanca-094-contract.test.ts` aprovado (6 testes).
- **TypeScript:** 0 erros com `npx tsc --noEmit`.
- **Next.js Build:** Compilado e otimizado com sucesso (143 rotas dinâmicas e estáticas).
