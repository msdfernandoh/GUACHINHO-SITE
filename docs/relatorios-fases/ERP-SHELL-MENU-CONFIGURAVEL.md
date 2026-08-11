# ERP Sistema — shell e menu configurável por empresa

Status: implantado em Produção; smoke anônimo aprovado. A navegação autenticada permanece coberta por guards, configuração e testes técnicos, sem sessão de usuário usada nesta rodada.

## Rotas ERP encontradas e reutilizadas

- `/admin/dashboard`, `/admin/leads`, `/admin/propostas`, `/admin/contratacoes`, `/admin/vendas`, `/admin/grupos`, `/admin/comissoes`, `/admin/financeiro`, `/admin/relatorios`, `/admin/metas`, `/admin/tarefas` e `/admin/usuarios`.
- O novo `/erp` e `/erp/[modulo]` renderizam as implementações já existentes; não foram criados serviços, banco, sessão ou módulos de negócio paralelos.

## Layout e governança

- Layout claro com sidebar de ERP e retorno explícito ao Portal (`/admin`).
- Botão `ERP Sistema` no painel administrativo do tenant quando habilitado.
- Catálogo controlado em `lib/erp/erp-modulos.ts`; Administradoras não faz parte do catálogo.
- Configuração reutiliza `empresas.configuracoes.erp_sistema`; somente a tela Platform Superadmin de empresa pode editá-la.
- A migration local `067_erp_sistema_gauchinho_config.sql` prepara a ativação da Gauchinho com os módulos existentes, exceto Administradoras. Não foi aplicada.

## Testes

- `npm test`: PASS — 115 arquivos, 671 testes; o teste de sorteios/Caixa passou isoladamente nesta branch e em `origin/main`. O timeout anterior não foi reproduzido e o arquivo permaneceu inalterado.
- `npx tsc --noEmit`: PASS.
- Teste unitário do catálogo ERP: PASS (2 testes).
- Build: PASS, com `/erp` e `/erp/[modulo]` presentes.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Supabase descartável `ucxncmzotckeotqjhjvt`: migrations 064–067 aplicadas; Gauchinho recebeu somente `erp_sistema` com 12 módulos válidos; Empresa B não recebeu a chave.

## Preview / Production

- Preview READY: `https://guachinho-site-fvx9mhzn4-hugo-8097s-projects.vercel.app`.
- Migration 067: aplicada em Produção em 11/08/2026; conferência posterior retornou `001–067` local=remote e dry-run sem pendências.
- `main` antes: `cef2c8c4082f44e7afcbb28e9dc2fb6b78c683bd`; após merge/push: `55f7715cea0bec077a3592eb16a9dd81d93c9bb6`.
- Deployment Production: `dpl_FkuFYLNuZ9jwULjg21qgdUkfneLg`, READY. Os aliases canônicos foram promovidos explicitamente para este deployment.
- Smoke: `/`, `/grupos`, `/simulador` e `/login` retornaram 200; raiz sem `www` retorna 308; `/admin`, `/erp` e Platform Host anônimos retornam 307 para autenticação; `/api/public/grupos/sorteios` retorna 200.
- Gauchinho: ERP ativo com `painel`, `leads`, `propostas`, `contratacoes`, `vendas`, `grupos`, `comissoes`, `financeiro`, `relatorios`, `metas`, `tarefas` e `usuarios`. Administradoras e sorteios não pertencem ao catálogo ERP; Empresa B permanece sem `erp_sistema`.
