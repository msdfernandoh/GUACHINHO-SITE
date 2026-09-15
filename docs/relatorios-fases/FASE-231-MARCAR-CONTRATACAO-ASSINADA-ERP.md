# Relatório de Fase 231 — Marcar Contratação como Assinada no ERP

> **Status:** Concluído com sucesso  
> **Data:** 15 de Setembro de 2026  
> **Escopo:** ERP Contratações · Formalização · Auditoria e Multi-Tenancy

---

## 1. Visão Geral do Problema

Ao acessar a tela de conferência operacional de contratações no ERP (`/erp/contratacoes/[id]`, como verificado no protocolo `GC-2026-000007`), o status da proposta permanecia como **"AGUARDANDO ASSINATURA"**.

No motor de conversão canônico do ERP (`formalizarContratacaoAction`), há uma trava de segurança estrita:
```ts
if (!contratacao.contrato_assinado) throw new Error("Contrato ainda não foi assinado.");
```

No entanto, os operadores não dispunham de nenhum botão ou controle no ERP para marcar o contrato como assinado física ou digitalmente pelo cliente. Isso gerava um bloqueio onde a contratação não podia prosseguir e o formulário falhava ou exibia avisos de pendência sem caminho de ação.

---

## 2. Diagnóstico e Arquitetura Pré-Existente

Auditoria no banco de dados e no código revelou que a base de dados já estava 100% preparada:
1. **Tabela `contratacoes_online`:**
   - Colunas `contrato_assinado boolean not null default false` e `contrato_assinado_em timestamptz` criadas na migration `041`.
   - Trigger `trg_contratacoes_sync_cliente` (`BEFORE INSERT OR UPDATE OF contrato_assinado`) para sincronizar / criar o registro em `clientes` automaticamente assim que `contrato_assinado` se torna `true`.
   - Trigger `trg_contratacoes_sync_cliente_historico` (`AFTER INSERT OR UPDATE OF contrato_assinado, cliente_id`) da migration `082` para registrar o vínculo em `clientes_historico`.
2. **Tabela `contratacoes_formalizacao_historico`:**
   - Auditoria append-only por tenant e contratação.

O que faltava era a camada de integração no ERP:
- Server Action multi-tenant com verificação estrita de permissões do tenant.
- Componente de ação interativo para o usuário marcar e desmarcar o contrato como assinado.
- Alertas contextuais e bloqueio informativo no checklist de formalização.

---

## 3. Implementação Realizada

### 3.1 Server Action Multi-Tenant: `alternarContratoAssinadoAction`
Arquivo: [`gauchinho-app/src/app/erp/contratacoes/actions.ts`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/contratacoes/actions.ts)

- **Autorização:** Exige `requireCurrentTenantContext()`. Valida se o usuário ativo possui a permissão `formalizar_vendas`, `gerenciar_propostas`, ou papéis `admin_empresa`, `super_admin` ou `master`.
- **Isolamento de Tenant:** Exige `.eq("id", contratacaoId).eq("empresa_id", context.empresaAtiva.id)`.
- **Integridade da Venda:** Se a contratação já gerou venda/cota formalizada (`contratacao.vendas.length > 0`), impede a desmarcação da assinatura.
- **Atualização Atômica:** Atualiza `contrato_assinado`, `contrato_assinado_em` (com timestamp ISO) e limpa pendências operacionais anteriores relacionadas à falta de assinatura.
- **Auditoria Append-Only:** Insere registro no histórico operacional com evento `CONTRATO_ASSINADO` ou `CONTRATO_NAO_ASSINADO`, informando nome e ID do operador responsável.
- **Revalidação de Cache:** Dispara `revalidatePath` em `/erp/contratacoes`, `/erp/contratacoes/[id]` e `/erp/clientes`.

### 3.2 Componente Interativo: `MarcarContratoAssinadoButton`
Arquivo: [`gauchinho-app/src/components/erp/contratacoes/marcar-contrato-assinado-button.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/erp/contratacoes/marcar-contrato-assinado-button.tsx)

- Suporta 4 variantes visuais:
  - `hero`: Destaque no cabeçalho da página de conferência ao lado do badge de status.
  - `banner`: Botão verde em destaque dentro do banner de aviso do topo.
  - `inline`: Ação rápida dentro do checklist de pendências da formalização.
  - `table`: Ação rápida na coluna "Ações" da listagem de contratações do ERP.
- Gerencia estado assíncrono via `useTransition` com feedback visual de carregamento (`Loader2`).
- Diálogo de confirmação para ações de reversão ("Desmarcar assinatura"), prevenindo cliques acidentais.
- Revalidação via `router.refresh()`.

### 3.3 Página de Detalhe e Conferência
Arquivo: [`gauchinho-app/src/app/erp/contratacoes/[id]/page.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/contratacoes/%5Bid%5D/page.tsx)

- **Cabeçalho:** Botão "Marcar como assinada" posicionado em evidência ao lado da tag de status.
- **Banner de Alerta:** Quando a contratação estiver com status `AGUARDANDO ASSINATURA` e não formalizada, exibe faixa informativa no topo com botão direto para assinar.
- **Propagação de Estado:** Passa `contratoAssinado={Boolean(c.contrato_assinado)}` para o formulário.

### 3.4 Formulário de Formalização
Arquivo: [`gauchinho-app/src/components/erp/contratacoes/formalizacao-venda-form.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/components/erp/contratacoes/formalizacao-venda-form.tsx)

- No bloco de pendências para liberar a formalização, inclui:
  *"O contrato precisa ser marcado como assinado antes de formalizar a venda"*
- Renderiza botão de ação inline diretamente ao lado da pendência.
- O botão "Confirmar e formalizar venda" permanece desabilitado enquanto o contrato não for marcado como assinado, exibindo o rótulo *"Aguardando assinatura do contrato"*.

### 3.5 Tabela de Contratações do ERP
Arquivo: [`gauchinho-app/src/app/erp/contratacoes/page.tsx`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/app/erp/contratacoes/page.tsx)

- Na coluna "Ações", contratações que aguardam assinatura recebem o botão rápido `Marcar assinado`, permitindo validação direta na fila operacional.

---

## 4. Testes e Validação

- **Novo Teste de Contrato:** [`src/lib/erp/contratacoes-marcar-assinado-contract.test.ts`](file:///c:/Fernando%20Hugo/GAUCHINHO%20SITE/gauchinho-app/src/lib/erp/contratacoes-marcar-assinado-contract.test.ts)
  - 6 testes cobrindo Server Action, RLS/tenant, auditoria, proteções de formalização e renderização dos botões.
- **Suíte de Contratações ERP:**
  - 5 arquivos de teste, 17 testes executados, **17 aprovados (100% PASS)**.
- **Integridade dos Dados:**
  - Nenhuma tabela ou migration teve colunas renomeadas ou excluídas.
  - O banco de dados Supabase e os dados da Gauchinho Consórcios foram 100% preservados.
