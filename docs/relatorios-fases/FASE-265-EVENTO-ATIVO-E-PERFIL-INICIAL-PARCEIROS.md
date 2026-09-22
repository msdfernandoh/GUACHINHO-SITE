# Fase 265 — Evento ativo e perfil inicial dos parceiros

## Objetivo

Consolidar o convite de evento do app e a governança dos consultores que entram
pelo programa público de parceiros, preservando atribuição, comissão e decisão
manual do gestor.

## Convites de evento

- O app seleciona automaticamente o próximo evento ativo e publicado; o
  indicador não precisa escolher uma edição.
- Se não existir evento disponível, o lead e sua atribuição são preservados em
  `programa_convites_eventos_pendentes`.
- A tela administrativa de listas apresenta a fila pendente e permite vinculá-la
  ao evento ativo quando uma edição estiver disponível.
- O item vinculado entra na lista do indicador com presença `pendente`.

## Consultores do programa de parceiros

- Todos os cadastros da landing continuam com acesso de consultor e recebem o
  tipo comercial `CONSULTOR`, sem perder o tipo técnico `INDICADOR` necessário
  para atribuição e rastreabilidade.
- O ERP Consultores mostra o modelo escolhido no site e o perfil de comissão
  atualmente vinculado.
- Independentemente do modelo escolhido, o perfil inicial é o perfil já
  existente **Gerador de Oportunidades**, com comissão de **12,5%**.
- Nenhum perfil de comissão novo foi criado.
- A mesma regra homologada de 12,5% foi disponibilizada para os programas Racon
  Imóvel e Racon Veículo.
- Após a primeira indicação, o cadastro fica `EM_ANALISE` e o ERP sinaliza que
  o gestor deve revisar o perfil. A troca permanece exclusivamente manual em
  Regras de Comissão; o gestor também pode concluir a revisão mantendo 12,5%.

## Compatibilidade do motor de comissão

O papel técnico da indicação permanece `INDICADOR`. O motor canônico passou a
aceitar, somente nesse papel, o perfil existente `Gerador de Oportunidades` de
base SDR. Isso evita afetar outros SDRs e permite gerar corretamente a previsão
de 12,5% para a venda originada pelo programa.

## Banco de dados

- Migration 248: fila tenant-aware de convites sem evento ativo.
- Migration 249: perfil inicial existente de 12,5%, regra equivalente para
  Veículos, sinalização da revisão após a primeira indicação e adequação do
  motor canônico.
- As migrations foram aplicadas no banco vinculado e registradas no histórico.

## Validação

- TypeScript sem erros;
- ESLint dos arquivos alterados;
- 10 testes contratuais aprovados;
- build de produção aprovado;
- conferência no banco dos quatro parceiros atuais, do perfil vinculado e das
  regras homologadas de Imóvel e Veículo.
