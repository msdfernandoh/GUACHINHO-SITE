# Comprovantes de lances por modalidade — 06/11/2026

## Diagnóstico

O robô já registrava uma linha por lance confirmado em `cota_lances_ofertados`, mas o ERP consultava apenas o comprovante único de `cota_estrategias_lance`. Com isso, os comprovantes de lance livre, fixo e segundo fixo não eram apresentados individualmente na cota.

## Correção

- A tela de Lances & Estratégias passa a carregar as ofertas individuais por cota.
- Cada oferta exibe sua modalidade, protocolo e botão próprio de visualização.
- O robô gera e salva um arquivo separado para cada modalidade ofertada, com caminho contendo a cota e a modalidade; os arquivos anteriores não são sobrescritos.
- A evidência preferencial é PDF gerado pela tela de relatório do Newcon. Se a impressão for recusada pelo navegador, a captura PNG da mesma tela é preservada como fallback auditável.
- O campo legado de comprovante da estratégia permanece para compatibilidade; a auditoria detalhada usa as linhas individuais.

## Validação

Foi validada a cadeia código → Storage → `cota_lances_ofertados` → tela ERP. A validação automatizada final deve incluir TypeScript, testes direcionados e build antes da publicação.
