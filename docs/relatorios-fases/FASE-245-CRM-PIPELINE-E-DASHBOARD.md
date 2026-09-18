# Fase 245 — CRM Pipeline de Vendas em 12 Etapas, Dashboard Comercial e Transição ERP

Data: 18/09/2026

## 1. Contexto e Diagnóstico

A especificação comercial do projeto (`projeto_area_logada_crm_gauchinho_racon.md`) detalhava a necessidade de uma esteira completa de CRM para captação, qualificação (SDR), atendimento consultivo e fechamento de consórcio, contemplando:
- Funil comercial com 12 etapas canônicas (desde o "Novo lead" até "Stand-by / futuro");
- Métricas e KPIs comerciais em tempo real (8 cartões estratégicos e taxas de conversão de ponta a ponta);
- Visão Kanban interativa com drag-and-drop nativo e fallback ágil em cards;
- Modal de movimentação de estágio com captura obrigatória de motivo de perda ou agendamento de próximo retorno (follow-up);
- Modal de cadastro rápido de lead (< 15 segundos) com cálculo automático de completude (`is_incompleto`);
- Gestão documental e de arquivos anexos por lead (`lead_arquivos`);
- Central de apoio ao consultor com biblioteca de materiais, argumentários e scripts de contorno de objeções;
- Integração e transição segura do CRM para o ERP (`propostas`), mantendo limites claros de governança.

### Análise Crítica e Adaptação SaaS Multiempresa

O documento conceitual sugeria tabelas em inglês (`users`, `leads`, `pipeline_stages`, `activities`). No entanto, conforme definido na arquitetura mestre do repositório (`docs/SAAS-MASTER-ARCHITECTURE.md`) e nas diretrizes de `AGENTS.md`:
1. O banco Supabase Postgres adota **Português snake_case** (`crm_funil_etapas`, `lead_arquivos`, `crm_motivos_perda`).
2. A governança multi-tenant exige isolamento rigoroso via `empresa_id` em todas as tabelas e políticas RLS vinculadas a `empresa_usuarios(empresa_id, usuario_id, papel_id)`.
3. Os dados existentes do primeiro tenant (**Gauchinho Consórcios**, Tenant 1) devem ser **integralmente preservados sem qualquer perda ou sobrescrita**.
4. Limites claros entre sistemas: o CRM controla exclusivamente leads, contatos, qualificações, reuniões, propostas prévias e follow-ups; o ERP governa cotas definitivas, formalização de contratos, motor de comissões e financeiro.

---

## 2. Modelagem do Banco de Dados (Migration 235)

Criada a migration forward-only e não destrutiva:
`supabase/migrations/235_crm_pipeline_etapas_e_melhorias_leads.sql`

### 2.1. Tabela de Etapas Canônicas (`crm_funil_etapas`)
- Registra as 12 etapas ordenadas por tenant (`ordem` de 1 a 12):
  1. Novo lead (`novo_lead`)
  2. Contato realizado (`contato_realizado`)
  3. Qualificado (`qualificado`)
  4. Reunião agendada (`reuniao_agendada`)
  5. Reunião realizada (`reuniao_realizada`)
  6. Proposta enviada (`proposta_enviada`)
  7. Documentação / cadastro (`documentacao_cadastro`)
  8. Boleto enviado (`boleto_enviado`)
  9. Venda fechada (`venda_fechada`, `is_won = true`)
  10. Pós-venda (`pos_venda`)
  11. Perdido (`perdido`, `is_lost = true`)
  12. Stand-by / futuro (`standby_futuro`)
- Seed idempotente automático para todas as empresas ativas (incluindo Tenant 1);
- Suporte a personalização de cores, badges e SLAs por etapa sem quebrar integridade.

### 2.2. Enriquecimento da Tabela `public.leads`
Campos adicionados de forma retrocompatível:
- `etapa_id UUID REFERENCES crm_funil_etapas(id)`: FK canônica da etapa no funil;
- `is_incompleto BOOLEAN DEFAULT false`: flag rápida de enriquecimento para SDRs;
- `modelo_interesse TEXT`: modalidade de consórcio pretendida (`imovel`, `automovel`, `pesados`, `investimento`, etc.);
- `data_ultimo_contato TIMESTAMPTZ`: registro do timestamp do último diálogo efetivo;
- `motivo_perda_codigo TEXT`: categorização padronizada de leads perdidos.
- **Backfill retroativo:** mapeou os status históricos (`novo`, `em_andamento`, `qualificado`, `proposta_enviada`, `fechado`, `perdido`) para os IDs canônicos de `crm_funil_etapas` do tenant sem impactar nenhum registro existente.

### 2.3. Tabela `lead_arquivos`
- Permite upload e catalogação de documentos essenciais (RG/CNH, comprovante de residência, ficha cadastral, proposta assinada, simulação PDF, comprovante de pagamento);
- Armazena `nome_arquivo`, `tamanho_bytes`, `storage_path`, `mime_type`, `categoria` e `enviado_por`;
- Políticas RLS rigorosas garantindo acesso restrito ao tenant da empresa.

### 2.4. Tabela `crm_motivos_perda`
- Catalogação parametrizável de motivos de insucesso comercial (Preço / Parcela alta, Fechou com concorrente, Desistiu do objetivo, Sem capacidade financeira, Não atende / sumiu, Compra à vista / Financiamento, etc.).

---

## 3. Estrutura de Código e Componentes Entregues

### 3.1. Tipos e Camada de Domínio (`src/lib/crm/`)
- `src/lib/crm/types.ts`: Tipagem estrita TypeScript de `CrmFunilEtapaRow`, `LeadArquivoRow`, `LeadFilters`, `CrmDashboardMetrics`;
- `src/lib/crm/constants.ts`: Constantes canônicas das 12 etapas, modelos de interesse, cores de badge, motivos de perda padronizados e helpers de fallback;
- `src/lib/crm/leads-query.ts`: Queries tenant-aware no Supabase com suporte a filtros avançados de SDR (`somente_incompletos`, `parados_dias`, `modelo_interesse`, `etapa_id`);
- `src/lib/crm/dashboard-query.ts`: Agregação analítica dos 8 KPIs executivos, distribuição volumétrica das 12 etapas, taxa de conversão funil e ranking de consultores.

### 3.2. Server Actions Seguras (`src/app/admin/leads/actions.ts`)
- `updateLeadEtapaAction`: Atualização atômica de estágio com validação de transição, registro de histórico em `lead_historico`, atualização de temperatura e agendamento de retorno;
- `createLeadRapidoAction`: Criação de novos contatos em menos de 15 segundos com detecção automática de completude;
- `converterLeadParaErpAction`: Ponto de transição canônico que converte um lead qualificado em `proposta` no ERP sem duplicar registros e mantendo integridade financeira;
- `fetchCrmFunilEtapasAction`, `fetchLeadArquivosAction`, `uploadLeadArquivoAction`, `getLeadArquivoSignedUrlAction`: Ações server-side autenticadas para gestão de anexos e pipeline.

### 3.3. Interfaces do Usuário (`src/components/admin/crm/` e Rotas)
- **Dashboard Executivo CRM** (`/admin/crm`):
  - 8 cartões estratégicos: Total de Leads, Leads Novos, Em Qualificação, Propostas na Mesa, Vendas Fechadas, Volume Potencial, Taxa de Conversão e Alertas de Inatividade;
  - Gráfico proporcional das 12 colunas do funil com contagem e volume financeiro;
  - Painel de alertas operacionais para SDRs (leads parados > 24h, parados > 7 dias, contatos incompletos);
  - Ranking de performance por consultor/SDR.
- **Pipeline Kanban 12 Etapas** (`/admin/crm/pipeline`):
  - 12 colunas horizontais com drag-and-drop nativo HTML5 (compatível com React 19) e menus de seleção direta nos cards;
  - Pills de filtro rápido de 1 clique: Meus Leads, Sem Responsável, Sem Contato > 24h, Parados > 7d, Quentes e Incompletos;
  - Modal contextual de transição (`CrmStageMoveModal`) com registro de motivo de perda ou agendamento de follow-up;
  - Botão de envio rápido ao ERP quando o lead atinge etapas decisivas.
- **Cadastro Rápido de Lead** (`CrmQuickLeadModal` e `CrmQuickLeadButton`):
  - Acessível a partir do Dashboard, do Kanban e da lista tabular de leads.
- **Central de Materiais & Scripts** (`/admin/crm/materiais`):
  - Scripts comerciais para abordagem inicial, sondagem, apresentação de proposta e contorno de objeções com botão de cópia rápida para WhatsApp;
  - Argumentários de comparação Consórcio x Financiamento x Investimentos;
  - Acesso direto à rede semanal de Network (terças-feiras às 19h).
- **Painel de Performance Comercial** (`/admin/crm/performance`):
  - Resumo de volume gerado, taxa de conversão e comparativo entre consultores da equipe.
- **Detalhamento do Lead** (`/admin/leads/[id]`):
  - Gestão de documentos e anexos (`CrmLeadArquivos`);
  - Botão de conversão direta para o ERP;
  - Ação de convite WhatsApp para o Network semanal;
  - Alerta de pendência cadastral para leads incompletos.
- **Navegação Lateral Atualizada** (`src/components/admin/sidebar.tsx`):
  - Agrupador dedicado **CRM Vendas** com links diretos para Dashboard CRM, Pipeline (Funil), Lista de Leads, Performance e Materiais & Scripts.

---

## 4. Preservação de Dados e Segurança Multiempresa

1. **Proteção do Tenant 1 (Gauchinho Consórcios):**
   - Nenhum dado de clientes, propostas ou contratos foi alterado ou apagado;
   - Os leads pré-existentes receberam a FK canônica da etapa correspondente através do script idempotente de migração.
2. **Isolamento Multi-tenant:**
   - Todas as queries e mutations utilizam o contexto seguro da empresa ativa extraído da sessão autenticada;
   - Todas as políticas RLS de `crm_funil_etapas` e `lead_arquivos` filtram por `empresa_id`.
3. **Fronteira CRM vs ERP:**
   - O CRM lida exclusivamente com o relacionamento comercial e etapas de qualificação;
   - O ERP permanece soberano sobre contratos definitivos, controle de caixa e cálculo de repasses de comissão.

---

## 5. Validação e Qualidade

- **TypeScript:** `npx tsc --noEmit` executado com **0 erros** em todo o repositório;
- **ESLint:** Regras estritas de hooks e pureza do React 19 (`react-hooks/purity`) rigorosamente atendidas, eliminando chamadas impuras de `Date.now()` no corpo de renderização;
- **Compatibilidade:** Testado em ambiente Next.js 15 App Router e Tailwind CSS.
