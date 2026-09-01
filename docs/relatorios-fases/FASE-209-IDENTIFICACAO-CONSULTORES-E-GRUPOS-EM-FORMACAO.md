# Fase 209 — Identificação de consultores e grupos em formação

## Objetivo

Tornar inequívoco o modelo de parceria do login usado nos lançamentos comerciais e identificar visualmente grupos cuja primeira assembleia ainda não ocorreu.

## Implementação

- A apresentação de consultores passou a usar o tipo comercial canônico de `participante_tipos`, com o modelo antes do nome: `Microfranquia · Nome`, `Parceiro · Nome`, `SDR · Nome` ou `Consultor · Nome`.
- O helper central de consultores aplica o rótulo aos seletores de login e atribuição que já consomem essa fonte tenant-aware.
- A formalização de venda no ERP aplica a mesma convenção aos participantes comerciais.
- A listagem de Grupos do ERP apresenta a tag `Em Formação` quando `data_primeira_assembleia` é uma data civil futura.
- A tabela e os cards públicos de grupos apresentam a mesma tag sob o número do grupo e deixam de exibir o percentual/descrição de reajuste nessa posição.
- Nenhum status, fato comercial, regra financeira ou dado histórico foi alterado. Não houve migration.

## Validação

- testes unitários do prefixo de parceria e da comparação da primeira assembleia;
- TypeScript sem emissão aprovado;
- comparação feita no fuso civil `America/Cuiaba`, evitando deslocamento UTC da data da assembleia.
