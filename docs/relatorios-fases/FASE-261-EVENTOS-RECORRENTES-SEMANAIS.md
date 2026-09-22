# Fase 261 — Eventos recorrentes semanais

## Entrega

- Um evento pode ser marcado como **Repetir este evento toda terça-feira**.
- A configuração preserva um nome e slug-base e gera novas edições com data,
  por exemplo: `Network de Negócios — 29/09` e
  `network-de-negocios-2026-09-29`.
- A ação **Gerar próxima edição** permite criar antecipadamente a próxima
  semana. A operação é idempotente e abre a edição já existente se ela tiver
  sido criada antes.
- O job protegido por `CRON_SECRET` é agendado diariamente às 03:00 no fuso
  `America/Cuiaba`. Após uma edição semanal ocorrer, ele desativa essa edição,
  encerra seu check-in e cria/publica a seguinte.
- O Network de Negócios de terça-feira é marcado como recorrente pela migration
  sem criar retrospectivamente uma edição nem modificar seus fatos históricos.

## Preservação de dados

Cada semana é um evento novo. A duplicação copia somente configuração pública
e operacional (textos, localização, imagens, inscrição, visual, check-in e
responsáveis pelos leads). Ela nunca copia participantes, check-ins, sorteios,
prêmios, resultados, leads ou histórico de qualificação.

O QR Code físico permanece com o mesmo link. Na virada, o vínculo anterior é
encerrado e é criado um vínculo novo para a próxima edição, mantendo o mesmo
intervalo relativo ao horário do evento.

## Segurança e implantação

- A geração manual exige perfil autorizado de Eventos; a rotina automática
  exige `CRON_SECRET` e usa a rotina exclusiva de `service_role`.
- A migration forward-only é
  `supabase/migrations/246_eventos_recorrencia_semanal.sql`.
- A publicação requer configurar `CRON_SECRET` no ambiente Vercel (caso ainda
  não exista; o mesmo segredo já protege os demais jobs) e aplicar a migration
  no Supabase correto antes de ativar a interface em produção.

## Verificação

- `npx tsc --noEmit`
- `npx eslint --quiet` no escopo alterado
- `npx vitest run src/lib/comercial-eventos/eventos-recorrentes-261-contract.test.ts`
