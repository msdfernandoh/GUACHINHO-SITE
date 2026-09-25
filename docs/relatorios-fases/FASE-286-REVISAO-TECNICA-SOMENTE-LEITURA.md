# Fase 286 — Revisão técnica somente leitura

## Decisão

Para a análise de um técnico de TI durante a negociação, o acesso de criação de unidades foi substituído por uma conta temporária de consulta. O proprietário autorizou expressamente a leitura de dados existentes em produção. O revisor não recebe vínculo com qualquer tenant em `empresa_usuarios` nem privilégios de superadmin.

## Implementação

- `plataforma_revisores_tecnicos` controla autorização e expiração de 30 dias; `is_platform_technical_reviewer()` exige usuário ativo e prazo vigente.
- A migration 287 instala o bloqueio de `INSERT`, `UPDATE` e `DELETE` em tabelas públicas para sessões de revisão, inclusive se alguma política legada permitir escrita ao papel `authenticated`. A migration 288 mantém o bloqueio mesmo após a expiração do acesso. A conta usa `usuarios.perfil = parceiro`, que não ativa o helper legado `is_staff()`.
- O host global libera ao revisor somente `/platform/revisao`; requisições não GET/HEAD são recusadas. A página revalida o papel no servidor.
- A página consulta por cliente administrativo apenas colunas explícitas e páginas de 50 registros de empresas, usuários, leads, propostas, grupos e vendas, com filtro de empresa onde há vínculo. Nenhuma ação de escrita é exposta.
- `/platform/acessos-cadastro` continua exclusivo do superadmin e gera conta exclusiva com senha temporária, troca obrigatória e prazo de 30 dias. A conta não herda permissões de e-mail preexistente.
- A conta solicitada será `bruno@msdeducacao.com.br`.

## Validação e implantação

- TypeScript, lint, build e teste de autorização de rotas aprovados.
- Migrations 286 a 288 aplicadas em produção.
- A conta `bruno@msdeducacao.com.br` foi criada com senha inicial e troca obrigatória, sem vínculo `empresa_usuarios`, com expiração em 24/10/2026.
- A sessão autenticada retornou `is_platform_technical_reviewer() = true`, `is_platform_superadmin() = false` e `is_staff() = false`. Uma inserção de teste foi recusada pelo banco com código `42501`, sem criar registro.
- O deploy isolado foi publicado no host administrativo. Nenhuma alteração paralela do checkout principal foi incluída.
