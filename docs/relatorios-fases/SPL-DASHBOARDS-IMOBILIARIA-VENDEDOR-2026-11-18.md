# Dashboards da imobiliária e do vendedor no SPL

O botão **Dashboard** abre a carteira da imobiliária, com cliente, vendedor,
situação, volume previsto em aberto e volume marcado como fechado. Os
valores são as referências de chaves registradas no SPL. Valores ausentes
aparecem sem total estimado.

A comissão estimada de consórcio usa a calculadora do Seja Parceiro com a
referência de plano integral de imóveis. O painel separa a participação da
imobiliária, o total dos vendedores e a estimativa por vendedor. A mesma
calculadora do Seja Parceiro exibe o plano de recebimento por modelo. As
previsões efetivas e baixas do ERP dependem de integração financeira.

A imobiliária pode copiar um link individual para cada vendedor ativo. A
assinatura do link é conferida no servidor e a leitura restringe a carteira
à empresa, à imobiliária e ao vendedor. O vendedor do modelo próprio vê
somente os dados de produção, conforme a regra comercial existente.

Validação local na base da main com TypeScript e três testes de agregação,
ausência de valores e isolamento da assinatura. Publicação e conferência em
produção pendentes.
