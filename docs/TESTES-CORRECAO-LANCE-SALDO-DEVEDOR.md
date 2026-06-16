# Testes — correção lance / saldo devedor / Home / RLS

## Base correta do lance

```txt
base_lance = saldo_devedor_total_atual
valor_lance_embutido = saldo × % embutido / 100
valor_lance_proprio = saldo × % próprio / 100  (ou valor informado)
saldo_pos_lance = saldo − lance_total
credito_liquido = crédito_contratado − lance_embutido
```

### Exemplo de validação

| Campo | Valor |
|--------|--------|
| Crédito | R$ 500.000 |
| Taxa adm + fundo | 24% |
| Saldo devedor | R$ 620.000 |
| Embutido 25% | R$ 155.000 |
| Próprio 10% | R$ 62.000 |
| Lance total | R$ 217.000 |
| Saldo pós-lance | R$ 403.000 |
| Crédito líquido | R$ 345.000 |

## Arquivos alterados (pré-Fase 10)

- `src/lib/grupos/simulacao-linha.ts` — `saldoPosLance`, parcela pós-cont. sobre saldo após 1ª parcela
- `src/components/public/grupos/grupos-table.tsx`, `grupo-row.tsx`, `grupo-row-adjustments.tsx` — ordem de colunas e rótulos
- `src/components/public/grupos/lance-strategy-selector.tsx` — base só saldo devedor
- `src/lib/simulador/preview-home.ts`, `config.ts` — parcela rápida da Home
- `src/app/(public)/page.tsx`, `home-v2-client.tsx` — config oficial via `getSimuladorConfigsPublic`
- `src/app/admin/grupos/actions.ts` — fallback client autenticado se service role ausente
- Testes: `simulacao-linha.test.ts`, `calculos.test.ts`, `preview-home.test.ts`

## Tabela `/grupos`

Ordem: Grupo → Cota → Qtd. → Soma → **Saldo devedor** → Parcela → lances → crédito líquido → **Saldo pós-lance** → Pós-cont.

## Simulador rápido Home

- Não usa mais `taxaAdmin` hardcoded (18% / 2%).
- Usa `getSimuladorConfigsPublic()` (mesma origem que `/simulador`).

## RLS `grupos_modalidades_lance`

**Causa:** política antiga (`004`) comparava `usuarios.id = auth.uid()` e perfis `Master/Admin/SRD`, incompatível com `auth_user_id` e perfis minúsculos (`master`, `srd`).

**Correção:**

1. Aplicar migration `supabase/migrations/011_grupos_modalidades_lance_rls.sql` no Supabase.
2. Admin continua salvando modalidades via `createAdminClient()` (service role, bypass RLS).
3. Se `SUPABASE_SERVICE_ROLE_KEY` não estiver definida, `syncModalidadesLance` usa o client da sessão (exige migration 011).

## Testes manuais

### Admin

1. Grupo com 1, 2 e 3 modalidades ativas — salvar sem erro RLS.
2. Editar e inativar modalidade.

### `/grupos`

1. Cota R$ 500.000, taxa+fundo 24% → saldo R$ 620.000.
2. 25% embutido → R$ 155.000; 10% próprio → R$ 62.000.
3. Coluna saldo devedor entre Soma e Parcela.

### Home

1. Alternar consórcio/financiamento — parcela coerente com `/simulador` (mesmos defaults de config).

## Comandos

```bash
cd gauchinho-app
npm test
npm run build
```
