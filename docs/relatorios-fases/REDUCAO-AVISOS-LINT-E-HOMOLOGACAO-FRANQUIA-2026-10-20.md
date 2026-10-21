# Redução dos avisos de lint e homologação da franquia — 20/10/2026

## Objetivo
Dar continuidade ao diagnóstico de qualidade, restaurando a barreira existente
`npm run lint` sem aumentar o limite de 353 avisos nem desativar regras.

## Levantamento
Baseline: zero erros e 669 avisos. A leitura do relatório estruturado identificou
159 referências de importação sem uso, 107 parâmetros explicitamente any,
32 aspas em texto JSX e bindings sem leitura, além de dívida de hooks,
acessibilidade e tipos mais amplos.

## Mudanças
- Removidas somente importações sem referências e bindings sem leitura.
  Omissões intencionais em objetos com rest foram preservadas, pois removê-las
  poderia reenviar campos que o fluxo pretendia excluir.
- Hooks mantidos na mesma ordem, preservando chamadas e setters utilizados;
  valores não lidos de tuplas passam a posições omitidas.
- Removidas 103 anotações any em callbacks com contexto ou substituídas por
  estruturas específicas quando o contexto não bastava. A inferência ainda
  depende da qualidade do tipo de origem; isto não representa validação de
  payload remoto nem elimina os demais any históricos.
- A inspeção de campos DOM usa os tipos de input/button/select/anchor e verifica
  a existência das propriedades específicas, mantendo os mesmos dados retornados.
- Escapadas 32 aspas em texto JSX, preservando o texto exibido pelo React.
- Nenhuma mudança em taxas, dados financeiros, cálculo societário ou banco.

## Achado de autorização
O contrato commission-rule-actions.test verificava apenas a presença da palavra
isPlatformSuperadmin. Ela estava presente exclusivamente em uma importação não
utilizada; remover a importação revelou a fragilidade da asserção.

A arquitetura determina que homologar regras de franquia é atribuição exclusiva
da Platform. homologateFranchiseRuleAction verificava a empresa ativa e escrita
tenant, mas não fazia a consulta global. Acrescentado bloqueio efetivo por
isPlatformSuperadmin, mantendo as verificações anteriores. Esta correção é da
ação de homologação da franquia, não uma auditoria integral das demais actions
ou das policies de banco.

Teste comportamental adicional (mocks, sem escrita remota) cobre:
1. Administrador tenant sem autoridade Platform é recusado antes da consulta da regra.
2. Superadmin não pode escolher empresa diferente do contexto ativo.
3. Superadmin autorizado avança à consulta da regra após validar escrita tenant.

## Resultado e pendências
Contagem estruturada: zero erros e 342 avisos, redução de 327 (aproximadamente
49%). O limite permanece 353. Distribuição restante:
- 209 no-explicit-any;
- 65 no-unused-vars;
- 43 set-state-in-effect;
- 12 no-img-element;
- 7 alt-text;
- 4 exhaustive-deps;
- 1 unused-expressions e 1 diretiva desnecessária.

O retorno ao limite não equivale a zero dívida técnica. Hooks e tipos restantes
exigem revisão funcional específica; não foram silenciados para obter aprovação.

## Validação
TypeScript aprovado. Suíte final: 351 arquivos aprovados, 9 ignorados;
1.816 testes aprovados, 37 ignorados, zero falhas. Os três testes novos de
autorização estão incluídos; não foram criados novos skips.
Build de produção aprovado. npm run lint aprovado com zero erros e 342 avisos,
abaixo do limite original 353. git diff --check aprovado.
Sem migration ou alteração de dados remotos. Envio à main mantém a autorização
de publicação dada nesta conversa; implantação Vercel não homologada nesta fase.
