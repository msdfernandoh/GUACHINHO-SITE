# Fase 263 — Preferências de atendimento e indicador como segundo vendedor

## Objetivo

Completar o formulário público do link curto de indicação com três perguntas
de atendimento, preservar o preenchimento entre visitas e garantir que o
indicador permaneça vinculado à venda como segundo vendedor.

## Implementação

- o chat público passou a ter 11 etapas e apresenta `Falta pouco` nas etapas
  finais;
- foram incluídas preferência, prazo e período de atendimento;
- o nome completo do indicador permanece visível no cabeçalho, na identificação
  e na confirmação;
- o rascunho é salvo no `localStorage` por código do indicador, com validade de
  sete dias, e removido após o envio concluído;
- as respostas são validadas no servidor, gravadas nas colunas
  `preferencia_atendimento`, `quando_atendimento` e `periodo_contato` de
  `leads`, acrescentadas ao histórico cronológico e registradas em atividade do
  CRM;
- a migration `247_preferencias_atendimento_indicacao_e_segundo_vendedor.sql`
  reforça o gatilho canônico que materializa o `participante_comercial` do
  indicador como `PARTICIPANTE_SECUNDARIO` da venda;
- na formalização, leads originados pelo programa mostram o segundo vendedor
  fixo e não permitem substituição por outro participante;
- o indicador não entra no rateio manual do consultor principal: sua remuneração
  continua sendo gerada pela regra homologada `INDICADOR`, evitando comissão em
  duplicidade.

## Validação

- `npx tsc --noEmit --pretty false`;
- ESLint direcionado aos arquivos alterados, sem erros;
- `npx vitest run src/lib/parceiros/link-indicacao-publico-243-contract.test.ts`
  — 10 testes aprovados;
- migration forward-only, tenant-aware e sem remoção de dados.

## Preservação e segurança

O código público continua sendo resolvido com o tenant derivado do host. O
indicador enviado pelo navegador nunca é aceito como fonte de verdade. O vínculo
de segundo vendedor é resolvido no servidor por
`programa_indicacoes → programa_indicadores → participantes_comerciais`.
