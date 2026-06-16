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

## Admin `/admin/grupos`

- [ ] Várias cotas via bulk paste
- [ ] Seção **Modalidades de lance** (criar, editar, inativar)
- [ ] Seguro aceita `0,0004` (vírgula ou ponto)
- [ ] Salvar e reabrir grupo persiste modalidades e seguro

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
