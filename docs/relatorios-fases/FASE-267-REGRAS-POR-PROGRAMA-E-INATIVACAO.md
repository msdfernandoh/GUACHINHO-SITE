# Fase 267 — Regras por programa e inativação

## Diagnóstico

A auditoria confirmou que não existem perfis duplicados: há um único perfil
`Gerador de Oportunidades` e um único perfil `Indicador`. Cada perfil possui uma
regra para o programa Racon Imóvel e outra para Racon Veículo. Como a tela
mostrava apenas a administradora Racon, as regras de programas distintos
pareciam duplicadas.

A exclusão de qualquer uma dessas regras deixaria o produto correspondente sem
cálculo de comissão. A regra `Indicador` de Imóvel, além disso, já possui seis
previsões financeiras e não pode ser apagada sem corromper o histórico.

## Correções

- A coluna de escopo passa a mostrar explicitamente o nome do programa, além da
  administradora, tipo e modalidade.
- O estado `INATIVA` tem precedência sobre a homologação histórica.
- Regras inativas aparecem atenuadas e oferecem o botão **Reativar**.
- O servidor valida erros e a existência da linha atualizada antes de informar
  sucesso ao navegador.
- A regra de 12,5% de Imóvel, inativada durante o diagnóstico visual, foi
  restaurada para manter a comissão do app do indicador em Imóvel e Veículo.

## Banco de dados

A migration 251 restaura somente a regra canônica de 12,5% de Imóvel, validando
regra, perfil, programa e percentual. Nenhum perfil ou regra necessária foi
excluído.

## Validação

- conferência dos IDs, programas, vínculos e previsões no banco vinculado;
- TypeScript e ESLint sem erros;
- testes contratuais;
- build de produção.
