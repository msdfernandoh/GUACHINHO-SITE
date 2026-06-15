# Setup rápido do Supabase (banco vazio → admin funcionando)

Use este guia quando o projeto Supabase está **sem tabelas** e o login/admin não abre.

## O que precisa existir no banco

| Ordem | Arquivo | Depende de | O que cria |
|------|---------|------------|------------|
| **1** | `supabase/migrations/001_initial_schema.sql` | — | Tabelas (`usuarios`, `leads`, `grupos_*`, …), funções RLS (`is_master`, `is_staff`), políticas |
| **2** | `supabase/migrations/002_storage_propostas_pdf.sql` | **001** (`public.usuarios` nas policies de Storage) | Bucket `propostas-pdf` + policies |
| **3** | `supabase/migrations/003_cartas_contempladas.sql` | **001** (`public.leads`, `public.is_staff()`) | Tabela `cartas_contempladas` + FK em `leads` |
| **4** | `supabase/seed.sql` | **001** (`configuracoes_sistema`, `whatsapp_origens`) | Configurações padrão e origens WhatsApp |
| **5** | Usuário Auth + SQL Master | **001** | Linha em `public.usuarios` ligada ao login |

**Nunca pule a ordem:** 002 e 003 falham se 001 não rodou. O seed falha se as tabelas de config não existirem.

---

## Opção A — Supabase Dashboard (recomendado se o banco está vazio)

### 1. Abrir o SQL Editor

1. [Supabase Dashboard](https://supabase.com/dashboard) → seu projeto  
2. Menu lateral: **SQL** → **New query**

### 2. Rodar as migrations (uma query por vez)

Para cada arquivo, **copie o conteúdo inteiro** do repositório, cole no editor e clique **Run** (ou Ctrl+Enter). Espere sucesso antes da próxima.

1. `supabase/migrations/001_initial_schema.sql`  
2. `supabase/migrations/002_storage_propostas_pdf.sql`  
3. `supabase/migrations/003_cartas_contempladas.sql`  
4. `supabase/seed.sql`

### 3. Conferir tabelas

**Table Editor** → schema `public` → deve aparecer pelo menos: `usuarios`, `configuracoes_sistema`, `leads`, `grupos_consorcio`, `cartas_contempladas`, etc.

**Storage** → bucket `propostas-pdf` (após o 002).

### 4. Auth (e-mail/senha)

1. **Authentication** → **Providers** → **Email** habilitado  
2. **Authentication** → **URL Configuration**  
   - **Site URL:** `http://localhost:3000` (dev) e/ou URL da Vercel em produção  
   - **Redirect URLs:**  
     ```txt
     http://localhost:3000/**
     https://SEU-APP.vercel.app/**
     ```

### 5. Criar usuário Master no Auth

1. **Authentication** → **Users** → **Add user** → **Create new user**  
2. Preencher:  
   - **Email:** `master@gauchinho.local`  
   - **Password:** `Admin@123456` (ou outra senha forte; use a mesma no login)  
3. Marcar **Auto Confirm User** (confirmar e-mail), se a opção existir.

### 6. Vincular Auth → `public.usuarios`

**SQL** → **New query** → Run:

```sql
insert into public.usuarios (auth_user_id, nome, email, perfil, ativo)
select id, 'Master Gauchinho', email, 'master', true
from auth.users
where email = 'master@gauchinho.local'
on conflict (email) do update
  set auth_user_id = excluded.auth_user_id,
      perfil = 'master',
      ativo = true;
```

Conferir: **Table Editor** → `usuarios` → uma linha com `perfil = master` e `ativo = true`.

### Master de produção (Fernando)

Para criar **Auth + `usuarios`** de uma vez (e-mail `msdfernando@gmail.com`), rode no SQL Editor o arquivo:

`supabase/sql/criar-master-fernando.sql`

Se preferir não usar senha no SQL, crie o usuário no **Authentication → Users** com esse e-mail e execute só o `insert into public.usuarios ...` equivalente (mesmo padrão do passo 6, trocando o e-mail).

---

## Opção B — Supabase CLI

Na **raiz do repositório** (pasta `GAUCHINHO SITE`, onde está `supabase/migrations/`):

```powershell
# Instalar CLI: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

O `db push` aplica **todas** as migrations em ordem numérica (001 → 002 → 003).

Depois, rodar o seed:

```powershell
supabase db execute -f supabase/seed.sql
```

Em seguida, faça os passos **4–6** da Opção A (Auth, usuário Master, SQL de vínculo). O seed **não** cria o usuário Auth automaticamente (só comentários no final do arquivo).

---

## Variáveis de ambiente (local e Vercel)

Copie de **Project Settings → API** no Supabase.

| Variável | Onde | Obrigatória |
|----------|------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + servidor | Sim |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + servidor | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | **Só servidor** (nunca `NEXT_PUBLIC_*`) | Sim (criar usuários, PDF, etc.) |
| `NEXT_PUBLIC_SITE_URL` | Redirects/links | Sim (`http://localhost:3000` ou URL Vercel) |

**Local:** `gauchinho-app/.env.local` a partir de `gauchinho-app/.env.example` (ou `.env.example` na raiz — mesmo conteúdo).

**Vercel:** Project → **Settings** → **Environment Variables** — as quatro variáveis em **Production** (e Preview se usar). Redeploy após alterar.

Sem URL/anon key corretas: login pode falhar ou o middleware não protege `/admin` como esperado.

---

## Por que o admin “não entra” sem banco / sem `usuarios`

Fluxo do app (`gauchinho-app`):

1. **Middleware** (`src/middleware.ts`): em `/admin`, exige sessão Supabase Auth. Sem login → redireciona para `/login?next=/admin`.
2. **Layout admin** (`src/app/admin/layout.tsx`): chama `getUsuarioNegocio()`. Se não houver linha em `public.usuarios` (ou `ativo = false`, ou erro de query porque a tabela não existe), faz `redirect("/login?next=/admin")`.
3. **`getUsuarioNegocio`** (`src/lib/auth/get-usuario.ts`): busca `usuarios` onde `auth_user_id = auth.users.id`. Qualquer erro ou ausência de linha → trata como **sem perfil** (`null`).

Sintomas comuns:

| Situação | O que você vê |
|----------|----------------|
| Banco vazio (sem migration 001) | Login pode até funcionar, mas ao ir para `/admin` volta para login ou **loop de redirect** (login manda para `/admin`, layout manda de volta ao login). |
| Login OK, sem INSERT em `usuarios` | Mesmo loop ou “não entra no admin”. |
| Só Auth, senha errada | Mensagem de erro na tela de login (`/login?error=...`). |
| Env apontando para **outro** projeto Supabase | Tabelas no dashboard de um projeto, app usando outro — parece “banco vazio”. |

**Solução:** migrations na ordem + seed + usuário Auth + SQL de vínculo na **mesma** instância cujas chaves estão no `.env.local` / Vercel.

---

## Login no admin (depois do setup)

1. App rodando: `cd gauchinho-app` → `npm run dev`  
2. Abrir: `http://localhost:3000/login`  
3. E-mail: `master@gauchinho.local`  
4. Senha: a definida no passo **Add user** (ex.: `Admin@123456`)  
5. Deve abrir `/admin` com sidebar e dashboard.

Rotas úteis: `/admin`, `/admin/leads`, `/admin/grupos`, `/admin/usuarios` (só perfil `master`), `/admin/configuracoes`.

---

## Checklist rápido

- [ ] 001 → 002 → 003 → seed executados sem erro  
- [ ] Bucket `propostas-pdf` visível em Storage  
- [ ] Email provider ativo  
- [ ] Redirect URLs configuradas  
- [ ] Usuário `master@gauchinho.local` em Authentication  
- [ ] Linha em `public.usuarios` com `perfil = master`  
- [ ] `.env.local` / Vercel com as 4 variáveis do **mesmo** projeto Supabase  

Mais detalhes: [`README.md`](../README.md) (secções 1 e 2).
