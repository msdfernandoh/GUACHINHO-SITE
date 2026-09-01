# Fase 207 — indicação pública com primeiro nome

## Objetivo

Permitir o cadastro de uma indicação quando o usuário conhece apenas o primeiro
nome da pessoa indicada, sem reduzir as validações de contato necessárias ao CRM.

## Ajuste realizado

- A validação da tela pública passou a exigir apenas que o nome do indicado não
  esteja vazio.
- A exigência de telefone válido foi preservada.
- O rótulo passou de **Nome completo** para **Nome do indicado**, deixando claro
  que o sobrenome não é obrigatório.
- A API já aceitava um único nome e permaneceu alinhada com a interface.

## Verificação

Foi adicionado um teste de contrato que impede a reintrodução da exigência de
duas palavras no nome do indicado e confirma o mesmo comportamento na API.
