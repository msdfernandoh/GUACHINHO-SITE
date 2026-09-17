# Fase 240 — Previsões pelo programa canônico da venda

Data: 17/09/2026

## Problema

Depois de validar a preparação e criar a venda dentro da transação, o núcleo de
previsões selecionava a regra mais recente do perfil sem filtrar o programa.
Para perfis atendendo Imóvel e Veículo, essa busca podia escolher o programa
incompatível e abortar toda a formalização.

## Correção

A migration `230_previsoes_reutilizam_programa_canonico_venda.sql` altera o
núcleo chamado pelos wrappers atuais de comissão. O programa passa a ser lido
do snapshot canônico da venda, e o percentual do participante é buscado apenas
na regra homologada desse perfil e programa.

A regra da franqueadora continua sendo validada por empresa, programa, tipo do
grupo, modalidade e vigência. Nenhum fallback por nome ou por ordem de versão
é usado para escolher entre Imóvel e Veículo.

## Preservação

A alteração não modifica regras nem percentuais cadastrados. Como a conversão
é transacional, as tentativas anteriores permaneceram sem venda ou previsões
parciais.
