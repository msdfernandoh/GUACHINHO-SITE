# Fase 204 — Inativação do vínculo participante–perfil

## Objetivo

Permitir que uma pessoa deixe de receber novas comissões por uma combinação
específica de função comercial e perfil, sem inativar o participante inteiro e
sem apagar seu histórico financeiro.

## Implementação

- O modal “Editar Vínculo de Perfil” ganhou a opção explícita “Vínculo ativo
  para esta função e perfil”.
- A tabela oferece as ações diretas “Inativar” e “Reativar”.
- A alteração atualiza somente `participante_comissao_perfis.ativo`; o cadastro
  do participante, previsões existentes e pagamentos anteriores são mantidos.
- O motor de comissões e as telas de formalização já selecionam apenas vínculos
  ativos, portanto a inativação deixa de valer imediatamente para novas vendas.
- A vigência continua independente e pode ser usada para registrar o intervalo
  contratual, sem ser sobrescrita pela inativação operacional.

