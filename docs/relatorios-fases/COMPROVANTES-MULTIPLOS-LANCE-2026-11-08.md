# Comprovantes múltiplos por cota — 08/11/2026

## Ajuste

A coluna de comprovante da tela **Lances e Estratégias** não abre mais apenas
o arquivo principal da estratégia quando existem vários lances ofertados. Ela
abre a cota e informa a quantidade de comprovantes individuais registrados.

No detalhe da cota, cada comprovante pode ser percorrido pelos controles
anterior/próximo, visualizado em nova aba e baixado individualmente. Os
comprovantes continuam vinculados aos registros de `cota_lances_ofertados` e
não são substituídos pelo arquivo de outro tipo de lance.

## Validação

- ESLint direcionado do componente e das actions: aprovado.
- Nenhuma migration ou dado operacional alterado.
