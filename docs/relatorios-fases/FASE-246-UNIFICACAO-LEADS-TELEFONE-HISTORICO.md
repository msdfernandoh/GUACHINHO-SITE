# Fase 246 — Unificação de Leads por Telefone, Histórico Cronológico de Abordagens & Recorrência no Funil de Ganho

Data: 18/09/2026

## 1. Contexto e Diagnóstico

Na operação comercial consultiva de consórcios e eventos, um mesmo lead é abordado em múltiplos momentos e canais (feirões agro, simuladores online, indicações de parceiros, captação rápida no CRM, check-ins conversacionais).

Para evitar duplicação no banco de dados e garantir visão 360° do cliente, foi implementada a unificação automática por telefone (WhatsApp normalizado com DDD) como chave principal, acompanhada de um campo acumulador de informações cronológicas onde cada nova interação é registrada com a data na frente (`[DD/MM/AAAA HH:mm]`), preservando valor disponível para investimento, tipo de investimento, eventos participados e observações.

Adicionalmente, foi implementada a regra de negócio para **clientes recorrentes no funil de ganho**: se o lead já possui uma venda fechada/ganha, novas abordagens geram automaticamente uma **nova negociação (cópia no funil de entrada)** preservando a venda anterior intacta, além de permitir aos consultores gerar uma nova negociação manualmente com um clique.

---

## 2. Modelagem do Banco de Dados (Migrations 236 e 237)

- **Migration 236:** `supabase/migrations/236_unificacao_leads_telefone_e_historico_cadastros.sql` (aplicada no Supabase de Produção).
- **Migration 237:** `supabase/migrations/237_leads_recorrentes_funil_ganho_nova_negociacao.sql` (aplicada no Supabase de Produção).

### 2.1. Nova Coluna `historico_cadastros`
- Adicionada coluna `historico_cadastros TEXT` na tabela `public.leads` para armazenamento do histórico acumulativo de todas as abordagens do lead ao longo do tempo.

### 2.2. RPC Atômica `rpc_upsert_lead_por_telefone(p_payload jsonb)`
- Bloqueio transacional (`pg_advisory_xact_lock`) por hash do telefone normalizado, eliminando concorrência e duplicidade.
- **Caso 1 (Lead Ativo em Andamento):** Unifica o lead existente, atualiza campos recentes e concatena no topo (`prepend`) de `historico_cadastros` e `observacoes` o bloco estruturado com data na frente:
  ```text
  [18/09/2026 15:30] Nova abordagem / cadastro (Evento "Feirão do Automóvel"):
  • Evento: Feirão do Automóvel
  • Tipo de investimento / interesse: Automóvel
  • Valor disponível / pretendido: R$ 80.000,00
  • Entrada disponível: R$ 15.000,00
  • Capacidade mensal de parcela: R$ 1.000 a R$ 2.000
  • Cidade: Sinop - MT
  • Observações: ...
  ```
- **Caso 2 (Cliente no Funil de Ganho - Recorrência):**
  Se o único lead existente estiver no funil de ganho (`is_won = true` ou `status IN ('Fechado', 'Ganho', 'Venda fechada')`):
  - **NÃO** sobrescreve a venda fechada anterior.
  - Gera automaticamente uma **cópia como NOVA NEGOCIAÇÃO** na etapa `novo_lead` (status `Novo`).
  - Herda os dados do cliente e vincula o consultor responsável anterior.
  - Concatena no topo o cabeçalho `🌟 NOVA NEGOCIAÇÃO (Cliente com venda anterior ganha - Ref #...)` e preserva todo o histórico anterior consolidado.
  - Retorna `action: 'copied_new_deal'`.
- **Caso 3 (Lead Inédito):** Insere normalmente o novo lead (`action: 'created'`).

---

## 3. Camada de Aplicação TypeScript

### 3.1. Core Anti-Duplicação e Recorrência (`src/lib/crm/upsert-lead.ts`)
- `formatarEntradaHistoricoLead(payload, options)`: Formata qualquer interação com data e hora no fuso horário operacional `America/Cuiaba` (`[DD/MM/AAAA HH:mm]`).
- `isLeadGanho(status, isWon)`: Helper canônico que identifica leads em etapas ou status de fechamento/ganho.
- Suporte a `permitir_gerar_novo` e `forcar_novo` no payload.
- Fallback defensivo client-side totalmente alinhado com a RPC: detecta leads ganhos e gera nova negociação com consolidação de histórico.

### 3.2. Server Actions (`src/app/admin/leads/actions.ts`)
- `createLeadRapidoAction`: Unifica leads por telefone via `upsertLeadPorTelefone`. Se o lead já estava ganho, cria a nova negociação no Kanban.
- `duplicarLeadParaNovaNegociacaoAction(leadId)`: Server action dedicada para gerar nova negociação a partir da ficha do lead, registrando histórico em ambas as partes e redirecionando para a nova oportunidade.

---

## 4. Interfaces de Usuário

### 4.1. Ficha de Detalhes do Lead (`src/app/admin/leads/[id]/page.tsx`)
- Novo botão `CrmNovaNegociacaoButton` (`src/components/admin/crm/crm-nova-negociacao-button.tsx`) no cabeçalho de ações:
  - Destacado visualmente com badge dourado quando o cliente está ganho (`Nova Negociação (Cliente Ganho)`).
  - Permite a abertura de nova negociação com um clique e confirmação segura.
- Visualizador cronológico `LeadHistoricoCadastros` com badges de data, eventos, valores e capacidade financeira.

### 4.2. Card do Pipeline Kanban (`src/components/admin/crm/crm-lead-card.tsx`)
- Indicador visual `🔄 Múltiplas abordagens` para leads com histórico unificado.
- Exibição destacada do nome do evento de captação.

---

## 5. Validação e Qualidade

- **Testes Unitários:** `src/lib/crm/upsert-lead.test.ts` executado com **10 testes passando** (100% de sucesso), cobrindo:
  1. Normalização de telefones com e sem DDI 55
  2. Telefones fixos e celulares
  3. Tratamento de campos nulos e vazios
  4. Validação de telefones brasileiros
  5. Rejeição de formatos inválidos
  6. Chamada da RPC atômica
  7. Fallback defensivo para leads em andamento
  8. Acúmulo de histórico com data na frente e separador `---`
  9. **Criação de nova negociação (cópia) para leads no funil de ganho**
  10. **Geração forçada de nova negociação via `permitir_gerar_novo`**
- **TypeScript:** `npx tsc --noEmit` executado com **0 erros**.
- **Banco Remoto:** Migrations 236 e 237 aplicadas com sucesso no Supabase de Produção (`eaeuoynprurmmulzhydt`).
