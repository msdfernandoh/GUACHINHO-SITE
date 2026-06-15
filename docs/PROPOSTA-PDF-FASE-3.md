# Proposta PDF Premium — Fase 3

## Biblioteca

**`@react-pdf/renderer`** (v4+)

- Compatível com Node/Vercel (sem Chromium).
- Layout declarativo (React → PDF).
- Múltiplas páginas, tabelas e estilos premium (capa escura + dourado).

## Fluxo

1. Dados da proposta carregados em `src/lib/proposta/load-pdf-data.ts`.
2. Render em `src/lib/proposta/pdf/proposta-pdf-document.tsx` → buffer.
3. Upload em `src/lib/proposta/storage.ts` → bucket **`propostas-pdf`**.
4. Campo `propostas.pdf_url` guarda o **path** no bucket (`{propostaId}.pdf`).
5. Download via URL assinada (`createSignedUrl`) ou rota `/api/propostas/[id]/pdf`.

## Supabase Storage

Migration: `supabase/migrations/002_storage_propostas_pdf.sql`

Ou manualmente:

1. Storage → **New bucket** → `propostas-pdf` (privado).
2. MIME: `application/pdf`.
3. Rodar policies da migration (staff autenticado lê; upload via service role na API).

## Páginas do PDF

1. Capa — marca Gauchinho, parceiro opcional, cliente, validade.
2. Resumo executivo — cards + aviso.
3. Detalhamento — consórcio / financiamento / grupos.
4. Comparativo consórcio x financiamento (se houver dados).
5. Programação financeira — marcos 1, 3, 5, 10 anos e final (consórcio).
6. Atendimento — consultor ou Gauchinho (contato do admin).

## Origens

| Origem | Geração automática de PDF |
|--------|---------------------------|
| `/grupos` — ação **Gerar proposta** | Sim |
| `/simulador` — **Gerar proposta** | Sim |
| `/admin/propostas` — botão **Gerar PDF** | Sim |

## Campos

**Obrigatórios no PDF:** nome cliente, tipo proposta, data emissão.

**Opcionais:** parceiro, consultor, validade, e-mail, grupos/cotas, comparativo, projeção.

## Limitações atuais

- Logo/parceiro: texto (sem imagem remota ainda).
- Bucket ausente: upload falha com fallback de path (PDF não baixa até bucket existir).
- CRUD de parceiros: campo manual `parceiro_nome` (Racon, Creditas, Tutors).

## Próximas melhorias

- Logo PNG/SVG no PDF.
- CRUD parceiros + `parceiro_logo_url`.
- Link público com token de longa duração.
- Envio automático por WhatsApp/e-mail.
