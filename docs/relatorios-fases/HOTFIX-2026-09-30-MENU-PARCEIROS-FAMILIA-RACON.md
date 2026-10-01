# Hotfix — menu de parceiros da família Racon

Data: 30/09/2026

## Incidente

O programa de parceiros já existia em `/parceiros`, porém os sites Racon
exibiam atalhos diferentes. Sinop mostrava **Área do Parceiro** e Sorriso
mostrava **Seja parceiro**, embora ambos utilizem o mesmo modelo SaaS
`racon_inspired`.

## Correção

A navegação Racon passa a oferecer simultaneamente:

- **Programa de Indicação** → `/indicar`;
- **Área do Parceiro** → `/app-indicador/login`;
- **Seja parceiro** → `/parceiros`;
- **Login** → `/login`.

O atalho Área do Parceiro preserva o nome conhecido pelo público, mas abre o
app atual de indicações e comissões. O portal legado `/area-parceiro` não é
reintroduzido.

A migration `304_menu_parceiros_familia_racon.sql` registra os dois recursos no
catálogo compartilhado e os habilita nos vínculos publicados. A normalização
em runtime evita duplicatas e também protege sites parceiros que consomem o
mesmo modelo.

## Hierarquia SaaS

Sorriso e Sinop mantêm dados operacionais separados por `empresa_id`. A
padronização visual e funcional é herdada do modelo publicado da família
Racon; por isso, futuras alterações no modelo compartilhado alcançam ambos sem
copiar leads, usuários, propostas ou dados financeiros.

## Validação

- testes cobrem catálogo antigo, catálogo novo e ausência de duplicatas;
- o destino autenticado é sempre o app Racon vigente;
- lint, testes e build de produção executados antes da publicação.

