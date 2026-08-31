# Fase 175 — Agenda de equipe, dia todo e Google bidirecional

## Objetivo

Permitir compromissos individuais ou para toda a equipe, duração legível em horas e minutos, eventos de dia inteiro e importação opt-in da agenda principal do Google, corrigindo a dependência do fuso do servidor que deslocava horários no envio.

## Diagnóstico

- O formulário enviava `data` e `hora` sem fuso; o servidor construía `new Date("AAAA-MM-DDTHH:mm")`. Em Vercel isso interpretava a hora no fuso do processo, não no fuso operacional.
- O payload do Google declarava `America/Sao_Paulo`, diferente do escritório em Cuiabá.
- Um compromisso tinha somente um `consultor_id`; não existia snapshot dos participantes de um evento coletivo.
- A duração era um único campo técnico em minutos e não existia “Dia todo”.
- A integração era somente sistema → Google e a preferência ainda era lida da identidade global em alguns caminhos.
- Cancelamento tentava apagar o evento Google antes de provar, por RLS, que o ator podia operar o compromisso.

## Implementação

- Migration forward-only `172_agenda_equipe_dia_inteiro_google_bidirecional.sql`.
- `escopo = INDIVIDUAL|EQUIPE`, `dia_inteiro`, `origem = SISTEMA|GOOGLE` e metadados de sincronização.
- `agenda_compromisso_participantes` registra o snapshot de membros ativos com `acessar_agenda` na criação. Novos membros não são inseridos retroativamente.
- Inserção do compromisso e participantes ocorre na mesma transação por trigger; não existe compensação por delete.
- Conflitos são serializados por empresa com advisory transaction lock e incluem responsável ou qualquer participante.
- RLS permite ao participante ler o coletivo, mas escrita continua somente para agenda própria ou quem possui visão de equipe. Escrita direta na tabela de participantes é revogada.
- Evento coletivo exige `agenda_pode_ver_todos`; Laura mantém esse direito pelo vínculo N:N já configurado na Fase 172.
- Conversão explícita `America/Cuiaba`: `16/09/2026 15:00` vira `2026-09-16T19:00:00Z`. Nenhum compromisso histórico é recalculado.
- Formulários de criar/reagendar/retornar usam “Dia todo”, “Horas” e “Minutos”, mantendo compatibilidade com o campo legado em minutos.
- Eventos sem lead podem ser marcados como “Realizado” em RPC com lock e auditoria; atendimentos com lead mantêm o fechamento comercial existente.
- O envio Google usa um evento por participante conectado, ID determinístico para retry e vínculo com a conta Google. Uma conta trocada não consegue alterar/excluir evento da conta anterior.
- A remoção Google ocorre somente depois do cancelamento autorizado no sistema. Falhas preservam o vínculo para nova tentativa.
- Google → sistema é consentimento explícito por usuário e empresa, limitado a uma empresa por agenda principal. Eventos privados não têm título, descrição ou local importados.
- Eventos Google são editados no Google; eventos do sistema são editados no sistema. Essa política de origem evita conflito silencioso de duas fontes.
- Sincronização inicial cobre 30 dias passados e 370 futuros; depois usa `syncToken`, paginação e recuperação de token expirado (HTTP 410). Eventos já acompanhados que saem da janela são consultados individualmente.
- Cron `/api/cron/agenda-google` executa a cada dez minutos e exige `CRON_SECRET`; cada lote revalida consentimento, vínculo, permissão e conta.

## Preservação e segurança

- Backfill apenas cria um participante equivalente ao responsável de cada compromisso existente.
- `ON DELETE RESTRICT` protege compromissos, participantes, empresas e usuários; não houve limpeza ou recálculo.
- Credenciais Google continuam na tabela privada existente e nunca são enviadas ao navegador ou gravadas em auditoria.
- As rotas OAuth passaram a validar tenant, vínculo e `empresa_usuarios.google_agenda_sync`, sem autorizar pelo `usuarios.perfil` legado.
- RPC de importação é exclusiva de `service_role`, mas o papel privilegiado não basta: consentimento, empresa ativa, vínculo, permissão e e-mail conectado são revalidados no banco.
- A importação é idempotente por empresa, usuário, conta e ID do evento; versões Google mais antigas não sobrescrevem dados mais novos.

## Evidências

- Histórico remoto conferido no Supabase principal `eaeuoynprurmmulzhydt`: a
  migration 171 de cronograma próprio precede esta migration 172 da Agenda.
- Snapshot anterior: 24 compromissos, 5 disponibilidades, 3 metadados e 4 bloqueios.
- 16 testes PostgreSQL reais em PGlite cobrem atomicidade, RLS, cross-tenant, vínculo revogado, conflito, consentimento, idempotência e conta divergente.
- Testes direcionados de Agenda e Google: 73 aprovados.
- Suíte completa: 1.252 testes aprovados e 37 pulados preexistentes em 237 arquivos (228 aprovados, 9 pulados).
- TypeScript e build de produção aprovados. ESLint do escopo sem erros e com dois avisos preexistentes.
- Conferência visual no navegador: filtro Toda a equipe, evento “Inauguração”, lista Laura/Eroni, Dia todo, horas/minutos e campos desabilitados corretamente em Dia todo.

## Rollout e operação

1. Aplicar as migrations pendentes em ordem; a Agenda corresponde à 172.
2. Publicar o código em `main`.
3. Conferir que os 24 compromissos e as estruturas de disponibilidade foram preservados.
4. Criar um evento isolado de homologação para 15:00 e confirmar 15:00 no Google; depois cancelá-lo pelo fluxo normal.
5. Cada usuário que desejar Google → sistema deve conectar sua conta e autorizar explicitamente a importação. Não há ativação automática.

Rollback da aplicação permanece compatível com as colunas expansivas. O banco usa roll-forward; em incidente, desativar o cron/consentimentos e aplicar migration corretiva, sem remover as colunas ou participantes.

## Estado

Migration 172 aplicada no Supabase principal em 31/08/2026. O histórico remoto
ficou alinhado até 172 e o snapshot posterior preservou 24 compromissos, cinco
disponibilidades, três metadados e quatro bloqueios; o backfill criou os 24
participantes correspondentes, sem excluir ou recalcular compromissos. Código
integrado sobre o topo da `main` no commit da Fase 175, com build e testes
aprovados antes da promoção.
