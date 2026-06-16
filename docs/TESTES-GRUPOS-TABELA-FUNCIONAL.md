# Testes — Tabela funcional /grupos

Checklist manual e automatizado para a simulação por grupo (modelo Excel).

## Automatizado (`gauchinho-app`)

```bash
cd gauchinho-app
npm test -- src/lib/grupos
```

Cobre:

- Fator de seguro `0,0004` e legado percentual
- Soma das cotas (crédito × quantidade)
- Seguro mensal = saldo × fator
- Agregação de totais
- Formato de prazo `total / restante / realizadas`

## Tela pública `/grupos`

- [ ] Cada grupo aparece **uma única vez** na lista
- [ ] Filtros Todos / Imóvel / Auto / Moto no topo (sem coluna Tipo na tabela)
- [ ] Select de **Cota / valor do crédito** por grupo
- [ ] **Qtd. cotas** (mín. 1 para ativar; 0 = grupo inativo)
- [ ] **Soma das cotas** recalcula ao mudar crédito ou quantidade
- [ ] **Parcela** reduzida / integral quando configurado no admin
- [ ] **Lance embutido** liga/desliga; múltiplas modalidades → select
- [ ] **Recurso próprio** % ou R$; aviso se abaixo do mínimo da modalidade
- [ ] **Seguro** com/sem quando habilitado no grupo
- [ ] Coluna **Prazo** `220 / 209 / 11`
- [ ] **Saldo devedor final** e **parcela pós-contemplação** na linha
- [ ] **Resumo inferior** soma vários grupos (cotas, lances, crédito líquido)
- [ ] **Gerar simulação** e **Gerar proposta** com seleção ativa
- [ ] Mobile: cards expansíveis com os mesmos campos

## Validação contra Excel

Caso de referência (grupos **1513** e **1533**, 1 cota cada, modalidade **40%** embutido sobre saldo devedor cadastrado):

| Campo | Entrada / fixture | Esperado (planilha) |
| --- | --- | --- |
| Grupo 1513 | Crédito R$ 1.050.000; saldo cadastrado R$ 1.037.000; taxa adm 22%; fundo 2% | — |
| Grupo 1533 | Crédito R$ 1.000.000; saldo cadastrado R$ 1.040.000; taxa adm 22%; fundo 2% | — |
| Soma das cotas | 1 + 1 cotas | R$ 2.050.000,00 |
| Lance embutido | 40% × (1.037.000 + 1.040.000) | R$ 830.800,00 |
| Crédito líquido | soma cotas − lance embutido (recurso próprio não reduz crédito) | R$ 1.219.200,00 |

**Resultado do sistema:** coberto por `simulacao-linha.test.ts` → `caso Excel — grupos 1513 e 1533` (deve passar em `npm test -- src/lib/grupos`).

**Regras documentadas no código:**

- `credito_liquido = soma_cotas - lance_embutido`
- `lance_embutido = saldo_devedor × % modalidade` (saldo prioriza valor cadastrado na cota × quantidade)
- `seguro_mensal = saldo_devedor × fator` (fator decimal `0,0004` sem dividir por 100)
- `saldo_devedor` sem cadastro: `soma_cotas + taxa_adm% + fundo_reserva%` sobre a soma

**Observações:** primeira parcela e saldo devedor total na planilha dependem dos valores cadastrados por cota (`valor_parcela`, `saldo_devedor`); use os mesmos no admin para bater linha a linha.

**Pendências:** conferência manual da parcela pós-contemplação e do PDF após alterar dados reais no Supabase.

## Admin `/admin/grupos` (salvar e cotas)

- [ ] **Salvar grupo** persiste dados principais, financeiro, modalidades e flags **sem** exigir nova cota no bulk
- [ ] **Cotas cadastradas:** editar, inativar/reativar, excluir (Master) com confirmação
- [ ] `/grupos` lista apenas cotas **ativas**


## Banco

Aplicar migration `supabase/migrations/004_grupos_modalidades_lance.sql` no projeto Supabase (obrigatório para modalidades e persistência completa).

## Checklist manual pós-migration (Master)

1. `/admin/grupos` — criar/editar grupo com modalidades (25% embutido; 50% + 10% próprio).
2. Salvar e reabrir — modalidades persistidas.
3. `/grupos` — cota, quantidade, lance, recurso próprio (% e R$), seguro on/off.
4. Vários grupos — resumo inferior.
5. Gerar simulação, proposta e PDF.

## Build

```bash
cd gauchinho-app
npm run build
```
