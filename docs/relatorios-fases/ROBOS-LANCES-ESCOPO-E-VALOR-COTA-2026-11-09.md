# Robôs de lances: escopo de execução e valor individual da cota

Data: 09/11/2026

## Objetivo

Evitar que uma reoferta direcionada seja ignorada pelo bloqueio de lote, dar ao
operador controle explícito sobre estratégias vencidas e eliminar valores
individuais ausentes na tela **Lances e Estratégias**.

## Entregas

- A execução em lote do robô de lances agora pergunta entre **somente sem lance
  vencido** e **todas as cotas marcadas**. A escolha é persistida na execução e
  chega ao processo-filho, sem alterar a configuração permanente do robô.
- Uma execução direcionada por `cotas_alvo_ids` continua limitada exatamente às
  cotas escolhidas e pode ser usada para corrigir/reofertar uma estratégia
  específica. Ela não é barrada pelo bloqueio geral de repetição de seis
  assembleias; as demais validações da estratégia continuam obrigatórias.
- O robô alinha a estratégia configurada às modalidades que o Newcon realmente
  apresenta. Por exemplo, uma configuração de 25% é aplicada como 2º fixo se a
  tela apresentar primeiro fixo de 40% e segundo fixo de 25%.
- O valor exibido na tela usa o snapshot individual (`valor_bem_racon`,
  `valor_base_relatorio` ou `valor_credito_contratado`) enquanto a base é
  atualizada. Cálculos de oferta continuam usando exclusivamente o saldo
  devedor sincronizado no Newcon.

## Correção operacional de dados

Foram encontradas 65 cotas com `valor_credito` zerado e snapshot individual
válido. Foi executado o reparo idempotente que preencheu apenas essas linhas,
preservando `empresa_id`, demais dados da cota e o snapshot original. A
conferência posterior retornou zero cotas com valor zerado recuperável.

Na estratégia das cotas **1553 IMÓVEL / 0195** e **1553 IMÓVEL / 0067**,
foi identificado que o embutido fixo ainda estava gravado como 2%. O ajuste
foi aplicado exclusivamente nessas duas estratégias para 25% e uma nova
auditoria confirmou o valor persistido antes de qualquer reoferta pelo robô.

## Validação técnica

- O reparo só atualiza valores estritamente positivos, com escopo por `id` e
  `empresa_id`.
- Não houve migration estrutural nem remoção de dados.
- Testes automatizados e build da aplicação acompanham a publicação desta fase.

## Validação operacional direcionada

Após a correção, o robô **ERONI** foi executado em uma instância anônima,
somente para as cotas 1553 IMÓVEL / 0195 e 1553 IMÓVEL / 0067. A execução
`dd18b636-07b7-47bb-b56c-a12ab21d612d` foi concluída com duas cotas, quatro
lances confirmados e zero falhas. Os registros novos comprovam que o embutido
foi enviado como 25% nas modalidades livre e fixa: protocolos 5772655 e
5772658 para a cota 0195; 5772659 e 5772661 para a cota 0067. Cada modalidade
possui seu próprio PDF no bucket privado `lances-comprovantes` e vínculo na
tabela `cota_lances_ofertados`.
