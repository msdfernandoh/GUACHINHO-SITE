# Relatório de Execução — Fase 093: Hub Operacional de Master Franquias

**Data:** 19/08/2026  
**Status:** CONCLUÍDO / PUBLICADO  
**Migration Aplicada:** `093_platform_master_franquias_hub.sql`  

---

## 1. Escopo e Objetivos Atingidos

1. **Lista de Master Franquias (`/platform/empresas`):**
   - Central de monitoramento com filtros dinâmicos por Status (`TODOS`, `ATIVA`, `TREINAMENTO`, `SUSPENSA`, `INATIVA`), Plano SaaS, Administradoras concedidas, ERP e Modelo de Site.
   - Indicadores executivos no topo: Total de Franquias, Franquias Ativas, Em Treinamento e MRR Contratual Total.
   - Listagem com visualização de Nome, Status, Plano, Administradoras, Site & Domínio, ERP, Usuários e Parceiros.
   - Botão `+ Nova Master Franquia` direcionando para o onboarding guiado em 8 etapas.

2. **Detalhe e HUB Operacional (`/platform/empresas/[id]`):**
   - **Header Executivo:** Nome fantasia, razão social, CNPJ, slug, badges de status, botões de ação contextuais (`✓ Ativar Master Franquia`, `⚠️ Suspender Franquia` com motivo e observação, `Reativar Franquia`).
   - **Prontidão da Master:** Card de checklist com 7 itens de prontidão mínima (Empresa, Plano, Administradora, Usuário Responsável, Limites, Modelo de Site e Domínio), exibindo `PRONTA PARA ATIVAÇÃO` ou `X PENDÊNCIA(S)`.
   - **Métricas e Quotas Operacionais:** Indicadores no formato `UTILIZADO / CONTRATADO / MÁXIMO DO PLANO` para Usuários, Sites de Parceiros e Domínios Próprios de Parceiros.
   - **10 Abas Integradas:**
     1. *Visão Geral*: Resumo executivo de contratos, canais e links rápidos.
     2. *Empresa & Dados*: Edição completa de razão social, nome fantasia, CNPJ, contatos e endereço.
     3. *Plano & Assinatura*: Gestão contratual com modal assistido de **Trocar Plano SaaS** e recálculo financeiro em tempo real.
     4. *ERP & Módulos*: Matriz de módulos efetivos (`Módulo | Categoria | Incluso no Plano | Override Empresa | Acesso Efetivo`).
     5. *Usuários*: Listagem de equipe com papel, status e último acesso.
     6. *Administradoras*: Gestão de administradoras concedidas (`empresa_administradoras`), concessão rápida e revogação.
     7. *Site & Identidade*: Visualização de template selecionado, status de publicação e modal de **Trocar Modelo de Site** para modelos publicados com registro histórico.
     8. *Domínios*: Gestão de domínios próprios e subdomínios da empresa com status DNS.
     9. *Parceiros & Sites*: Organizações parceiras pertencentes à franquia, listagem de sites e modal `+ Novo Site de Parceiro` com validação de quotas.
     10. *Histórico & Auditoria*: Linha do tempo de alterações e eventos daquela Master Franquia.

3. **Arquitetura Multi-tenant e Governança:**
   - O parceiro pertence à Master Franquia (não cria tenant isolado nem nova empresa/assinatura SaaS).
   - Suspensão não apaga dados nem registros históricos.
   - Ativação bloqueada até que a prontidão mínima seja atendida.

---

## 2. Validações e Testes

- **Suíte de Testes:** 850 testes unitários e de contrato aprovados (`npm test`).
- **Contrato E2E 093:** `src/lib/platform/master-franquias-hub-093-contract.test.ts` aprovado.
- **TypeScript:** 0 erros com `npx tsc --noEmit`.
- **Next.js Build:** Compilado e otimizado com sucesso.
