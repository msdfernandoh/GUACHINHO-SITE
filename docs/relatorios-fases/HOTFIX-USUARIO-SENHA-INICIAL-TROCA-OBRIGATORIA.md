# Hotfix — cadastro direto de usuário com senha inicial

Data: 28/08/2026

Escopo: Platform SaaS → Usuários / primeiro acesso

Banco: sem migration, backfill ou fixture

## Resultado

O cadastro de usuários da Master Franquia deixou de disparar os fluxos
distintos de convite e recuperação do Supabase. O Platform Superadmin agora
cria o acesso diretamente e recebe uma senha inicial forte para copiar uma
única vez. O vínculo é ativado sem depender da entrega de e-mail.

No primeiro login, `app_metadata.exige_troca_senha` obriga a sessão a passar
por `/definir-senha`. A navegação só é liberada depois que a senha é alterada e
o marcador é concluído pelo servidor. O fluxo antigo de ativação permanece
somente como compatibilidade para convites históricos.

## Proteções preservadas

- autorização exclusiva de Platform Superadmin;
- quotas, papéis COMPANY e módulos efetivos continuam validados pela RPC
  canônica de cadastro;
- a senha inicial não é persistida nem registrada em auditoria;
- usuário global já ativo em outra empresa mantém a credencial existente;
- nenhum dado comercial, histórico ou tenant foi recriado;
- nenhuma empresa foi ativada automaticamente por esta entrega.

## Validação

- TypeScript: aprovado;
- teste de contrato do cadastro/primeiro acesso: 7 testes aprovados;
- lint do escopo: sem erros (um warning preexistente no fechamento do modal de
  edição);
- suíte completa: 197 arquivos aprovados, 9 ignorados; 1.070 testes
  aprovados, 37 ignorados;
- build de produção: aprovado com Webpack; a tentativa Turbopack local foi
  impedida exclusivamente pelo junction externo de `node_modules` da worktree;
- `npm audit --omit=dev`: 0 vulnerabilidades;
- publicação: registrada no fechamento da entrega.
