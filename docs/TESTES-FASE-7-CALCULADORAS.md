# Testes — Fase 7 Calculadoras Financeiras

Checklist manual após deploy ou em ambiente local (`npm run dev`).

## Público

- [ ] `/calculadoras` abre com visual dark/gold e título **Calculadoras Financeiras**
- [ ] Cards das calculadoras ativas aparecem (aplicação, valor futuro, financiamento, correção)
- [ ] Cada calculadora calcula e exibe resultado **sem cadastro**
- [ ] CTA após resultado (“Receber análise completa” / “Falar com especialista”) abre modal
- [ ] Lead é criado em `/admin/leads` com `origem = calculadora_financeira`, `produto_interesse = análise financeira`, `tipo_interesse` = nome da calculadora
- [ ] Após salvar lead, botão **Chamar no WhatsApp** aparece (se houver origem ou WhatsApp principal)
- [ ] Mensagem WhatsApp corresponde à calculadora usada
- [ ] Financiamento: link **Comparar com consórcio** leva a `/simulador?solucao=consorcio&tipo=...&valor=...`
- [ ] Eventos registrados: `calculadora_utilizada`, `lead_criado`, `clique_whatsapp_pos_lead`

## Admin

- [ ] **Configurações gerais → Calculadoras** salva em `configuracoes_sistema` chave `calculadoras_financeiras`
- [ ] Desativar uma calculadora remove o card na página pública
- [ ] Rentabilidade e taxa de financiamento padrão aparecem nos formulários

## Regressão

- [ ] `/`
- [ ] `/simulador`
- [ ] `/grupos`
- [ ] `/cartas-contempladas`
- [ ] `/oportunidades-imobiliarias`
- [ ] `/admin/leads`

## Automatizado

```bash
cd gauchinho-app
npm test -- src/lib/calculadoras/calculadoras.test.ts
npm run build
```
