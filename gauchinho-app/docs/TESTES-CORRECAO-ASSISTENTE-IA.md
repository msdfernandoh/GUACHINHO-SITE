# Testes — Assistente IA Gauchinho

## Modo Guiado / OpenAI / Híbrido

### Configuração

1. Acesse `/admin/configuracoes` → aba **IA**.
2. Campo **Modo do assistente**: Guiado, OpenAI ou Híbrido.
3. Valor salvo em `configuracoes_sistema` / chave `ia_config`, campo JSON `modo`: `guided` | `openai` | `hybrid`.
4. Se `modo` não existir (configs antigas), o padrão é **guided**.

### Quando usar cada modo

| Modo | OpenAI | Uso |
|------|--------|-----|
| **Guiado** | Não | Atendimento estruturado, botões, cálculo real do simulador, leads `ia_chat_guided`. |
| **OpenAI** | Sim (exige `OPENAI_API_KEY`, `IA_PROVIDER=openai`, `IA_MODEL`) | Respostas generativas + extração de lead. Sem chave: cai para fluxo guiado sem erro seco. |
| **Híbrido** | Tenta primeiro | Se provider falhar, responde com modo guiado (`mode: guided_fallback`). |

### Cálculo “Quanto consigo de crédito?”

- Fluxo guiado usa `estimarCreditoConsorcioPorParcela()` em `src/lib/simulador/estimar-credito-por-parcela.ts`.
- Taxas e prazo vêm dos defaults do simulador (imóvel/automóvel conforme tipo).
- Exemplo: parcela R$ 500, 220 meses, parcela reduzida 60%, taxa adm + fundo ~24% → crédito estimado ~R$ 146k.

### Lead modo guiado

- `origem`: `ia_chat_guided`
- `dados_simulacao` inclui `modo_assistente: "guided"`, intenção, parcela, prazo, crédito estimado, parcelas.

### Testes automatizados

```bash
cd gauchinho-app
npm test -- src/lib/ia/guided-assistant.test.ts src/lib/ia/fallback-engine.test.ts src/lib/simulador/estimar-credito-por-parcela.test.ts
```

### Testes manuais

**Guiado:** selecionar Guiado → abrir chat → “Quanto consigo de crédito?” → Imóvel → R$ 500 → nome + WhatsApp → conferir lead no admin.

**OpenAI sem chave:** modo OpenAI sem `OPENAI_API_KEY` → chat deve responder com fluxo guiado, sem “indisponível”.

**Híbrido:** simular erro do provider → resposta guiada automática.
