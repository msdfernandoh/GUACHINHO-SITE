# RELATÓRIO DE FASE — FASE 242: SEO COMPLETO, METATAGS, SCHEMA.ORG E OTIMIZAÇÃO PARA IA (GEO)

> **Data de Homologação:** 18/09/2026  
> **Escopo:** `gauchinhoconsorcios.com.br` (Master Tenant) e `raconsinop.com.br` (Portal Parceiro Racon Sinop MT)  
> **Status:** Concluído e Validado

---

## 1. Contexto e Motivação

O projeto conta com dois domínios canônicos principais em produção:
1. `gauchinhoconsorcios.com.br` — Portal da franqueadora Master Gauchinho Consórcios.
2. `raconsinop.com.br` — Portal parceiro Racon Consórcios da unidade de Sinop - MT.

O objetivo desta fase foi implantar uma infraestrutura completa de SEO técnico, estruturação de metadados, conformidade com os novos padrões de busca para Inteligências Artificiais (GEO — Generative Engine Optimization: ChatGPT, SearchGPT, Perplexity AI, Google Gemini, Claude e Copilot), dados estruturados Schema.org, sitemaps dinâmicos e preparação para validação imediata no Google Search Console e Google Meu Negócio.

---

## 2. Diagnóstico das Lacunas Identificadas

1. **Perda da Tag de Verificação do Google:**
   - O `RootLayout` possuía `verification: { google: ... }` apenas no objeto estático de fallback. Quando um tenant era resolvido pela função dinâmica `generateMetadata()`, a chave `verification` não era propagada, impedindo a verificação de domínio por meta tag em produção.
2. **Sitemaps e Robots Rígidos (Single-Tenant):**
   - Ao acessar `https://www.raconsinop.com.br/robots.txt` ou `/sitemap.xml`, a aplicação respondia com a URL de sitemap e links da Gauchinho (`https://www.gauchinhoconsorcios.com.br`), gerando conflito canônico e penalização no Google para a Racon Sinop.
   - O sitemap continha rota com redirecionamento 308 (`/casos-de-sucesso`), gerando alertas no Google Search Console.
3. **Ausência de Schema.org na Racon Sinop:**
   - A página pública da Racon Sinop não emitia dados estruturados de `LocalBusiness`, `FinancialService` ou `FAQPage`.
4. **Ausência de Otimização para IA (GEO):**
   - Ausência do padrão moderno `/llms.txt` e `/llms-full.txt` e ausência de permissões explícitas no `robots.txt` para rastreadores de IA generativa (`GPTBot`, `PerplexityBot`, `Google-Extended`, etc.).
5. **SEO Local Incompleto para Sinop / MT:**
   - Falta de geo-tags e marcação de latitude/longitude (`-11.8642, -55.5053`) nas páginas para potencializar o ranqueamento em buscas regionais no Norte de Mato Grosso.

---

## 3. Implementações Realizadas

### 3.1. Resolução Multi-Domínio de Origem (`src/lib/seo/site-url.ts`)
- Adicionadas constantes canônicas `CANONICAL_GAUCHINHO_ORIGIN` (`https://www.gauchinhoconsorcios.com.br`) e `CANONICAL_RACON_ORIGIN` (`https://www.raconsinop.com.br`).
- Implementadas as funções `isRaconHost(host)` e `resolveOriginFromHost(host, protocol)`, permitindo que layouts, sitemaps, robots e endpoints identifiquem com precisão o portal acessado.

### 3.2. Sitemaps Dinâmicos (`src/app/sitemap.ts`)
- O arquivo `sitemap.ts` agora utiliza `headers()` para identificar dinamicamente a requisição:
  - Requisições em `raconsinop.com.br`: Geram sitemap exclusivo da Racon Sinop com URLs `https://www.raconsinop.com.br/...` (Home, Simulador, Grupos, Consórcio, Segmentos Imóvel/Auto/Pesados, Parceiros, Indicar, FAQ).
  - Requisições em `gauchinhoconsorcios.com.br`: Geram o catálogo completo da Gauchinho.
  - Removido o path redirecionado `/casos-de-sucesso`, mantendo zero erros e advertências no Google Search Console.

### 3.3. Robots.txt Dinâmico e Amigável a IAs (`src/app/robots.ts`)
- O `sitemap` apontado no `robots.txt` é derivado dinamicamente do host da requisição (`https://${host}/sitemap.xml`).
- Criadas regras com permissões expressas para os rastreadores:
  - `Googlebot`, `Bingbot`, `Applebot`, `Applebot-Extended`
  - `GPTBot`, `ChatGPT-User`, `OAI-SearchBot` (OpenAI)
  - `PerplexityBot` (Perplexity AI)
  - `Google-Extended` (Google Gemini e AI Overviews)
  - `ClaudeBot`, `anthropic-ai` (Anthropic)
- Permissões explícitas para `/llms.txt` e `/llms-full.txt`.
- Proteção mantida contra indexação de rotas administrativas e privadas (`/admin/`, `/erp/`, `/login`, `/api/`, `/definir-senha`).

### 3.4. Protocolo GEO para Mecanismos de IA (`/llms.txt` e `/llms-full.txt`)
- Criadas rotas dedicadas:
  - `src/app/llms.txt/route.ts`: Resumo estruturado em Markdown com links, diferenciais competitivos, modalidades e contatos.
  - `src/app/llms-full.txt/route.ts`: Contexto completo e factual com explicação de funcionamento, ausência de juros bancários, lance embutido de até 30% e FAQ detalhado.
  - As rotas se adaptam dinamicamente conforme o domínio acessado (Racon Sinop vs Gauchinho Consórcios).

### 3.5. Verificação Automática do Google Search Console & Geo Tags
- Em `src/app/layout.tsx`:
  - `generateMetadata()` agora sempre preserva e emite `verification: { google: ... }`, lendo env vars dedicadas (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_GAUCHINHO`, `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION_RACON`) com fallback seguro.
  - Adicionadas meta tags geográficas em `other`:
    - `geo.region: "BR-MT"`
    - `geo.placename: "Sinop"`
    - `geo.position: "-11.8642;-55.5053"`
    - `ICBM: "-11.8642, -55.5053"`
- Em `src/proxy.ts`:
  - Interceptação automática de `/google[codigo].html`, respondendo com status 200 e conteúdo `google-site-verification: google[codigo].html`. Isso permite validação com 1 clique no Google Search Console sem necessidade de upload de arquivos estáticos.

### 3.6. Schema.org JSON-LD Completo
- **Gauchinho Consórcios (`src/components/public/seo/public-json-ld.tsx`):**
  - Entidades `Organization`, `FinancialService` e `LocalBusiness`.
  - Coordenadas geográficas de Sinop MT (`-11.8642, -55.5053`), horário de atendimento e catálogo de ofertas financeiras.
  - `FAQPage` integrado para snippets e Google AI Overviews.
  - `WebSite` com `SearchAction`.
- **Racon Sinop MT (`src/components/public/seo/racon-json-ld.tsx`):**
  - Componente criado e integrado na página pública Racon (`src/app/(parceiro-site)/parceiro/[slug]/page.tsx`).
  - Identificação de `parentOrganization` (Racon Consórcios - Empresas Randon).
  - Telefone, WhatsApp, área atendida no Mato Grosso, catálogo de planos e FAQ específico da Racon.

### 3.7. Enriquecimento de Metadados nas Páginas Públicas
- Adicionada metadata completa em `/parceiros` (`src/app/(public)/parceiros/page.tsx`).
- Enriquecidas as meta tags (OpenGraph, Twitter Cards e keywords) em `/simulador`, `/grupos` e `/perguntas-frequentes`.

---

## 4. Testes e Validação

- Testes unitários implementados em `src/lib/seo/seo-multi-domain.test.ts`:
  - Resolução de origem canônica por host (Racon vs Gauchinho vs localhost).
  - Emissão correta das regras de bots IA e busca em `robots.ts`.
  - Validação de formato e conteúdo dos endpoints `/llms.txt` e `/llms-full.txt`.
  - Validação de geração de sitemap e exclusão de URLs com redirect 308.
- Resultado: **9 testes aprovados** com sucesso na suíte Vitest.
