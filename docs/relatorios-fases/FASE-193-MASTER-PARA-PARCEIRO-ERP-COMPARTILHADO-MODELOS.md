# Fase 193 — Master para parceiro, ERP compartilhado e modelos publicados

## Objetivo

Eliminar o fluxo sem saída em que o cadastro de site exigia uma organização
pré-existente, permitir reutilizar modelos publicados e oferecer conversão
segura de uma Master criada indevidamente quando a intenção é compartilhar o
ERP de outra franquia.

## Contrato implantado no código

- O modal de parceiros permite selecionar uma organização ativa ou cadastrá-la
  junto com o primeiro site.
- Identidade personalizada exige um `site_modelos` publicado. Cópias preservam
  a família de renderização pela cadeia `modelo_origem_id`, limitada e com
  detecção de ciclo.
- Portais parceiros suportam os renderers `institucional_v1` e
  `racon_inspired`; os demais modelos publicados usam a família canônica de sua
  origem, sem executar HTML ou JavaScript arbitrário.
- A conversão Master → parceira exige confirmação textual e Platform
  Superadmin. Ela é transacional e só aceita origem sem leads, propostas,
  contratações, vendas ou movimentos de caixa.
- A Master original não é excluída: fica suspensa, com metadados da conversão.
  Domínio, responsável principal e modelo são ligados ao portal parceiro da
  Master anfitriã. O usuário recebe papel `parceiro_comercial`, participante
  ativo e vínculo de responsável principal na organização, sem acesso ao ERP
  interno.
- Se houver fatos operacionais, a função falha antes de qualquer mutação. Uma
  migração assistida posterior precisa mapear cada fato e não faz parte deste
  fluxo.

## Banco e segurança

A migration `189_master_para_parceiro_modelos_site.sql` acrescenta o vínculo
opcional `parceiro_sites.site_modelo_id` e instala três RPCs protegidas por
`is_platform_superadmin()`. Execução é revogada de `PUBLIC` e `anon`. UUIDs de
origem, destino, organização, site e modelo são revalidados dentro do banco.

## Preservação

Não há backfill, conversão automática ou alteração de registros existentes ao
aplicar a migration. A conversão depende de ação explícita e mantém a origem
auditável. Fatos comerciais e financeiros nunca são reatribuídos entre tenants.

## Validação local

- TypeScript sem emissão.
- Testes de portais parceiros existentes aprovados.
- Teste contratual da fase cobre bloqueio por fatos, preservação da origem,
  catálogo publicado e os dois renderers.

