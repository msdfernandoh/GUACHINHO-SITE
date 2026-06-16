# Fase 7.1 — Índices financeiros e calculadoras

## Migration

Aplicar no Supabase:

`supabase/migrations/013_indices_financeiros.sql`

## Admin — Índices financeiros

Rota: `/admin/indices-financeiros` (perfil **master**).

- Listar e editar taxas mensal, anual e acumulado 12 meses.
- Ativar/desativar índice, marcar **Atualização automática** (BCB: IPCA, CDI, Selic).
- **Atualizar agora** por índice ou **Atualizar automáticos (BCB)** em lote.
- **Data de referência** e **última atualização** exibidas após refresh.

### Cadastro manual

IGP-M, Poupança, Tesouro Selic e Tesouro IPCA+ começam com seed e devem ser ajustados manualmente até integração estável.

## API pública

`GET /api/public/indices-financeiros` — índices ativos para o front (sem chamada externa no navegador).

## Calculadoras

### Correção de aluguel (`/calculadoras?calc=correcao`)

- IPCA, IGP-M ou taxa manual.
- Período (12 meses padrão).
- **Usar índice atual** usa `valor_acumulado_12m` cadastrado.
- Mensagens: data da última atualização, fallback, aviso de estimativa.

### Aplicação mensal

- Poupança, CDI (% 90/100/110 ou manual), Tesouro Selic/IPCA+, taxa manual.
- **Comparar todos** exibe cards lado a lado.
- Avisos legais/comerciais no formulário e no Tesouro.

## Fallback

1. Admin ou job tenta BCB (server-side).
2. Sucesso → persiste no banco.
3. Falha → mantém último valor salvo; UI pode mostrar *Usando último índice cadastrado no sistema*.
4. Sem valor → usuário usa percentual manual ou índice fica indisponível.

## Eventos

- `indice_financeiro_consultado`
- `calculadora_aluguel_utilizada`
- `calculadora_aplicacao_comparativo_utilizada`
- Mantidos: `calculadora_utilizada`, `lead_criado`, `clique_whatsapp_pos_lead`

## Leads

`dados_simulacao` enriquecido para `correcao_aluguel` e `aplicacao_comparativo` conforme spec da fase.

## Limitações

- Poupança: taxa cadastrada, sem regra legal completa.
- Tesouro: estimativa sem impostos, taxas ou marcação a mercado.
- IGP-M / Tesouro: sem API automática na v1.
- IPCA via BCB SGS 433 (acumulado 12 meses), não SIDRA direto.

## Testes

```bash
cd gauchinho-app
npm test
npm run build
```

Arquivos: `indices.test.ts`, `aluguel.test.ts`, `aplicacao-comparativo.test.ts`.
