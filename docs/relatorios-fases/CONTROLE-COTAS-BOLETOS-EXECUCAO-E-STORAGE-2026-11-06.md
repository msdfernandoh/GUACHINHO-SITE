# Controle de cotas, robôs e Storage — 06/11/2026

## Resultado

- A cota 5088/1268 de SUMPES AGRO SEARCH LTDA está ligada ao robô `RACON_FERNANDO`.
- A autorização `retirar_boleto_automatico` está `false`; por isso o robô não deve
  incluir essa cota na fila de baixa até o usuário marcar “Sim, retirar boleto”.
- A execução real `8bb913d1-6a96-4a03-afb0-63f134564a36` foi iniciada com o robô
  `FERNANDO 2`, mas falhou antes do Newcon ao abrir `https://e.randonconsorcios.com.br/`
  com `net::ERR_CONNECTION_RESET`.

## Correção aplicada

O upload manual para `boletos-cotas` não recarrega mais a página nem retorna para a
aba Vendas & Cotas. O registro é atualizado localmente na aba Controle de Boletos,
com ações para visualizar e baixar o PDF armazenado; a ação de servidor também
retorna o ID do registro e o caminho do Storage para manter a tela consistente.

## Validação

- `npx tsc --noEmit` aprovado em `gauchinho-app`.
- Migration 333 já aplicada no banco remoto anteriormente.
- Nenhum dado operacional foi alterado nesta correção; a cota continua aguardando
  autorização explícita para retirada automática.
