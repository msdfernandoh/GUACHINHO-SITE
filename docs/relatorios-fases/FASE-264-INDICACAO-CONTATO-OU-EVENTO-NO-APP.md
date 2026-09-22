# Fase 264 — Indicação de contato ou evento no app

## Objetivo

Permitir que o indicador autenticado escolha, ao iniciar uma nova indicação,
entre cadastrar uma oportunidade comercial ou convidar uma pessoa para um
evento publicado.

## Entregas

- A ação **Nova indicação** abre uma escolha explícita entre **Contato** e
  **Evento**.
- O fluxo **Contato** mantém o formulário conversacional e as regras de
  atribuição já homologadas.
- O fluxo **Evento** apresenta somente eventos ativos, publicados e ainda
  disponíveis, com data e local para conferência.
- O convite cria ou atualiza o lead pelo telefone, registra a origem do evento
  e preserva o vínculo canônico com o indicador autenticado.
- O convidado é incluído na lista do evento com `status_presenca = pendente`,
  ficando disponível para a confirmação posterior.
- A lista identifica o indicador pelo vínculo autenticado no servidor; IDs de
  indicador ou consultor não são aceitos do navegador.
- Reenvios do mesmo telefone para a mesma lista atualizam o item existente e
  não criam uma duplicidade intencional.

## Segurança e multiempresa

O tenant e o usuário são obtidos pela sessão ativa. O participante comercial e
o registro de `programa_indicadores` são resolvidos no servidor e o lead é
consolidado dentro da empresa ativa. Um lead já atribuído a outro indicador não
pode ter sua atribuição sobrescrita pelo novo convite.

## Banco de dados

Nenhuma migration foi necessária. Foram reutilizadas as estruturas existentes:

- `leads`;
- `programa_indicacoes`;
- `eventos`;
- `eventos_listas_convidados`;
- `eventos_listas_convidados_itens`.

## Validação

- `npx tsc --noEmit --pretty false`;
- ESLint dos arquivos alterados;
- testes contratuais das fases 254 e 264;
- `npm run build`.
