# Testes — Fase 3 Propostas PDF

**Data:** 15/06/2026  
**Build:** `cd gauchinho-app && npm run build` — OK

## Pré-requisito Supabase

- [ ] Bucket `propostas-pdf` criado (migration `002` ou dashboard).
- [ ] Variáveis Vercel/local: `SUPABASE_SERVICE_ROLE_KEY` para upload.

## Admin

- [ ] Criar proposta manual em `/admin/propostas/nova`.
- [ ] Abrir detalhe → **Gerar PDF** → status `PDF gerado`.
- [ ] **Baixar PDF** / **Copiar link**.
- [ ] Lead vinculado → seção **Propostas** com baixar/gerar.

## /grupos

- [ ] Selecionar cota → **Gerar proposta** → lead + PDF.
- [ ] Link **Baixar proposta PDF**.
- [ ] PDF contém tabela de grupos/cotas (se simulação gravada).

## /simulador

- [ ] Simular consórcio → **Gerar proposta** → PDF.
- [ ] Simular financiamento → **Gerar proposta** → PDF.
- [ ] Comparativo e projeção no PDF (consórcio).

## Storage

- [ ] Arquivo `{uuid}.pdf` no bucket.
- [ ] `propostas.pdf_url` preenchido.
- [ ] `/api/propostas/{id}/pdf` redireciona para URL assinada.

## Eventos (tabela `eventos_site`)

- [ ] `proposta_pdf_gerada`
- [ ] `proposta_pdf_baixada`
- [ ] `proposta_link_copiado` (admin toolbar)

## Regressão Fase 1/2

- [ ] `/`, `/grupos`, `/simulador`, `/login`, admin leads/grupos.
