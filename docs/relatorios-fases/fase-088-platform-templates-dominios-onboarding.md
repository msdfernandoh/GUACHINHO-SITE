# Relatório de Fase 088 — Modelos de Site, Domínios e Onboarding de Master Franquia

**Data:** 18/08/2026  
**Status:** Concluído com Sucesso  
**Branch:** `codex/platform-onboarding-modelos-dominios-franquias`  
**Migration:** `088_platform_templates_dominios_onboarding.sql` (Aplicada em Produção)

---

## 1. Contexto & Objetivos

Evoluir de forma coordenada e robusta os três pilares do onboarding comercial e visual de novas Master Franquias no SaaS Gauchinho Consórcios:
1. **/platform/templates — Modelos de Site**: Catálogo global de templates de site com criação, duplicação, edição detalhada em 8 abas, versionamento, publicação, sanitização estrita de código customizado e preview visual dinâmico (Desktop/Tablet/Mobile).
2. **/platform/dominios — Domínios**: Gestão oficial de domínios customizados e subdomínios vinculados aos tenants, instruções de DNS (CNAME/A) e proteção estrita contra reserva de domínios da plataforma (`admin.gauchinhoconsorcios.com.br`).
3. **/platform/empresas/nova — Nova Master Franquia**: Fluxo guiado em 8 etapas com governança atômica e criação no status seguro de **TREINAMENTO** (inativo até ativação explícita).

---

## 2. Entregáveis Realizados

### A. Banco de Dados e Migrations (`088_platform_templates_dominios_onboarding.sql`)
- **Tabela `site_modelos`**:
  - Estendida com `identidade_visual` (jsonb), `catalogo_menus` (jsonb), `secoes_home` (jsonb), `configuracao_footer` (jsonb), `codigo_customizado` (jsonb), `permite_logo_propria` (boolean), `logo_padrao_url` (text), `modelo_origem_id` (uuid).
- **Tabela `empresa_site_modelos`**:
  - Estendida com `menus_habilitados` (jsonb), `usar_logo_propria` (boolean), `secoes_customizadas` (jsonb).
- **Modelos Canônicos**:
  - `gauchinho_default`: Preservado integralmente como modelo canônico do ecossistema.
  - `racon_inspired`: Criado como modelo estruturado em rascunho com tokens visuais baseados na identidade azul royal, azul escuro, amarelo destaque e cards arredondados.
- **Funções / RPCs**:
  - `rpc_platform_criar_modelo_site`: Criação com versionamento automático.
  - `rpc_platform_duplicar_modelo_site`: Clonagem completa de tokens, menus e seções.
  - `rpc_platform_salvar_modelo_site`: Persistência das 8 abas com auditoria automática.
  - `rpc_platform_status_modelo_site`: Transição entre `RASCUNHO`, `PUBLICADO` e `INATIVO`.
  - `rpc_platform_criar_dominio_tenant`: Cadastro com bloqueio de host master reservado.
  - `rpc_platform_onboarding_master_franquia`: Orquestração atômica de criação de empresa em `em_treinamento`, branding, template, concessão de administradoras e assinatura de plano.

### B. Motor de Segurança e Sanitização (`src/lib/platform/html-sanitizer.ts`)
- Bloqueio estrito de tags executáveis: `<script>`, `<iframe>`, `<object>`, `<embed>`, `<base>`.
- Bloqueio de manipuladores de eventos inline (`onclick`, `onerror`, `onload`, etc.).
- Bloqueio de protocolos inseguros (`javascript:`, `vbscript:`, `data:text/html`).
- Bloqueio de injeções CSS: `@import`, `expression()`, `behavior:`, `-moz-binding:`.

### C. Telas e Componentes Platform
- **`src/app/platform/templates/`**:
  - Listagem com KPIs de templates, cards com visualização da paleta de cores, botões de ação e modal "+ Novo Modelo".
- **`src/app/platform/templates/[id]/`**:
  - Workspace com 8 abas: *1. Geral, 2. Identidade Visual, 3. Header & Menus, 4. Home & Seções (com botões ↑/↓), 5. Footer, 6. HTML Avançado Seguro, 7. Preview Dinâmico (Desktop/Tablet/Mobile), 8. Histórico*.
- **`src/app/platform/dominios/`**:
  - Tabela com domínios cadastrados, indicação de principal/ativo, status de verificação DNS e modal "+ Novo Domínio".
- **`src/app/platform/empresas/nova/`**:
  - Onboarding em 8 etapas com barra de progresso, validação por etapa e resumo geral antes da criação.

---

## 3. Testes e Validações

- **Testes Unitários e de Contrato**: 831 testes aprovados (`npm test`).
- **Verificação de Tipos TypeScript**: Aprovado com zero erros (`npx tsc --noEmit`).
- **Build de Produção Next.js**: Aprovado com sucesso (`npm run build`).
