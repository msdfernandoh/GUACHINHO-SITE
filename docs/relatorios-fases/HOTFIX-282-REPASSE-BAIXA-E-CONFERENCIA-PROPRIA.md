# Hotfix 282 — Baixa canônica do repasse e conferência própria

## Problema corrigido

Uma releitura ou conciliação automática podia vincular uma linha do relatório de repasse à previsão correta após o recebimento já existir, mas não acionava a baixa financeira canônica. A interface então mostrava o vínculo com `R$ 0,00` e mantinha a comissão em **Aguardando liberação**.

Também era exibido para gestores o botão de confirmar recebimento de outro participante. A RPC corretamente rejeita essa ação por identidade, mas a exceção chegava à página como erro de servidor.

## Alteração

- A migration `282_repasse_vinculo_baixa_canonica_e_conferencia_propria.sql` sincroniza cada vínculo elegível com `sincronizar_item_repasse_canonico_203` quando o item é associado ou quando o recebimento é associado à importação.
- O reparo idempotente percorre as importações históricas com recebimento e tenta completar vínculos que ficaram em zero. Saldo insuficiente não produz baixa fictícia e fica registrado como aviso da migration.
- A tela **Minhas comissões** só oferece **Conferir / recebido** ao próprio participante; na visão administrativa de outra pessoa, explica que a confirmação deve ser feita pelo beneficiário.

## Observação de saldos

O card **Total Já Pago / Liquidado** soma comissões já baixadas (por exemplo, R$ 10.258,78). O seletor de conta mostra o saldo bancário atual (por exemplo, R$ 9.717,89), que pode ser menor por saídas posteriores. São métricas diferentes.
