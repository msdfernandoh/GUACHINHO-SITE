# PLATFORM HOST — ADMIN.GAUCHINHOCONSORCIOS.COM.BR

**Data:** 11/08/2026  
**Escopo:** entrada canônica do `PLATFORM_SUPERADMIN`; sem alteração nas migrations 060–063, tenant Gauchinho ou sorteios.  
**Status:** **ATIVA E VALIDADA EM PRODUÇÃO.**

## Arquitetura

`admin.gauchinhoconsorcios.com.br` é contexto `PLATFORM`, e não domínio de tenant. Ele é resolvido antes de `empresa_dominios`, não produz headers de empresa e não pode retornar a Gauchinho por fallback. O host comercial permanece separado:

- `gauchinhoconsorcios.com.br` e `www.gauchinhoconsorcios.com.br` → tenant Gauchinho;
- `admin.gauchinhoconsorcios.com.br` → `PLATFORM`.

O proxy usa o RPC existente `is_platform_superadmin()`; não usa `usuarios.perfil` nem cria autenticação ou papel adicional. Anônimo é direcionado ao login. Após autenticação, somente `PLATFORM_SUPERADMIN` entra nas telas master existentes (`/admin/empresas` e `/admin/administradoras`). Os papéis `admin_empresa`, `gestor`, `consultor` e `visualizador` recebem 403.

## Vercel e DNS

- equipe: `hugo-8097s-projects`;
- domínio raiz: `gauchinhoconsorcios.com.br`, criado por `hugo-8097` e servido por `ns1.vercel-dns.com` / `ns2.vercel-dns.com`;
- `admin.gauchinhoconsorcios.com.br` foi associado ao deployment Production e adicionado ao projeto `guachinho-site` pela API oficial Vercel;
- a API retornou `verified: true`, sem challenge DNS adicional; o certificado wildcard foi emitido;
- DNS público resolve para a edge Vercel.

## Validações antes da promoção

- testes de host/RBAC: **36 PASS**;
- TypeScript: **PASS**;
- build Next.js: **PASS**;
- host PLATFORM reconhecido sem consultar `empresa_dominios` (teste com `fetch` não chamado);
- anônimo → login; `PLATFORM_SUPERADMIN` → painel master; quatro papéis comuns → bloqueio, todos cobertos por teste de política;
- `www.gauchinhoconsorcios.com.br` permaneceu HTTP 200 durante a configuração Vercel.

## Validação final em Produção

O commit `7fad6c1ee55bbed7cb3b9e325c8e017554ae52a6` foi implantado no deployment Production `dpl_FbDjRArcVB4Nvm1woko5L7JJyRkp`, estado `READY`.

- TLS/DNS: ativo pela edge Vercel;
- `https://admin.gauchinhoconsorcios.com.br/` anônimo → **307** para `/login?next=/admin/empresas`;
- `https://www.gauchinhoconsorcios.com.br/` → **200** e continua no tenant Gauchinho;
- `https://gauchinhoconsorcios.com.br/` → **308** canônico para `www`, preservando o tenant Gauchinho;
- reconhecimento de `PLATFORM` antes de `empresa_dominios`, autorização por `is_platform_superadmin()` e bloqueio dos quatro papéis comuns foram validados pelos testes de política e do resolver.

**ADMIN.GAUCHINHOCONSORCIOS.COM.BR — ENTRADA CANÔNICA DO PLATFORM SUPERADMIN ATIVA E VALIDADA EM PRODUÇÃO.**
