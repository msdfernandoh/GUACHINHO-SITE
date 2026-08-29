# Fase 161 — Menus e identidade do modelo no runtime tenant

## Diagnóstico

O onboarding persistia corretamente `empresa_site_modelos.menus_habilitados`,
mas o carregador público retornava apenas identificadores básicos do modelo. A
home Racon recebia uma lista vazia, acionava cinco links fixos e ainda criava
CTAs que não pertenciam à configuração. O layout global adicionava outro header
e footer, produzindo duas navegações com identidades diferentes.

## Implementação

- o runtime carrega catálogo de menus, seleção da empresa, identidade visual,
  seções, rodapé, logomarca padrão e preferência de logo própria;
- o catálogo é filtrado pelos IDs habilitados, preservando itens obrigatórios;
- a identidade base vem do modelo Racon e recebe somente os overrides não nulos
  do branding da empresa;
- um único chrome Racon é usado pelo layout em todas as páginas do tenant;
- desktop e mobile exibem a mesma coleção configurada, sem botões fixos extras;
- o template interno desativa seu chrome quando já está dentro do layout Racon;
- menus operacionais publicados tornam-se o entitlement explícito das respectivas
  rotas, com sincronização para alterações futuras e reconciliação dos vínculos
  existentes.

## Segurança

Hosts continuam resolvidos exclusivamente por domínio verificado. A liberação
operacional exige vínculo de modelo `PUBLICADO` e pelo menos um menu operacional
selecionado pela Platform; sites sem essa aprovação permanecem bloqueados.

## Validação

O contrato `menus-modelo-runtime-160-contract.test.ts` cobre carregamento,
composição visual, chrome único e sincronização do entitlement.
