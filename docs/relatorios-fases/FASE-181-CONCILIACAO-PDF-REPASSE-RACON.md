# Fase 181 — Conciliação do PDF de repasse Racon

Data: 31/08/2026

## Entrega

- leitura server-side do PDF `Pedidos de Compras` da Racon;
- extração de competência informada, pedidos, ponto de venda, comissionado,
  grupo, cota, cliente, data de alocação (data da venda), parcela, percentual,
  valor-base e valor bruto da comissão;
- validação obrigatória da soma das linhas contra o total do PDF;
- idempotência por SHA-256 do arquivo dentro da empresa;
- registro do total do PDF como entrada bruta do repasse, sem baixar impostos;
- conciliação automática somente para grupo, cota, parcela, valor e cliente
  consistentes;
- filas separadas para divergências, linhas antigas do relatório ausentes no
  sistema e comissões abertas do sistema ausentes no relatório;
- vínculo manual auditável quando a correspondência automática não é segura.

## Confirmação e alteração de regra

O upload registra a entrada financeira, mas não liquida previsões nem libera
comissões. Na confirmação, o banco compara o programa da previsão com a regra
vigente da venda. Quando a regra mudou e não existe elegibilidade ou pagamento,
o cronograma é reconstruído transacionalmente e as linhas são conciliadas outra
vez. Qualquer diferença de parcela ou valor retorna a linha para `ATENCAO`; a
liquidação só ocorre após nova conferência manual.

## Segurança e preservação

As tabelas são isoladas por `empresa_id`, somente leitura direta para usuários
autenticados e escrita por RPC com `gerenciar_financeiro`. Hash, restrição de
uma previsão por linha conciliada e chaves de idempotência impedem duplicação do
PDF, da entrada de caixa e da liquidação.

