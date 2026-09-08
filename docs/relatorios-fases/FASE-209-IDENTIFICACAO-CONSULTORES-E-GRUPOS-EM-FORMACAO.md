# Fase 209 — Identificação de consultores e grupos em formação

## Objetivo

Tornar inequívoco o tipo de comissão do login usado nos lançamentos comerciais e identificar visualmente grupos cuja primeira assembleia ainda não ocorreu.

## Implementação

- A apresentação de consultores usa o vínculo ativo e vigente de `participante_comissao_perfis.papel_tipo`, com o tipo de comissão antes do nome: `Master · Nome`, `Sócio · Nome`, `Indicação · Nome`, `SDR · Nome` e demais tipos cadastrados.
- O helper central de consultores aplica o rótulo aos seletores de login e atribuição que já consomem essa fonte tenant-aware.
- A formalização de venda no ERP aplica a mesma convenção aos participantes comerciais.
- Participantes que representam o mesmo `usuario_id` são consolidados no seletor, priorizando o registro que possui perfil de comissão ativo.
- A listagem de Grupos do ERP apresenta a tag `Em Formação` quando `data_primeira_assembleia` é uma data civil futura.
- A tabela e os cards públicos de grupos apresentam a mesma tag sob o número do grupo e deixam de exibir o percentual/descrição de reajuste nessa posição.
- Nenhum status, fato comercial, regra financeira ou dado histórico foi alterado. Não houve migration.

## Validação

- testes unitários do prefixo de comissão e da comparação da primeira assembleia;
- TypeScript sem emissão aprovado;
- comparação feita no fuso civil `America/Cuiaba`, evitando deslocamento UTC da data da assembleia.
