# Testes — Tabela funcional /grupos

Checklist manual e automatizado para a simulação por grupo (modelo Excel).

## Automatizado (`gauchinho-app`)

```bash
cd gauchinho-app
npm test -- src/lib/grupos
npm run build
```

Cobre:

- Fator de seguro `0,0004` e legado percentual
- Soma das cotas (crédito × quantidade)
- Seguro mensal = saldo × fator
- Agregação de totais
- Formato de prazo `total / restante / realizadas`
- Lance embutido = **soma das cotas × % modalidade**
- Prazos automáticos (`prazos.test.ts`) — meses decorridos e limites

## Tela pública `/grupos` — UI/UX

### Modalidades de lance

1. [ ] Grupo com **2 modalidades** no admin exibe **2 radio cards** em “Estratégia de lance”
2. [ ] Selecionar modalidade **25%** — lance embutido mostra **% e R$** sobre soma das cotas
3. [ ] Selecionar modalidade **50% + 10% próprio** — recurso mínimo aparece; ao selecionar, % mínimo é aplicado
4. [ ] Grupo com **1 modalidade** — selecionada automaticamente ao escolher cota/qtd
5. [ ] Grupo **sem modalidade** no admin — fallback do `% lance embutido` do grupo (card único)

### Recurso próprio e lance total

6. [ ] Marcar recurso próprio — alternar **%** e **R$**
7. [ ] Em **%**, valor em reais calculado aparece abaixo do input
8. [ ] Tentar **% abaixo do mínimo** — input não reduz abaixo; aviso visível
9. [ ] **Lance total** mostra embutido + próprio
10. [ ] **Resumo inferior** — bloco “Lance total” com composição embutido / recurso próprio

### Organização da linha

11. [ ] Desktop: linha horizontal compacta com colunas (cota, qtd, soma, parcela, lances, líquido, pós-cont., prazo)
12. [ ] **Ajustar** expande painel em 3 colunas (modalidades, recurso/seguro, resultado) — linha principal permanece baixa
13. [ ] Seguro **C/S** na linha principal quando grupo usa seguro
14. [ ] Mobile: card com resumo + **Ajustar lance e seguro** expansível

### Fluxo e PDF

15. [ ] **Gerar simulação** / **proposta** — JSON salva `modalidade_lance`, `lance_embutido`, `recurso_proprio`, `lance_total`
16. [ ] PDF da proposta — modalidade, lances, recurso, crédito líquido, pós-contemplação por linha

### Botões

17. [ ] Gerar simulação, proposta, especialista — texto legível (sem branco sobre branco)

## Validação contra Excel

Caso de referência (grupos **1513** e **1533**, 1 cota cada, modalidade **40%** embutido):

| Campo | Esperado (planilha / regra atual) |
| --- | --- |
| Soma das cotas | R$ 2.050.000,00 |
| Lance embutido | 40% × soma das cotas = **R$ 820.000,00** |
| Crédito líquido | soma cotas − lance embutido = **R$ 1.230.000,00** |

**Regras no código:**

- `credito_liquido = soma_cotas - lance_embutido`
- `lance_embutido = soma_cotas × % modalidade` (modalidade escolhida ou fallback do grupo)
- `seguro_mensal = saldo_devedor × fator` (ex. `0,0004`)

## Atualização automática de parcelas

No admin (`/admin/grupos/[id]`):

1. [ ] Marcar **Atualizar parcelas automaticamente**
2. [ ] Informar **Parcelas realizadas na data base** e **Data base**
3. [ ] Conferir **Prévia (hoje)** — realizadas e restantes
4. [ ] Opcional: **Atualizar base para hoje** ao salvar

Em `/grupos`:

5. [ ] Coluna **Prazo** reflete cálculo atual (ex. após 1 mês completo desde a data base, +1 realizada)
6. [ ] Tooltip quando automático: *Atualizado automaticamente com base em DD/MM/AAAA*

Grupos antigos sem data base continuam no modo **manual** (parcelas realizadas / prazo restante fixos).

Cálculo: `realizadas = base + meses_decorridos` (ciclo mensal no mesmo dia); `restante = prazo_total - realizadas`. Sem cron — calculado ao carregar a tela.

## Admin

- [ ] Modalidades de lance em `/admin/grupos/[id]`
- [ ] Salvar grupo recalcula cotas

## Banco

Migration `004_grupos_modalidades_lance.sql` aplicada no Supabase de produção.
Migration `007_grupos_parcelas_automaticas.sql` — campos de data base e atualização automática.
