# Hotfix — favicon Racon por domínio

Data: 09/09/2026.

## Entrega

Os sites da família visual `racon_inspired` passam a usar um favicon quadrado
com o “R” azul da marca Racon. O ícone foi recortado da logomarca oficial já
presente no projeto e exportado em PNG de 512 × 512 pixels, com fundo branco e
margem própria para permanecer legível nas abas do navegador.

A resolução continua tenant-aware. Um favicon configurado explicitamente no
branding da Master ou do portal parceiro tem prioridade. Na ausência dessa
configuração, portais Racon usam `/racon/favicon-racon.png`; os demais sites
preservam o favicon anterior em `/favicon.ico`. O arquivo global saiu da pasta
de metadata estática do App Router para não sobrepor a escolha por domínio.

## Preservação

Não houve migration nem alteração de dados, permissões ou identidade de outros
tenants. Logotipos, modelos publicados e configurações existentes permanecem
inalterados.

## Validação

- TypeScript, ESLint direcionado e build de produção.
- Conferência visual do PNG de 512 × 512 pixels.
