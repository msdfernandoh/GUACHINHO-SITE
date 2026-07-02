# Testes — Pacote de Ajustes 3 (Eventos e Agenda)

## Migration

- Arquivo: `supabase/migrations/016_eventos_agenda.sql`
- Tabelas: `eventos`, `eventos_participantes`, `eventos_posts`, `agenda_compromissos`
- Colunas em `leads`: `evento_id`, `evento_nome`

## Eventos — admin

1. `/admin/eventos` — listar, criar, editar (Master).
2. Campos: publicado, somente por link, destaque, limite, acompanhante, exigir convidou.
3. Posts sociais na edição do evento (título, texto, imagem URL, ordem).
4. `/admin/eventos/[id]/participantes` — filtros, status, check-in, WhatsApp, export CSV.

## Eventos — público

1. Menu **Eventos** → `/eventos` (só eventos publicados com `somente_por_link = false`).
2. `/eventos/[slug]` — página individual (funciona com somente por link se publicado/ativo).
3. Inscrição: nome, telefone, acompanhante opcional, quem convidou, observação.
4. Limite: após enviar, se sem vaga → status `lista_espera` + mensagem de lista de interesse.
5. Lead criado com `origem = evento`, `evento_id`, `dados_simulacao` com detalhes.

## Especialista + evento destaque

- Com `evento_destaque = true`, modal Especialista exibe link “Inscrever-se no evento”.
- API: `GET /api/public/eventos/destaque`

## Leads

- Filtro **Evento** em `/admin/leads`.
- Detalhe do lead: bloco evento de origem + seção Agenda + link agendar.

## Agenda

- `/admin/agenda` — calendário mensal, clique no dia, novo compromisso, lista do dia.
- Concluir: resultado (Fechou, Sem interesse, Em negociação, Voltar a falar…) + retorno automático.
- SRD vê próprios compromissos; Master vê todos.

## Testes automatizados

- `src/lib/comercial-eventos/vagas.test.ts`

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```

## Aplicar migration

```bash
supabase db push
# ou SQL Editor com 016_eventos_agenda.sql
```
