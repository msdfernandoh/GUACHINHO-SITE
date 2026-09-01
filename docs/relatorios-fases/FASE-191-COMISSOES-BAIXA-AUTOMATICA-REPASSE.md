# Fase 191 — Comissões com baixa automática pelo relatório

## Problema observado

A tela de comissões exigia uma segunda confirmação para fatos que já haviam sido conferidos e vinculados no PDF de repasse. O topo repetia dezenas de checkboxes e cada linha mantinha vários campos operacionais sempre abertos, misturando previsão, recebimento, divergência e pagamento.

## Regra operacional adotada

- linha do relatório vinculada à previsão confirma e baixa automaticamente o recebimento;
- vínculo automático, vínculo manual e lançamento legado usam a mesma baixa idempotente;
- previsão da competência que não aparece no relatório fica marcada como **Não veio no relatório**;
- ajuste manual permanece disponível somente dentro da pendência;
- previsões futuras, histórico recebido e pagamentos de participantes ficam em blocos separados e recolhíveis;
- a elegibilidade do participante é liberada somente para a mesma cota recebida.

## Preservação e segurança

- nenhuma previsão é baixada sem `previsao_franquia_id` vinculado pelo fluxo de conciliação;
- cada item do PDF usa chave idempotente própria;
- a baixa nunca excede o saldo da previsão nem o saldo do recebimento;
- o recebimento-base continua append-only: o valor classificado e o status são derivados dos itens e classificações imutáveis;
- o backfill atua somente em importações existentes com recebimento e vínculo válidos;
- a estrutura multi-tenant e as permissões financeiras permanecem inalteradas.
