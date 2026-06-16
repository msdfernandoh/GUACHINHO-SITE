# Testes — Fase 6 Home Premium

Checklist manual e automatizado para a página inicial e navegação pública.

## Automatizado

```bash
cd gauchinho-app
npm test -- src/lib/home
npm test
npm run build
```

Cobre:

- `buildSimuladorUrl` — query `tipo`, `solucao`, `valor`, `prazo`, `imovel_id`

## Home `/`

- [ ] Hero: título **Qual sonho você quer realizar?**, subtítulo e 3 CTAs (simulador, grupos, imóveis)
- [ ] Cards de sonho (9+) com links corretos
- [ ] Simulador rápido → `/simulador` com parâmetros
- [ ] Quem somos + Nossas soluções (6 cards com CTA)
- [ ] Grupos em destaque (se houver dados) ou seção oculta
- [ ] Cartas em destaque (se config + tabela) ou seção oculta
- [ ] Imóveis em destaque (se migration 005 + dados) ou seção oculta
- [ ] Placeholders Casos de sucesso e Dicas do Tchê
- [ ] Parceiros (Racon, Creditas, Tutors + imobiliárias do banco)
- [ ] Contato com dados de `configuracoes_sistema` → chave `contato`
- [ ] WhatsApp **Falar com especialista** e **Agendar consultoria**

## Cards de sonho — URLs

| Card | Destino esperado |
|------|------------------|
| Imóvel | `/simulador?tipo=imovel&solucao=consorcio` |
| Automóvel | `/simulador?tipo=automovel&solucao=consorcio` |
| Financiamento | `/simulador?solucao=financiamento` |
| Carta contemplada | `/cartas-contempladas` |
| Oportunidades imobiliárias | `/oportunidades-imobiliarias` |
| Grupos | `/grupos` |

## Header público

- [ ] Logo clicável → `/`
- [ ] Links: Início, Simulador, Grupos, Cartas, Imóveis, Admin
- [ ] Menu hambúrguer no mobile abre overlay com os mesmos links
- [ ] Header sticky no scroll

## Regressão

- [ ] `/simulador`, `/grupos`, `/cartas-contempladas`, `/oportunidades-imobiliarias`, `/login`
- [ ] Admin e geração de PDF inalterados

## Ambiente sem migrations

- [ ] Home abre mesmo sem tabela `cartas_contempladas` ou `imoveis` (seções dinâmicas vazias/ocultas, sem 500)

## Config admin (opcional)

- `home_cartas` — exibir na home, quantidade, só destaque
- `home_oportunidades_imobiliarias` — quantidade, botões simular/ver vitrine
