# Relatório de Fase — Controle de Cotas de Boletos, Logins e Storage (06/11/2026)

## Objetivo

Preparar a carteira compartilhada da Gauchinho Consórcios para o robô operado
pelos dois logins Racon: `GAUCHINHO_ERONI` (1) e `RACON_FERNANDO` (2).

## Alterações

- `clientes.retirar_boleto_automatico` define explicitamente se o cliente
  autoriza a retirada mensal pelo robô; o padrão é `false` para não emitir
  boletos sem marcação.
- `cotas_definitivas.robo_boleto_login` identifica o login responsável por
  cada cota, preservando a cota e o cliente existentes.
- A configuração do robô Racon Sinop mantém a credencial da Racon, mas passa
  a consultar a carteira de dados da Gauchinha por `empresa_dados_id`.
- A aba Controle de Boletos passa a permitir marcar rapidamente login,
  autorização do cliente e inclusão manual de PDF.
- O upload manual grava o PDF no bucket `boletos-cotas` e sincroniza
  `cotas_boletos` e `vendas_boletos_envios`.
- O motor passa a listar somente clientes autorizados e cotas do login
  selecionado. O mapeamento de telas e a emissão no Newcon continuam sendo a
  próxima fase.

## Preservação

Não há cópia de clientes, vendas ou cotas para Racon Sinop. A relação de site
parceiro continua sendo visual/operacional; os fatos comerciais permanecem na
empresa Gauchinho, conforme o modelo multiempresa existente.

## Validação pendente

A migration deve ser aplicada no projeto Supabase e a carteira deve ser marcada
na aba Controle de Boletos antes da primeira execução filtrada por login.
