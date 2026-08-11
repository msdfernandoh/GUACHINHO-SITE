# PLATFORM HOST — ADMIN.GAUCHINHOCONSORCIOS.COM.BR

**Data:** 11/08/2026  
**Escopo:** entrada canônica do `PLATFORM_SUPERADMIN`; sem alteração nas migrations 060–063, tenant Gauchinho ou sorteios.

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

O estado anterior do host administrativo era 404 após ele ser registrado como domínio Production, o que é esperado até a promoção deste proxy. O smoke final após a promoção deve comprovar TLS, redirect anônimo ao login e preservação do host Gauchinho.
