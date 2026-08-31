# Fase 170 — Programa de comissão exclusivo para importação histórica

## Problema confirmado

O programa `FRANQUIA 2,5% ANTIGA` não podia ser homologado porque suas regras
ocupavam combinações de tipo, modalidade e vigência já cobertas por programas
canônicos ativos. A vigência até 31/05/2026 ainda cruza o programa ativo
`Franquia Antiga`, vigente no período. Duas regras também permaneciam com
vigência final aberta.

Esse bloqueio está correto para novas vendas: duas regras canônicas sobrepostas
produziriam seleção ambígua. A importação de carteira legada, porém, já possui
fluxo próprio, snapshot histórico e não afeta faturamento da empresa.

## Solução

- Incluído o marcador `comissao_programas.uso_exclusivo_importacao_legado`.
- A Platform ganhou a ação **Usar somente na importação histórica**.
- Ao reservar o programa, ele e suas regras deixam de ficar ativos/homologados
  para novas vendas, mas permanecem selecionáveis no importador.
- Um gatilho impede que programa exclusivo seja ativado no motor canônico.
- O importador prioriza e identifica visualmente essas regras.
- A prévia bloqueia contratos cuja data esteja fora da vigência da regra
  histórica selecionada.
- A alteração é auditada em `plataforma_auditoria`.

## Compatibilidade e preservação

Nenhuma venda, cliente, cota, previsão, programa ou regra existente foi
excluído. Programas atuais continuam com o padrão `false`. O mecanismo não
altera a resolução de comissão de novas vendas, o modelo N:N de empresas e
usuários, nem os snapshots já gerados.

## Verificação

- teste de contrato da migration, proteção e auditoria;
- teste de contrato da ação e identificação visual;
- teste de contrato da validação temporal no importador;
- lint, testes e build do aplicativo.

