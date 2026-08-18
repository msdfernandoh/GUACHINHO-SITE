# Manual — Platform SaaS → Administradoras

## Objetivo

`/platform/administradoras` é o editor canônico do catálogo global de Administradoras. O acesso e toda mutação exigem `PLATFORM_SUPERADMIN`; o ERP apenas consome configurações concedidas ao tenant e não substitui este editor.

## Fluxo recomendado

1. Em **Administradoras**, use **+ Nova Administradora**, informe nome, nome fantasia, descrição e status, e salve.
2. Em **Tipos**, mantenha as categorias oficiais da Administradora. O código técnico e o ID são gerados internamente. Duplicidades lógicas ativas são bloqueadas.
3. Em **Modalidades**, cadastre as formas comerciais e indique se cada uma vale para todos os Tipos ou apenas para Tipos selecionados.
4. Em **Curvas de Estorno**, informe nome, descrição, status, vigência e as faixas estruturadas `Mês | Percentual`. Defina o escopo de Tipos e Modalidades.
5. Em **Modelos / Tabelas Master**, informe o Tipo, o percentual total de referência e as Modalidades. Cada Modalidade pode apontar para sua regra canônica de `comissao_regras_franquia`; o Modelo não executa cálculo próprio.
6. Em **Programas da Franqueadora**, confira Tipo, Modalidade, comissão, vigência, versão, cronograma e a curva opcional de cada regra. Uma regra pode usar nenhuma curva ou uma curva homologada compatível.
7. Em **Grupos**, confira Tipo, Modalidades disponíveis, Produtos e prontidão. A edição completa do Grupo continua no editor canônico acessado por **Ver Grupo**.
8. Em **Histórico**, confira as mudanças Platform da Administradora e de seus itens relacionados.

## Ciclos de status

- Administradora, Tipo e Modalidade: `ATIVA/ATIVO` ou `INATIVA/INATIVO`.
- Curva: `RASCUNHO`, `HOMOLOGADA` ou `INATIVA`.
- Modelo Master: `RASCUNHO`, `HOMOLOGADO`, `INATIVO` ou `SUBSTITUIDO`.
- Programa: `RASCUNHO`, `ATIVO`, `INATIVO` ou `SUBSTITUIDO`. Na interface, um Programa/Regra ativo e homologado é apresentado como **HOMOLOGADO / ATIVO**.

Curvas, Modelos e Programas homologados ou utilizados não são editados destrutivamente. Use **Nova versão**. Inativar impede uso futuro sem alterar vendas, snapshots, previsões ou pagamentos históricos.

## Exclusão segura

A exclusão definitiva é destinada somente a cadastros criados por engano e nunca utilizados. O banco bloqueia a exclusão quando encontra Grupos, Produtos, regras, previsões, vínculos, fatos ou snapshots históricos. Quando houver dependência, inative ou versione.

## Prontidão

O painel separa o catálogo-base — Tipos, Modalidades, Curvas e Programas homologados — das pendências dos Grupos:

- **COMPLETA**: catálogo-base presente e nenhum Grupo pendente;
- **PARCIAL**: catálogo-base ainda incompleto, sem pendência de Grupo;
- **COM PENDÊNCIAS**: existe ao menos um Grupo sem Tipo, Modalidade ativa ou Produto ativo.

Uma Administradora nunca deve aparecer como completa enquanto houver Grupo pendente.

## Regras de segurança operacional

- Não use `/erp/regras-comissao` para editar o catálogo Master.
- Não altere uma regra homologada que já gerou previsão; crie nova versão.
- Não execute backfill para corrigir catálogo futuro.
- Seguro permanece dimensão separada de Tipo, Modalidade, Produto e comissão.
- O Preview de homologação deve apontar exclusivamente para o Supabase isolado da fase.

