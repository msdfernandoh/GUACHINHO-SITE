# Relatório de Fase 219 — Área de Login e Backoffice Administrativo em Domínios de Parceiros (Racon Sinop)

## 1. Visão Geral e Contexto
- **Fase:** 219
- **Data:** 10/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Objetivo:** 
  1. Corrigir o desvio e bloqueio indevido no proxy do Next.js que reescrevia requisições de backoffice (`/admin` e `/erp`) para a home page institucional de sites parceiros (ex.: `raconsinop.com.br`), fazendo o usuário ser jogado de volta à página inicial após submeter o login.
  2. Permitir que todos os usuários ativos da Gauchinho Consórcios acessem o painel administrativo (`/admin`) e o ERP (`/erp`) navegando a partir do domínio do parceiro.
  3. Garantir a preservação estrita do isolamento e das permissões de leads: consultores com flag `leads_apenas_proprios` continuam visualizando apenas seus próprios leads atribuídos, enquanto administradores e sócios visualizam todos os leads.
  4. Unificar o pipeline de proxy e cookies de sessão (`@supabase/ssr`), garantindo que tanto as requisições autenticadas quanto as rotas protegidas sejam verificadas e que os tokens de sessão sejam atualizados continuamente.
  5. Injetar a identidade visual do parceiro (`Racon Sinop`, tema claro `racon_inspired`, cor primária azul `#0066cc`) nos layouts de login, admin e ERP quando a sessão é acessada através do domínio do parceiro (`x-parceiro-site-id`).

---

## 2. Causa Raiz e Diagnóstico Técnico

1. **Rewrite Inadvertido de Rotas de Backoffice:**
   - Em `gauchinho-app/src/proxy.ts`, o array `partnerOperationalPaths` continha apenas `["/simulador", "/grupos", "/consorcio", "/proposta", "/area-parceiro", "/indicar", "/login"]`.
   - Ao acessar `raconsinop.com.br/login`, a tela de login abria normalmente. O usuário preenchia as credenciais e submetia o formulário chamando `loginAction`.
   - A action autenticava no Supabase e redirecionava para `/admin`.
   - O navegador solicitava `GET https://raconsinop.com.br/admin`.
   - Como `/admin` e `/erp` não constavam em `partnerOperationalPaths`, o proxy executava `NextResponse.rewrite(rewriteUrl)` para `/parceiro/racon-sinop` (a home institucional do parceiro), fazendo o usuário retornar para a página inicial sem acessar o painel.

2. **Desvio do Pipeline Unificado de Autenticação:**
   - O branch de parceiro efetuava retornos antecipados (`return NextResponse.next(...)`), ignorando as proteções de rota e os redirecionamentos canônicos para usuários logados ou deslogados.

3. **Herança de Branding no Contexto do Tenant:**
   - O helper `getResolvedTenant()` lia somente `empresa_branding` e `empresa_site_modelos` da Gauchinho, não enriquecendo os layouts com o nome e identidade do parceiro associado ao domínio.

---

## 3. Componentes e Entregas

### 3.1. Proxy Unificado e Backoffice Habilitado (`proxy.ts`)
- Arquivo: `gauchinho-app/src/proxy.ts`.
- Expandido o array `partnerOperationalPaths` para incluir:
  - `/admin` (e sub-rotas)
  - `/erp` (e sub-rotas)
  - `/login`
  - `/esqueci-senha`
  - `/definir-senha`
  - `/auth`
  - `/simulador`
  - `/grupos`
  - `/consorcio`
  - `/proposta`
  - `/contratar`
  - `/area-parceiro`
  - `/indicar`
- Removidos os retornos antecipados no branch de parceiro; o proxy agora define `partnerRewriteSlug` exclusivamente para rotas que não pertencem a módulos operacionais, APIs ou backoffice (ex.: a home page `/`).
- Resposta unificada: o pipeline de sessão do Supabase instancia `createServerClient` preservando cookies renovados tanto para respostas normais quanto para rewrites.
- Proteção estendida de backoffice: `if (path.startsWith("/admin") || path.startsWith("/erp"))` redireciona automaticamente para `/login?next=...` se o usuário não estiver autenticado.
- Redirecionamento canônico de usuário logado acessando `/login` preservado.

### 3.2. Identidade Dinâmica de Parceiro em `getResolvedTenant`
- Arquivo: `gauchinho-app/src/lib/tenant/get-resolved-empresa.ts`.
- Leitura do header `PARCEIRO_SITE_ID_HEADER` (`x-parceiro-site-id`) injetado pelo proxy.
- Quando presente, chama `loadPartnerSiteViewModel({ siteId, empresaId })` para enriquecer `branding` e `siteModel`:
  - `nome_site`: exibe "Racon Sinop"
  - `cor_primaria`: define a cor azul da Racon (`#0066cc`)
  - `siteModel`: define `codigo = "racon_inspired"`, `layoutBase = "racon_inspired"`, fazendo com que `isRaconModel(tenant.siteModel)` avalie como `true`.
  - `isGauchinhoTenant` passa a retornar `false` quando há parceiro ativo no host.

### 3.3. Adaptação dos Layouts Administrativo e de Login
- Arquivo: `gauchinho-app/src/app/admin/layout.tsx`.
  - Atualizado `TenantBrandProvider` para marcar `isGauchinho: !tenant?.parceiroSiteId && tenant?.slug === GAUCHINHO_SLUG`.
  - O tema visual do admin em `raconsinop.com.br` renderiza em tema claro Racon (`tenant-admin-racon`), exibindo "Racon Sinop" na sidebar e no cabeçalho.
- O layout do ERP (`gauchinho-app/src/app/erp/layout.tsx`) e a tela de login (`app/(auth)/login/page.tsx`) consomem automaticamente `tenant.branding` enriquecido, exibindo "Acesso Racon Sinop" e a paleta azul Racon.

---

## 4. Testes e Validação

1. **Teste de Contrato Automatizado (Vitest):**
   - Criado `src/lib/parceiros/partner-login-backoffice-219-contract.test.ts` (7 testes aprovados).
   - Suíte de parceiros e contratos: 13 arquivos e 132 testes 100% aprovados.
   - Suíte de contratos da Fase 212 e 213 aprovada sem regressões.
2. **Isolamento de Leads:**
   - Testada a função `leadVisibleForScope`: consultores com `leadsApenasProprios: true` visualizam exclusivamente seus próprios leads atribuídos, enquanto administradores e sócios visualizam todos os leads.
3. **Build de Produção (Next.js 16 Turbopack):**
   - Executado `npm run build` com sucesso (código de saída 0).
   - 153 páginas estáticas e dinâmicas geradas sem erros de tipagem TypeScript ou linting.
