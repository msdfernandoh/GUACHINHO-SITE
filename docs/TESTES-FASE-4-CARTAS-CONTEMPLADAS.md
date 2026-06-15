# Testes — Fase 4 Cartas Contempladas

Checklist manual após aplicar migration `003_cartas_contempladas.sql` e seed atualizado.

## Admin

- [ ] `/admin/cartas-contempladas` — lista com filtros (tipo, status, ativo, administradora)
- [ ] Nova carta — cadastro manual com moeda e data
- [ ] Nova carta — colar texto WhatsApp → revisão → salvar (`texto_original` preservado)
- [ ] Editar carta — alterar campos e salvar
- [ ] Status rápido na lista
- [ ] Destaque e ativo (toggle)
- [ ] Inativar / reativar na edição
- [ ] Excluir — apenas Master

## Parser (automático)

```bash
cd gauchinho-app
npm test -- src/lib/cartas/parser.test.ts
```

- [ ] Exemplo RACON extrai todos os campos sem arredondar

## Público

- [ ] `/cartas-contempladas` — visual escuro/dourado
- [ ] Apenas cartas `ativo=true` e status `disponivel` ou `consultar_disponibilidade`
- [ ] Filtros: tipo, administradora, faixas crédito/entrada, status, ordenação
- [ ] Card exibe dados financeiros e aviso **Consulte disponibilidade**
- [ ] Carta vendida/inativa não aparece na vitrine

## Lead e WhatsApp

- [ ] **Tenho interesse** — modal nome + WhatsApp (+ cidade/e-mail opcionais)
- [ ] Lead criado com `origem=carta_contemplada`, `carta_contemplada_id`, `dados_simulacao.carta`
- [ ] Lead visível em `/admin/leads`
- [ ] Botão WhatsApp pós-lead (origem `carta_contemplada` ou fallback contato)
- [ ] Eventos `lead_criado` e `carta_interesse`

## Proposta (opcional)

- [ ] No lead de carta: **Gerar proposta (carta contemplada)** cria proposta + PDF
- [ ] PDF inclui linhas da carta (administradora, saldo, taxa transferência)

## Configurações

- [ ] Aba **Cartas Home** — `home_cartas_contempladas` salva corretamente

## Regressão

- [ ] `/`, `/grupos`, `/simulador`, `/login`, `/admin`, `/admin/propostas`
- [ ] Geração PDF simulador/grupos inalterada

## Build

```bash
cd gauchinho-app
npm run build
npm test
```
