# Validação operacional — fluxo do app de indicação (24/09/2026)

## Escopo

Teste no domínio de produção `www.gauchinhoconsorcios.com.br`, após o Hotfix 288. O teste usou a conta existente vinculada ao indicador ativo da Cleusa e uma conta sintética identificada como `Teste Codex Indicador`.

## Resultado observado no navegador

1. A conta existente autenticou pelo CPF e pela senha informada pelo solicitante. O painel exibiu o nome da Cleusa, seus links de indicação e Network, duas indicações existentes e o atalho de comissões. O extrato de comissões abriu sem erro e mostrou saldo zero.
2. O cadastro público sintético concluiu as cinco etapas e apresentou a confirmação de acesso no Nível 1.
3. O primeiro login da conta sintética com CPF e senha inicial abriu o painel com links próprios e lista vazia.
4. Uma indicação de contato sintético passou pelas seis etapas, mostrou confirmação de envio e apareceu em `Meus indicados` com interesse e crédito preenchidos.
5. A ação `Trocar usuário` encerrou a sessão. Uma nova entrada com o CPF da conta sintética recuperou o painel e a indicação. O extrato abriu com valores zero, como esperado.

## Integridade e limpeza

As consultas ao banco confirmaram `empresa_usuarios`, `participantes_comerciais`, `programa_indicadores`, `usuarios` e Auth vinculados à mesma empresa e usuário, além de `programa_indicacoes` associada ao lead sintético. Após o teste, foram removidos o lead, a indicação, o indicador, o participante, o perfil e a solicitação sintéticos. A exclusão física do vínculo `empresa_usuarios` foi bloqueada por gatilho legado de validação de papel que usa `NEW` em uma operação `DELETE`; por isso, o vínculo e o usuário sintéticos foram inativados e a identidade Auth foi banida. Nenhum registro preexistente foi alterado nessa limpeza.

## Limites

Não foi feita venda ou comissão de teste, nem foi disparado envio de recuperação para o e-mail da Cleusa. A conta sintética usou e-mail sem caixa de entrada, portanto o recebimento do link de recuperação não foi comprovado. O comportamento de recuperação por CPF segue coberto por teste automatizado do servidor.
