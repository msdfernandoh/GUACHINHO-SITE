# Testes — Pacote de ajustes 1 (Gauchinho)

Documentação dos cambios do pacote 1 e roteiro de testes manuais.

## Migration

- `supabase/migrations/015_pacote_ajustes_1.sql`
  - Colunas em `leads`: `parceiro_indicador_nome`, `parceiro_indicador_empresa`, `tipo_credito`, `valor_credito`, `observacao_indicacao`
  - Tabela `seguradoras` + bucket Storage `seguradoras` + RLS

Aplicar no Supabase antes de testar cadastros e seguradoras.

## Arquivos alterados (principais)

| Área | Arquivos |
|------|----------|
| Home / carousel | `src/app/(public)/home-v2-client.tsx`, `src/app/(public)/home-v2/page.tsx` |
| Header / Especialista | `src/components/public/public-header-nav.tsx`, `especialista-lead-modal.tsx`, `public-header.tsx`, `public-logo.tsx` |
| Indicação | `src/app/(public)/indicar/page.tsx`, `indicacao-form.tsx`, `api/public/leads/indicacao/route.ts` |
| Especialista API | `api/public/leads/especialista/route.ts` |
| Simulador | `consorcio-result-cards.tsx`, `simulador-app.tsx`, `asset-type-selector.tsx` |
| Grupos / Veículo | `lib/types/index.ts`, `grupos-public-client.tsx`, `modalidade-label-publica.ts`, cards da home |
| Seguradoras | `admin/seguradoras/*`, `components/admin/seguradora-form.tsx`, `(public)/seguradoras/page.tsx`, `seguradoras-public-client.tsx`, `lib/storage/*` |

## Como testar — Home

1. Abrir `/`.
2. Confirmar que **não** aparece `Casa.png` (ou outro nome de arquivo).
3. Aguardar ~6s: slide deve trocar sozinho (Chrome/Edge).
4. Testar anterior/próximo e tabs laterais.
5. Barra de progresso deve reiniciar a cada slide.
6. Mobile: menu abre abaixo do header, sem cobrir logo.

## Como testar — Especialista

1. Clicar **Especialista** no header.
2. Preencher nome, WhatsApp, tipo e valor (sem e-mail).
3. Salvar → mensagem de sucesso + WhatsApp se configurado em `whatsapp_origens`.
4. Admin → Leads: origem `especialista`, campos `tipo_credito` / `valor_credito`.

## Como testar — Indicação

1. Abrir `/indicar`.
2. Preencher quem indicou + 2 indicados (+ **Adicionar outra indicação**).
3. Salvar → 2 leads com `origem = indicacao` e mesmo indicador/empresa.

## Como testar — Simulador

1. Crédito R$ 500.000 (taxas padrão → saldo ~620.000).
2. Lance própria carta 25% → R$ 155.000.
3. **Crédito líquido** → R$ 345.000.
4. Saldo após lance → R$ 465.000 no subtítulo do card de lance / pós-contemplação.
5. Card único **Custo adm. efetivo** (mensal + anual).
6. Botão **Veículo** seleciona e permanece selecionado.

## Como testar — Seguradoras

1. Admin → Seguradoras → nova → logo + salvar.
2. Recarregar edição: dados persistidos.
3. Público `/seguradoras`: listagem se `ativo` + `publicado`.

## Como testar — Mobile

1. Menu hamburger: links legíveis, Especialista e Login acessíveis.
2. Sem scroll horizontal no header.

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```
