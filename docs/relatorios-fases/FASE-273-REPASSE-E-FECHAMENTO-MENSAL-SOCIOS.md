# Fase 273 — Repasse, liberação de comissões e fechamento mensal dos sócios

## Objetivo

Eliminar a situação em que o relatório de repasse é ajustado, mas a comissão do participante continua como “Aguardando liberação”, e apresentar a decisão mensal dos sócios em linguagem direta.

## Regras entregues

1. Uma decisão `AJUSTAR_DIFERENCA` vinculada a uma linha do relatório chama a sincronização canônica do item de repasse.
2. A sincronização atualiza recebimento, valor líquido, imposto e `valor_elegivel` dos participantes; assim uma comissão só aparece pronta para pagamento quando há recebimento efetivamente alocado.
3. A migration também reprocessa ajustes já aprovados de forma idempotente.
4. “Minhas comissões” ganhou filtro de Conferência: aguardando liberação, pronta para pagar, paga sem conferência, conferida e cancelada.
5. A Central dos Sócios separa claramente:
   - contas ainda abertas: cada sócio deixa/transfere sua parte para a PJ;
   - contas já pagas: mostra quem transfere para quem no acerto.

## Garantias

- Uma previsão não é liberada apenas por estar prevista: precisa existir recebimento financeiro alocado.
- Comissão, imposto e despesas já pagas continuam auditáveis pelos lançamentos existentes.
- A nova regra não cria recebimento duplicado: a rotina canônica de repasse usa chaves de idempotência e recalcula a elegibilidade.

## Validação prevista

- Ajustar uma linha de repasse vinculada e confirmar que a comissão de Orlei/Juliano deixa de exibir “Aguardando liberação” quando o recebimento comportar a alocação.
- Filtrar “Aguardando liberação” em Minhas comissões e conferir que as linhas sem `valor_elegivel` aparecem.
- Conferir que uma conta aberta aparece somente no Passo 1 e só entra no acerto entre sócios após ser baixada como paga.
