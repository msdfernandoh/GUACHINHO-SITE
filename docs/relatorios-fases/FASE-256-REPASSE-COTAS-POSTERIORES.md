# Fase 256 — Identificação de grupo e cota no repasse após o upload

## Diagnóstico

O relatório de setembro continha grupo e número oficial da cota, mas vendas formalizadas depois do upload geraram `cotas_definitivas` com `numero_cota` vazio. O seletor mostrava quatro comissões da mesma cliente com grupo idêntico e cota “—”. A rotina de atualização só reconhecia cotas cujo número já estava preenchido, portanto devolvia 0 vínculos mesmo após a venda entrar no ERP.

## Implementação

- O seletor agora identifica explicitamente o grupo, a cota oficial e, quando ela ainda não existe, a ordem interna da cota para distinguir as opções.
- A atualização da leitura procura as novas vendas/cotas no tenant e preenche o número oficial apenas quando há uma única cota candidata, conferindo administradora, grupo, cliente, competência, parcela e valor.
- No caso de várias cotas candidatas, a rotina não escolhe por suposição. O vínculo manual identifica a cota selecionada com o número do PDF e registra a baixa na mesma transação.
- A identificação recusa conflito com número de cota já atribuído, grupo divergente e cota já vinculada a outra linha.
- Vínculos e entradas financeiras existentes permanecem preservados.

## Caso observado

Mônica Luzia Sinhori possui quatro cotas internas na venda 1453 IMÓVEL, ainda sem números oficiais. As linhas 0414, 0593, 2090 e 2768 permanecem para seleção manual consciente; após cada identificação, as próximas parcelas dessa cota passam a ser reconhecíveis automaticamente.
