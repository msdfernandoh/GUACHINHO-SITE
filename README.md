# Gauchinho Escritório de Soluções Financeiras

Plataforma de soluções financeiras (site público + admin). **Stack oficial:** Next.js na **Vercel** + **Supabase** (Postgres, Auth, Storage, RLS).

Documentação de produto: [`docs/PROJETO-GAUCHINHO-FASE-1.md`](docs/PROJETO-GAUCHINHO-FASE-1.md) · Roadmap: [`docs/PLANO-EXECUCAO-FASES.md`](docs/PLANO-EXECUCAO-FASES.md)

## Decisão de autenticação

- **Supabase Auth** (e-mail/senha) para login do admin.
- Perfil comercial em **`public.usuarios`**, ligado por **`auth_user_id`** → `auth.users.id`.
- Perfis: `master`, `srd`, `imobiliaria`, `visualizador`.
- **Não** usamos NextAuth/Auth.js nem bcrypt local para senhas de usuário — senhas ficam no Supabase Auth.
- **RLS** no Postgres; operações sensíveis no servidor podem usar **`SUPABASE_SERVICE_ROLE_KEY`** via `src/lib/supabase/admin.ts` (nunca no client).

## Estrutura do repositório

| Caminho | Descrição |
|---------|-----------|
| `gauchinho-app/` | App Next.js (TypeScript, Tailwind) — evoluir para raiz ou manter até consolidação |
| `gauchinho-app/src/lib/supabase/` | `client.ts`, `server.ts`, `admin.ts` |
| `gauchinho-app/src/lib/auth/permissions.ts` | Helpers de perfil |
| `gauchinho-app/package.json` | Scripts `dev` / `build` / `start` |
| `gauchinho-app/next.config.ts` | Config Next.js |
| `gauchinho-app/src/` | App Router (público + admin) |
| `supabase/migrations/` | SQL versionado (raiz do repo — aplicar no Supabase, não no build Vercel) |
| `supabase/seed.sql` | Config inicial + instruções Master |
| `.env.example` | Template na raiz |
| `gauchinho-app/.env.example` | Mesmo template (uso local dentro do app) |

> **Pivot:** implementação Prisma-first foi **descontinuada**; banco e auth são **somente Supabase**.

## Pré-requisitos

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (opcional, recomendado)
- Conta [Supabase](https://supabase.com) e [Vercel](https://vercel.com)

## 1. Supabase — antes do deploy / produção

Faça isto **antes** de testar login e admin em produção:

1. Criar projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Copiar **Project URL**, **anon key** e **service role key** (Settings → API). A service role **só no servidor** (Vercel env, nunca `NEXT_PUBLIC_*`).
3. Aplicar migrations **na ordem** no Supabase (SQL Editor ou `supabase db push` após `supabase link`):

```txt
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_storage_propostas_pdf.sql
supabase/migrations/003_cartas_contempladas.sql
supabase/migrations/004_grupos_modalidades_lance.sql
supabase/migrations/005_oportunidades_imobiliarias.sql
```

   - **004** — obrigatória para `/grupos` funcional (modalidades de lance, seguro `0,0004`, persistência da simulação).
   - **005** — obrigatória para **Oportunidades Imobiliárias** e login de imobiliária (tabelas, RLS, Storage, config home, origem WhatsApp).

   **CLI (raiz do repo):** `supabase link --project-ref SEU_PROJECT_REF` → `supabase db push`  
   **Ou** SQL Editor → colar cada arquivo → Run.
4. Rodar `supabase/seed.sql` (SQL Editor ou `supabase db execute -f supabase/seed.sql`).
5. **Authentication → Providers:** habilitar **Email** (e-mail/senha).
6. **Authentication → URL Configuration:**
   - **Site URL (local):** `http://localhost:3000`
   - **Site URL (Vercel):** `https://seu-app.vercel.app` (substitua pela URL real após o deploy)
   - **Redirect URLs:**
     ```txt
     http://localhost:3000/**
     https://seu-app.vercel.app/**
     ```
7. Criar usuário Master em **Authentication → Users** (ver secção 2).
8. Executar o SQL de vínculo `auth.users` → `public.usuarios` (secção 2).

## 2. Usuário Master (seed)

1. **Authentication → Users → Add user**
   - Email: `master@gauchinho.local`
   - Password: `Admin@123456`
2. SQL Editor (ajuste se necessário):

```sql
insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
select id, 'Master Gauchinho', email, 'master', true
from auth.users
where email = 'master@gauchinho.local'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id, perfil = 'master', ativo = true;
```

## 3. App Next.js (local)

```powershell
Set-Location "C:\Fernando Hugo\GAUCHINHO SITE\gauchinho-app"
Copy-Item .env.example .env.local
# Edite .env.local com URLs e chaves reais

npm install
npm run build
npm run dev
```

`npm run build` deve concluir sem erro antes de abrir PR ou deploy na Vercel.

Abra `http://localhost:3000` · Admin: `http://localhost:3000/login` · Grupos público: `http://localhost:3000/grupos`

### Rotas Fase 1 (app)

| Rota | Descrição |
|------|-----------|
| `/` | Home pública (tema escuro/dourado) |
| `/grupos` | Simulador público de grupos/cotas |
| `/oportunidades-imobiliarias` | Vitrine de imóveis e imobiliárias parceiras (Fase 5) |
| `/simulador` | Consórcio + financiamento (Fase 2), comparação e captura de lead |
| `/login` | Auth Supabase |
| `/admin` | Dashboard (8 cards + 3 tabelas) |
| `/admin/leads` | Leads + filtros, manual, detalhe, histórico |
| `/admin/propostas` | CRUD propostas (`pdf_url` reservado) |
| `/admin/grupos` | CRUD grupos, cotas, colar lote, duplicar |
| `/admin/imobiliarias` | Master — imobiliárias parceiras (Fase 5) |
| `/admin/imoveis` | Imóveis (Master ou imobiliária — escopo por perfil) |
| `/admin/minha-imobiliaria` | Perfil imobiliária — dados próprios |
| `/admin/usuarios` | Master — Auth + `usuarios` |
| `/admin/configuracoes` | Abas Site, Contato, Propostas, Leads, WhatsApp |

API pública: `POST /api/public/grupos/fluxo` · `POST /api/public/simulador/captura`

Testes: `cd gauchinho-app && npm test` · Docs: `docs/RELATORIO-TESTES-FASE-1.md`, `docs/CALCULOS-GRUPOS.md`, `docs/TESTES-SIMULADORES-FASE-2.md`, `docs/TESTES-GRUPOS-TABELA-FUNCIONAL.md`

### Migration obrigatória — grupos funcionais (004)

Para a tabela pública `/grupos` (uma linha por grupo, modalidades de lance, seguro `0,0004`, persistência completa da simulação), aplique no **Supabase SQL Editor**:

```txt
supabase/migrations/004_grupos_modalidades_lance.sql
```

A migration cria a tabela `grupos_modalidades_lance`, amplia `simulacoes_grupos_itens`, ajusta precisão de `seguro_percentual` e políticas RLS. É **compatível** com dados já existentes (`IF NOT EXISTS` / colunas opcionais).

**Sem a 004:**

- modalidades de lance no admin podem falhar ao salvar;
- campos novos da simulação em `/grupos` podem não ser persistidos corretamente;
- o PDF pode não receber todos os dados novos da seleção.

#### Checklist manual pós-migration

1. Entrar como **Master**.
2. Ir em `/admin/grupos`.
3. Criar ou editar um grupo.
4. Cadastrar modalidades de lance (ex.: **25% embutido**; **50% embutido + 10% próprio**).
5. Salvar.
6. Reabrir o grupo e confirmar que as modalidades persistiram.
7. Ir em `/grupos`.
8. Escolher **valor da cota** no select e informar **quantidade**.
9. Escolher **modalidade de lance** (se houver mais de uma).
10. Usar **recurso próprio** em **%**, depois testar em **R$**.
11. Testar **com seguro** e **sem seguro**.
12. Ativar **mais de um grupo** e conferir o **resumo consolidado**.
13. **Gerar simulação** → **Gerar proposta** → **baixar PDF**.

Detalhes e testes automatizados: [`docs/TESTES-GRUPOS-TABELA-FUNCIONAL.md`](docs/TESTES-GRUPOS-TABELA-FUNCIONAL.md).

### Migration obrigatória — oportunidades imobiliárias (005)

Arquivo:

```txt
supabase/migrations/005_oportunidades_imobiliarias.sql
```

Contém: tabelas `imobiliarias` e `imoveis`, FKs em `usuarios`, `leads` e `eventos_site`, RLS, buckets Storage **`imobiliarias`** e **`imoveis`**, config JSON **`home_oportunidades_imobiliarias`** e origem WhatsApp **`oportunidade_imobiliaria`**.

**Sem a 005:**

- `/oportunidades-imobiliarias` pode falhar (tabelas inexistentes);
- admin de imobiliárias/imóveis não funciona;
- login de usuário **imobiliária** não tem vínculo (`imobiliaria_id`);
- upload de logo, banner e foto do imóvel pode falhar;
- fluxo de lead **Tenho interesse** / WhatsApp por imóvel não funciona.

Checklist manual pós-005: [`docs/TESTES-FASE-5-OPORTUNIDADES-IMOBILIARIAS.md`](docs/TESTES-FASE-5-OPORTUNIDADES-IMOBILIARIAS.md).

**Build local:** `npm run build` **não** aplica SQL; só compila o app. Em runtime/prerender, rotas que consultam `imobiliarias`/`imoveis` exigem a **005 já aplicada** no projeto Supabase apontado por `.env.local`.

## 4. Deploy na Vercel via Git

O Next.js vive em **`gauchinho-app/`**. O SQL do Supabase fica na **raiz** (`supabase/`); aplique no dashboard/CLI — não entra no build da Vercel.

### Passo a passo

1. Código no GitHub (`main`), por exemplo `msdfernandoh/GUACHINHO-SITE`.
2. [Vercel](https://vercel.com) → **Add New… → Project** → importar o repositório.
3. **Root Directory:** `gauchinho-app` (obrigatório — não use `./` na raiz do repo).  
   Se o Root Directory for `gauchinho-app`, a Vercel ignora o `vercel.json` da raiz do repositório e usa `gauchinho-app/vercel.json`.  
   Se o Root Directory for `./`, o `vercel.json` na raiz do repo redireciona install/build para `gauchinho-app/` (fallback).
4. **Framework Preset:** Next.js (detectado dentro de `gauchinho-app`).
5. **Install Command:** `npm install`
6. **Build Command:** `npm run build`
7. **Output:** padrão Next.js (não alterar).
8. **Environment Variables** (Production **e** Preview):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=
```

| Variável | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase (Settings → API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave **anon** (pública no browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role — **apenas servidor**; na Vercel, **não** marcar como exposta ao client |
| `NEXT_PUBLIC_SITE_URL` | URL final do site (`https://seu-projeto.vercel.app` ou domínio customizado) |

9. **Deploy**.
10. Copiar a URL de produção → atualizar `NEXT_PUBLIC_SITE_URL` na Vercel → **Redeploy** se necessário.
11. Atualizar **Supabase Auth → URL Configuration** com a URL final e redirects (secção 1).
12. Testar o checklist pós-deploy (abaixo).

### Git — o que versionar

`.gitignore` (raiz e `gauchinho-app`) ignora: `.env`, `.env.local`, `.env.production`, `node_modules`, `.next`.

Podem ir no Git: `.env.example`, `gauchinho-app/.env.example`, `supabase/migrations`, `supabase/seed.sql`, código do app, README.

**Sem Prisma:** dependências e schema são somente Supabase (`@supabase/supabase-js`, migrations SQL).

### Checklist pós-deploy

- [ ] Home (`/`) abre
- [ ] `/grupos` público abre
- [ ] `/login` abre
- [ ] Login Master funciona
- [ ] `/admin` e subrotas (`/admin/leads`, `/admin/propostas`, `/admin/grupos`, `/admin/usuarios`, `/admin/configuracoes`)
- [ ] Criar lead manual; criar grupo e cotas
- [ ] Fluxo público em `/grupos` → simulação → lead no admin

### Problemas comuns (produção)

| Sintoma | Verificar |
|---------|-----------|
| **`404: NOT_FOUND` na URL `.vercel.app`** | Quase sempre **Root Directory** errado ou deploy sem sucesso. Em **Project Settings → General → Root Directory** use `gauchinho-app` (não `./`). Em **Build & Development**, deixe Install `npm install` e Build `npm run build` (ou vazio para usar o `gauchinho-app/vercel.json`). Abra **Deployments** e confirme que o último deploy de `main` está **Ready** (não Failed). A URL correta é a do projeto (ex.: `guachinho-site.vercel.app`); domínios antigos de preview não servem como produção. |
| Erro de env no build/runtime | Variáveis na Vercel; `SUPABASE_SERVICE_ROLE_KEY` definida |
| Login ok, admin nega | `usuarios.auth_user_id`, `perfil = master`, `ativo = true` |
| Auth redirect falha | `NEXT_PUBLIC_SITE_URL` + Redirect URLs no Supabase |
| RLS / insert público | Service role só em `src/lib/supabase/admin.ts` e rotas servidor |

## Storage — propostas PDF (Fase 3)

- Bucket Supabase: **`propostas-pdf`** (privado). Ver `supabase/migrations/002_storage_propostas_pdf.sql` e `docs/PROPOSTA-PDF-FASE-3.md`.
- Geração: `@react-pdf/renderer` no servidor; download via URL assinada ou `/api/propostas/[id]/pdf`.
- Testes: `docs/TESTES-FASE-3-PROPOSTAS.md`.

## Storage (Fase 3+ — outros)

## Próximos passos (Fase 2+)

Simuladores consórcio/financiamento, PDF premium, vitrines — ver `docs/PLANO-EXECUCAO-FASES.md`.

## Blockers comuns

| Problema | Solução |
|----------|---------|
| RLS bloqueia insert | Usar service role no servidor ou ajustar políticas |
| Login sem perfil | Inserir linha em `usuarios` com `auth_user_id` correto |
| Variáveis ausentes | Conferir `.env.local` / Vercel env |
