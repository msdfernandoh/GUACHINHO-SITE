# Relatório de testes — Fase 1

**Data:** 15/06/2026  
**Ambiente:** local (`gauchinho-app`, `.env.local` com Supabase)  
**Responsável:** validação automatizada + revisão de código

## Rotas verificadas

| Rota | Build / tipagem | Teste manual E2E |
|------|-----------------|------------------|
| `/` | OK | Pendente no browser |
| `/grupos` | OK | Pendente |
| `/login` | OK | Pendente |
| `/admin` e subrotas listadas no README | OK | Pendente (requer Master) |

## O que passou

- `npm install`, `npm run build` e `npm test` (11 testes Vitest: cálculos de grupos + simuladores).
- Estrutura App Router: home, grupos, login, admin (leads, propostas, grupos, usuários, configurações).
- API pública `POST /api/public/grupos/fluxo` (lead, simulação, proposta, eventos).
- Middleware protege `/admin`; layout exige `usuarios` ativo.
- Service role isolada em `admin.ts` / rotas API.
- Sem dependência Prisma.

## O que falhou / limitações

- **Teste manual completo** (login Master, CRUD leads/grupos, fluxo `/grupos`) não executado nesta sessão — depende de Supabase populado e usuário Master.
- Aviso Next.js 16: convenção `middleware` deprecada (não bloqueia build).

## Correções feitas na Fase 2 (base Fase 1)

- Separação `src/lib/config/defaults.ts` para evitar import de `next/headers` em componentes client do admin.
- Testes unitários em `src/lib/grupos/calculos.test.ts`.

## Pendências

- [ ] Executar checklist manual do README com Master em ambiente local ou Vercel.
- [ ] Confirmar RLS/policies com usuário `anon` no fluxo público de grupos.
- [ ] Migrar `middleware` → `proxy` quando estabilizar guia do Next 16.

## Observações técnicas

- Migrations SQL ficam em `supabase/` na raiz do repositório.
- Simuladores Fase 2 adicionam `/simulador` sem remover `/grupos`.
