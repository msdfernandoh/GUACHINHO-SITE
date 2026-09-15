# Relatório de Fase 230 — QR Institucional Permanente, Participantes, Exportação XLSX, Resumo Comercial CRM e Deduplicação Global de Leads

> **Status:** Concluído com sucesso (Aguardando autorização para deploy em produção)  
> **Data:** 12 de Setembro de 2026  
> **Escopo:** Entrega Unificada em 5 Partes (A, B, C, D e E)

---

## 1. Visão Geral e Objetivos da Entrega

Esta fase consolida uma evolução estrutural e de UX em 5 frentes interligadas, sem criar sistemas paralelos ou romper tabelas existentes:

1. **Parte A — QR Institucional Permanente (`/qr/site`):** Reutilização de `qr_codes_unicos` com slug canônico `site`, permitindo ao perfil Master alternar dinamicamente o destino (Página Inicial, Evento, Check-in Direto de Evento, WhatsApp, Página Interna ou URL Customizada) sem jamais alterar a imagem física impressa. Inclui histórico de alterações auditável (`qr_codes_unicos_destinos_historico`) e downloads em alta resolução (PNG 1200x1200px e SVG vetorial).
2. **Parte B — Melhoria da Lista de Participantes dos Eventos:** Na rota `/admin/eventos/[id]/participantes`, exibição dos dados de qualificação coletados no check-in (Veículo Atual, Situação de Moradia, Capacidade de Investimento) e Número da Sorte, cards com indicadores consolidados no topo, filtros combinados e tabela responsiva com cards mobile otimizados.
3. **Parte C — Exportação XLSX Real dos Participantes:** Substituição de dumps crus por planilha binária `.xlsx` legítima (formato OpenXML) via `write-excel-file`, com cabeçalhos estilizados, larguras automáticas de colunas, respeitando filtros aplicados na tela ou permitindo "Exportar Todos".
4. **Parte D — Respostas do Check-in no CRM Leads:** No detalhe do Lead (`/admin/leads/[id]`), apresentação de um Card de Resumo Comercial em destaque no topo com os dados da participação mais recente no evento (Veículo, Moradia, Capacidade de Investimento, Número da Sorte, Evento e Consentimento LGPD) e histórico preservado para contatos que participaram de múltiplos eventos.
5. **Parte E — Deduplicação Global de Leads por Telefone:** Normalização canônica nacional (10 ou 11 dígitos, sem DDI 55 e sem pontuação), criação da coluna `telefone_normalizado` e índice de alta performance, trigger defensivo no PostgreSQL, RPC atômica `rpc_upsert_lead_por_telefone` com lock transacional (`pg_advisory_xact_lock`), preservação de integridade referencial nas 12 tabelas dependentes (incluindo `programa_indicacoes` com `ON DELETE RESTRICT`) e centralização em todas as rotas de captura do sistema.

---

## 2. Auditoria Prévia de Leads Duplicados (Somente Leitura)

Antes de qualquer alteração de schema ou código, realizou-se auditoria direta no banco de dados Supabase de produção:
- **Total de registros na tabela `leads`:** 318 leads.
- **Telefones distintos identificados:** 266 números.
- **Telefones com ocorrência repetida:** 36 números distintos totalizando **50 leads duplicados históricos**.
- **Causa raiz:** Cada formulário (simulador, calculadoras, grupos, interesse em cartas, indicação de parceiro, inscrição em eventos e check-in conversacional) executava inserção direta (`supabase.from("leads").insert(...)`) sem lock transacional nem deduplicação por telefone.
- **Mapeamento de Chaves Estrangeiras:** Identificadas 12 tabelas vinculadas a `leads.id`:
  - `propostas(lead_id)`
  - `leads_historico(lead_id)`
  - `lead_atividades(lead_id)`
  - `eventos_site(lead_id)`
  - `contratacoes_online(lead_id)`
  - `leads_eventos_qualificacoes(lead_id)`
  - `agenda_eventos(lead_id)`
  - `ia_conversas(lead_id)`
  - `erp_clientes(lead_id)`
  - `erp_contratacoes(lead_id)`
  - `erp_comissoes_repasses(lead_id)`
  - `programa_indicacoes(lead_indicado_id)` com constraint `ON DELETE RESTRICT`.
- **Decisão Arquitetural:** **PROIBIDO DELETE CEGO.** Nenhum registro histórico foi removido ou mesclado sem autorização explícita do usuário. A arquitetura implementada a partir da Fase 230 garante que novos contatos façam merge inteligente no lead existente mais antigo, enriquecendo dados faltantes e registrando histórico.

---

## 3. Arquitetura da Migration 222

Arquivo: `supabase/migrations/222_qr_institucional_e_deduplicacao_leads.sql`

### 3.1 QR Institucional Permanente
- Colunas adicionadas a `public.qr_codes_unicos`:
  - `tipo_destino text default 'evento'`
  - `destino_url text`
  - `destino_evento_id uuid references public.eventos(id) on delete set null`
- Tabela criada: `public.qr_codes_unicos_destinos_historico`:
  - Registro de auditoria: `qr_code_id`, `tipo_destino_anterior`, `destino_url_anterior`, `destino_evento_id_anterior`, `tipo_destino_novo`, `destino_url_novo`, `destino_evento_id_novo`, `alterado_por_id`, `motivo`, `created_at`.
- RLS ativado com permissões para administradores.
- Seed idempotente do registro canônico `slug = 'site'`.

### 3.2 Deduplicação e Integridade de Leads
- Coluna adicionada: `public.leads.telefone_normalizado text`.
- Índice parcial: `idx_leads_telefone_normalizado ON public.leads (telefone_normalizado) WHERE telefone_normalizado IS NOT NULL`.
- Função e Trigger: `fn_leads_normalizar_telefone()` e `trg_leads_normalizar_telefone` preenchendo automaticamente o campo normalizado em qualquer insert/update nativo.
- Função de normalização SQL: `fn_normalizar_telefone_lead(p_telefone text)`.
- RPC Atômica Concorrente: `rpc_upsert_lead_por_telefone(...)`:
  - Utiliza `pg_advisory_xact_lock(hashtext('lead_lock_' || v_tel_norm))` para serializar requisições com o mesmo telefone milissegundos antes do commit.
  - Seleciona o lead canônico mais antigo (`created_at asc`).
  - Atualiza com `coalesce` defensivo (só preenche campos nulos ou melhora dados existentes).
  - Preserva `origem`, `srd_responsavel_id` e enriquece `dados_simulacao`.
  - Retorna `{ ok: true, lead_id: uuid, action: 'inserted' | 'updated' }`.

---

## 4. Detalhamento das Implementações de Código

### 4.1 Módulo `upsert-lead.ts` e Rotas de Captura Centralizadas
- Normalizador canônico `normalizePhoneForLead(phone)`:
  - Remove caracteres não numéricos.
  - Remove prefixo internacional `55` apenas quando o comprimento for 12 ou 13 dígitos.
  - Valida DDD brasileiro (11 a 99) e tamanho padrão (10 ou 11 dígitos).
- 10 rotas e módulos integrados com `upsertLeadPorTelefone`:
  - `src/app/api/public/simulador/captura/route.ts`
  - `src/app/api/public/calculadoras/captura/route.ts`
  - `src/app/api/public/grupos/fluxo/route.ts`
  - `src/app/api/public/cartas/interesse/route.ts`
  - `src/app/api/public/imoveis/interesse/route.ts`
  - `src/app/api/public/leads/especialista/route.ts`
  - `src/app/api/public/leads/indicacao/route.ts`
  - `src/lib/comercial-eventos/inscricao.ts`
  - `src/lib/eventos-sorteio/indicacoes.ts`
  - `src/lib/eventos-sorteio/checkin-conversacional.ts`
  - `src/app/area-parceiro/actions.ts`
  - `src/app/admin/leads/actions.ts` (criação e indicação rápida)

### 4.2 QR Institucional Permanente `/qr/site`
- `src/lib/eventos-sorteio/qr-unico.ts`:
  - Suporte a múltiplos modos de redirecionamento imediato em `resolveQrPublicBySlug`.
  - Server actions `atualizarDestinoQrCodeAction` e consulta de histórico `buscarHistoricoDestinosQrCodeAction`.
- Interface administrativa em `/admin/configuracoes/qr-codes`:
  - Hero Card de destaque com prévia do QR Code.
  - Botão de cópia do link oficial `https://gauchinhoconsorcios.com.br/qr/site`.
  - Downloads em alta qualidade: PNG 1200x1200px (Canvas com margem de segurança) e SVG.
  - Formulário para o perfil Master alternar o destino com feedback visual instantâneo.
  - Painel com histórico das últimas alterações de destino.

### 4.3 Participantes e Exportação XLSX Real
- Serviço `src/lib/comercial-eventos/participantes-enriquecidos.ts`:
  - Mescla registros de `eventos_participantes` com `eventos_sorteio_participantes`.
  - Resumo estatístico agregado: Total, Confirmados, Presentes, Check-ins, Com Veículo, Moradia Aluguel e Investimento > R$ 1.000.
  - Busca textual com normalização insensível a acentos (`normalizeSearch`).
- Rota de Exportação `/api/admin/eventos/[id]/participantes/export-xlsx`:
  - Utiliza `write-excel-file` para gerar arquivo binário nativo com mime-type `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
  - Cabeçalhos estilizados em negrito, colunas ajustadas e tratamento correto de caracteres especiais.
  - Suporta query string para exportar a visualização filtrada ou todos os participantes.

### 4.4 Resumo Comercial no CRM Leads
- Componente `src/components/admin/crm/lead-checkin-qualificacao.tsx`:
  - Card destacado no topo da página de detalhe do Lead (`/admin/leads/[id]`).
  - Destaque para o check-in mais recente com Número da Sorte em tipografia mono/âmbar de alta legibilidade.
  - 3 blocos comerciais com ícones:
    - 🚗 **Veículo Atual**: Opções legíveis (Carro, Moto, Carro e Moto, Ainda não).
    - 🏠 **Situação de Moradia**: Opções legíveis (Própria quitada, Própria financiada, Aluguel, Outra).
    - 💰 **Capacidade de Investimento**: Destaque em ouro/âmbar com a faixa de investimento informada pelo cliente.
  - Indicador de consentimento LGPD com timestamp e versão do termo.
  - Seção expansível para visualização de participações em eventos anteriores quando o cliente compareceu a mais de uma edição.

---

## 5. Validações e Homologação dos Testes

| Verificação | Comando | Resultado | Detalhes |
| :--- | :--- | :--- | :--- |
| **Vitest (CRM/Eventos)** | `npx vitest run src/lib/crm src/lib/eventos-sorteio src/lib/comercial-eventos` | **23/23 PASS** | 141 testes unitários aprovados (100% de sucesso) |
| **TypeScript** | `npx tsc --noEmit` | **0 erros** | Tipagem estrita validada em todo o projeto |
| **ESLint** | `npx eslint --quiet "src/**/*.{ts,tsx}"` | **0 erros** | Sem erros de linting em arquivos do projeto |
| **Next.js Build** | `npm run build` | **PASS** | 153 rotas estáticas e dinâmicas compiladas com sucesso |

---

## 6. Próximos Passos (Aguardando Autorização)

1. Validação final pelo usuário das telas e fluxos implementados.
2. Execução controlada da Migration 222 no PostgreSQL do Supabase de produção.
3. Commit e Push na branch `main`.
4. Deploy de produção na Vercel.
