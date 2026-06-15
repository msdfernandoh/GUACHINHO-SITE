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
| `supabase/migrations/` | SQL versionado |
| `supabase/seed.sql` | Config inicial + instruções Master |
| `.env.example` | Variáveis Supabase + `SITE_URL` |

> **Pivot:** implementação Prisma-first foi **descontinuada**; banco e auth são **somente Supabase**.

## Pré-requisitos

- Node.js 20+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (opcional, recomendado)
- Conta [Supabase](https://supabase.com) e [Vercel](https://vercel.com)

## 1. Supabase — projeto e schema

1. Crie um projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Copie **Project URL** e **anon key** (Settings → API). Service role key só no servidor.
3. Aplique o schema:
   - **Opção A (CLI):** na raiz do repo:
     ```powershell
     Set-Location "C:\Fernando Hugo\GAUCHINHO SITE"
     supabase link --project-ref SEU_PROJECT_REF
     supabase db push
     ```
   - **Opção B:** SQL Editor → cole `supabase/migrations/001_initial_schema.sql` → Run.
4. Rode o seed de config:
   ```powershell
   # SQL Editor ou: supabase db execute -f supabase/seed.sql
   ```

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
Copy-Item ..\.env.example .env.local
# Edite .env.local com URLs e chaves reais

npm install
npm run dev
```

Abra `http://localhost:3000` · Admin: `http://localhost:3000/login` · Grupos público: `http://localhost:3000/grupos`

### Rotas Fase 1 (app)

| Rota | Descrição |
|------|-----------|
| `/` | Home pública (tema escuro/dourado) |
| `/grupos` | Simulador público de grupos/cotas |
| `/login` | Auth Supabase |
| `/admin` | Dashboard (8 cards + 3 tabelas) |
| `/admin/leads` | Leads + filtros, manual, detalhe, histórico |
| `/admin/propostas` | CRUD propostas (`pdf_url` reservado) |
| `/admin/grupos` | CRUD grupos, cotas, colar lote, duplicar |
| `/admin/usuarios` | Master — Auth + `usuarios` |
| `/admin/configuracoes` | Abas Site, Contato, Propostas, Leads, WhatsApp |

API pública: `POST /api/public/grupos/fluxo` (lead + simulação + proposta opcional; usa service role no servidor).

## 4. Deploy Vercel

1. Importe o repositório (root ou `gauchinho-app` como Root Directory).
2. Environment variables (Production + Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL`
3. Em Supabase → Authentication → URL Configuration: adicione a URL da Vercel em **Site URL** e **Redirect URLs**.

## Storage (Fase 3+)

Criar bucket `propostas-pdf` (privado) e políticas via dashboard ou migration futura.

## Próximos passos (Fase 2+)

Simuladores consórcio/financiamento, PDF premium, vitrines — ver `docs/PLANO-EXECUCAO-FASES.md`.

## Blockers comuns

| Problema | Solução |
|----------|---------|
| RLS bloqueia insert | Usar service role no servidor ou ajustar políticas |
| Login sem perfil | Inserir linha em `usuarios` com `auth_user_id` correto |
| Variáveis ausentes | Conferir `.env.local` / Vercel env |
