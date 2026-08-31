# Fase 172 — Agenda comercial tenant-aware, UX e permissões

## Objetivo

Permitir que operadores autorizados, como a SDR Laura, consultem e operem a agenda da equipe sem confundir identidade global com vínculo da empresa, preservando os compromissos existentes e o isolamento SaaS.

## Diagnóstico confirmado

- Laura possuía `agenda_acesso_todos=false` no vínculo da Gauchinho e, por isso, a aplicação filtrava `consultor_id` para a própria identidade.
- Eroni possuía vínculo ativo e compromissos reais atribuídos à sua identidade.
- A aplicação gravava as opções de acesso no vínculo N:N, mas a Agenda ainda autorizava parte das operações pelo perfil legado.
- `agenda_compromissos`, disponibilidade e bloqueios não carregavam `empresa_id`.
- A conclusão atualizava compromisso e lead em operações separadas.

## Implementação

- Migration forward-only `162_agenda_comercial_tenant_ux_permissoes.sql`.
- Migration complementar `163_agenda_compatibilidade_escrita_legada.sql`, que deriva o tenant de requisições da versão anterior somente por lead ou vínculo único ativo e falha em ambiguidade.
- Migration temporária `164_agenda_disponibilidade_compatibilidade_legada.sql` preserva a tela antiga de disponibilidade até a publicação do runtime tenant-aware; vínculos multiempresa ambíguos falham fechados.
- Backfill determinístico: primeiro pelo lead; na ausência dele, somente por vínculo único ativo do responsável. A auditoria prévia encontrou 24 compromissos, zero ambíguos e zero sem mapeamento.
- `empresa_id NOT NULL`, índices por empresa/data/responsável/status e validação cross-tenant de lead e responsável.
- RLS explícita por operação; leitura e escrita dependem de `acessar_agenda` e da agenda própria ou `agenda_acesso_todos`/papel gestor.
- Disponibilidade, metadados e bloqueios também se tornam tenant-aware.
- RPC `rpc_concluir_compromisso_agenda` com lock, validação, atualização do lead, conclusão e auditoria na mesma transação.
- Ações servidor resolvem o tenant pelo host/vínculo e filtram todos os UUIDs por `empresa_id`.
- Detecção de conflito de horário na criação e no reagendamento.
- Interface com filtro de responsável, filtro de status, nomenclatura “realizado”, seleção de lead por nome/WhatsApp e ação “Não compareceu”.
- A configuração da disponibilidade mostra apenas os compromissos do próprio usuário.

## Preservação

- Nenhum compromisso é removido ou recalculado.
- Status e resultados históricos permanecem intactos.
- O backfill falha fechado caso apareça qualquer registro sem origem determinística.
- Nenhum UUID de tenant foi inserido no código ou na migration.

## Evidências locais

- Testes unitários da Agenda: 8 aprovados.
- Teste de contrato da Fase 172 cobre tenant, RLS, cross-tenant e atomicidade.
- ESLint sem erros no escopo alterado.
- TypeScript `--noEmit` aprovado.

## Rollout

1. Aplicar a migration 162 no projeto principal.
2. Habilitar `agenda_acesso_todos` no vínculo da Laura na empresa Gauchinho.
3. Publicar a aplicação compatível.
4. Validar Laura → visão “Toda a equipe” → compromissos do Eroni → conclusão/retorno.

Rollback de aplicação é compatível com as colunas expandidas; banco segue roll-forward. A nova RLS não deve ser revertida para a policy ampla legada.

## Estado em 31/08/2026

- Migrations 162, 163 e 164 aplicadas no Supabase principal.
- 24 compromissos preservados, todos com `empresa_id`; 18 pertencem ao Eroni.
- Laura confirmada com `agenda_acesso_todos=true` no vínculo Gauchinho e no campo legado consumido pelo runtime anterior.
- Build de produção, TypeScript, lint do escopo e 12 testes da Agenda aprovados.
- O deploy isolado foi preparado sobre `origin/main` e contém somente a Agenda, mas a Vercel recusou a promoção com `Not authorized`. Portanto, a nova UI permanece pronta no código local; a versão publicada continua operacional pelas pontes 163/164 e já libera a visão da equipe para Laura.


