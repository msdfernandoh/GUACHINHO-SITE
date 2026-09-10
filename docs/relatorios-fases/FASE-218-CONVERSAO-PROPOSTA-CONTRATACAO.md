# Relatório de Fase 218 — Conversão de Proposta em Contratação no SaaS (Login, ERP e Site)

## 1. Visão Geral e Contexto
- **Fase:** 218
- **Data:** 10/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Objetivo:** Implementar a integração completa do ciclo de vida de Propostas e Contratações:
  1. No site público, após a tela de envio de documentos, permitir a escolha explícita entre **"Apenas Proposta"** (conclui o fluxo comercial sem forçar contratação ou pagamento, gerando protocolo de proposta e PDF) e **"Contratação"** (avança diretamente para emissão e formalização do contrato).
  2. Na Área de Login do site (`/admin/propostas` e `/admin/propostas/[id]`), disponibilizar o botão **"Marcar Contratada"**, que atualiza o status para `Contratada`, cria atomicamente a contratação online correspondente com protocolo `GC-YYYY-XXXXXX`, migra documentos e redireciona direto para a tela de contratação (`/admin/contratacoes/[id]`).
  3. No ERP (`/erp/propostas` e `/erp/propostas/[id]`), criar a página operacional completa de propostas com cards de métricas, busca, filtros e o botão **"Marcar Contratada"**, enviando os dados para a fila de formalização de vendas em `/erp/contratacoes/[id]`.

---

## 2. Componentes e Entregas

### 2.1. Banco de Dados (Migration 218)
- Arquivo: `supabase/migrations/218_converter_proposta_em_contratacao.sql`.
- Função RPC: `public.rpc_converter_proposta_em_contratacao(p_empresa_id uuid, p_proposta_id uuid, p_usuario_id uuid DEFAULT NULL)`.
  - Garante isolamento multi-tenant por `p_empresa_id`.
  - Idempotência: caso já exista uma linha em `contratacoes_online` para a proposta, apenas atualiza `status = 'Contratada'` e retorna a linha existente.
  - Caso não exista: gera o protocolo sequencial `GC-YYYY-XXXXXX`, cria a contratação com status `aguardando_consultor` e `contrato_assinado = true`, transfere documentos anexos de `propostas_documentos` para `contratacoes_documentos` e atualiza `propostas.status = 'Contratada'`.
  - Permissões concedidas para `authenticated` e `service_role`.
  - Sincronizada com o banco Supabase remoto de produção via `npx supabase db push`.

### 2.2. Backend e Server Actions
- Arquivo: `gauchinho-app/src/app/admin/propostas/actions.ts`:
  - `marcarPropostaContratadaAction`: executa a chamada à RPC `rpc_converter_proposta_em_contratacao` com fallback resiliente, revalida as rotas `/admin/propostas`, `/admin/contratacoes`, `/erp/propostas` e `/erp/contratacoes`, e retorna `redirectUrl`.
  - `fetchPropostasList` e `fetchProposta`: enriquecidas com `contratacao_id` e `contratacao_protocolo` para vincular os botões de ação às contratações existentes.
- Arquivo: `gauchinho-app/src/lib/types/index.ts`:
  - Adicionado `"Contratada"` ao array canônico `PROPOSTA_STATUS`.

### 2.3. Componentes de Interface
- Arquivo: `gauchinho-app/src/components/admin/marcar-proposta-contratada-button.tsx`:
  - Componente client reutilizável para listagem (`table-btn`) e detalhe (`banner-btn`).
  - Suporta estados dinâmicos: se já contratada, exibe badge com link direto para a contratação; se não contratada, exibe botão de ação rápida com spinner e confirmação.
- Arquivo: `gauchinho-app/src/app/admin/propostas/page.tsx` e `[id]/page.tsx`:
  - Integrado botão "Marcar Contratada" na tabela e banner de formalização no detalhe.
- Arquivo: `gauchinho-app/src/app/erp/propostas/page.tsx` e `[id]/page.tsx`:
  - Criação completa do módulo de Propostas no ERP com layout nativo, cards de métricas (Total, Negociação, Contratadas, Mês), filtros de busca e botão "Marcar Contratada".
- Arquivo: `gauchinho-app/src/components/contratacao/contratacao-wizard.tsx`:
  - No passo de documentos (`step === "docs"`): adicionado seletor interativo entre **"Apenas Proposta"** e **"Contratação"**.
  - No encerramento: se "Apenas Proposta", conclui salvando a proposta e exibindo a tela de confirmação de proposta comercial com link e PDF; se "Contratação", avança para pagamento e materializa a contratação online formal.

---

## 3. Testes e Validação
1. **Testes Automatizados (Vitest):**
   - Criado `src/lib/proposta/converter-proposta-contratacao.test.ts` (5 testes aprovados).
   - Suíte de propostas e contratações: 22 arquivos e 72 testes 100% aprovados.
2. **Banco de Dados Remoto:**
   - Migration 218 aplicada com sucesso via `npx supabase db push`.
3. **Build de Produção:**
   - Compilação `npm run build` validada com rotas estáticas e dinâmicas geradas sem erros.
