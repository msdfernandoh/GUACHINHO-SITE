# Fase 250 — App do Indicador: Indicação Conversacional e Comissões Mobile

## Indicar sem sair do app

- O botão **Nova indicação** abre `/app-indicador/indicar`.
- O fluxo conversacional solicita nome, WhatsApp, relação, produto, crédito e capacidade mensal em etapas de toque.
- O indicador autenticado é identificado no servidor; seu nome, telefone e identificador não são enviados pelo navegador.
- Relações disponíveis: amigo, familiar, cliente e outros, com explicação obrigatória para outros.

## Minhas comissões para celular

- O botão **Minhas comissões** abre `/app-indicador/comissoes`, sem navegar para o ERP desktop.
- O extrato consulta `comissao_previsoes_participantes` do participante autenticado, exibindo apenas total previsto, pago, pendente de confirmação e lançamentos essenciais.
- A confirmação é permitida somente para previsões pagas do próprio indicador; o servidor valida o vínculo antes de chamar a RPC de confirmação.

## Segurança e escopo

Não foram alterados percentuais, regras de comissão ou permissões do ERP. O app continua limitado ao tenant ativo e à identidade comercial do usuário logado.
