# Hotfix — paridade funcional do ERP Racon Sorriso

Data: 30/09/2026

## Solicitação

A Racon Sorriso é uma franquia independente e deve possuir, pelo plano ERP
completo contratado, as mesmas funções disponíveis no ERP Gauchinho. Dados,
usuários e movimentos continuam isolados por `empresa_id`.

## Diagnóstico

- Gauchinho e Sorriso possuem assinatura ativa do mesmo
  `plano_profissional`.
- As duas empresas têm os mesmos 12 módulos-base contratados.
- O vínculo do usuário afetado estava como `consultor`, papel que corretamente
  restringe funções administrativas mesmo num plano completo.
- A lista individual explícita também não continha o módulo operacional mais
  recente de fechamento dos sócios.

Portanto, a divergência não era uma limitação do plano: era a função tenant do
usuário e a sobreposição individual de módulos.

## Correção

A migration `303_sorriso_admin_herda_erp_completo.sql`:

1. valida o tenant, a assinatura ativa, o papel e o vínculo exatos;
2. recompõe `empresas.configuracoes.erp_sistema.modulos` a partir do plano
   contratado, sem copiar configuração ou dados de outra empresa;
3. define o usuário administrativo solicitado como `master` na identidade
   legada e `admin_empresa` no vínculo N:N de Sorriso;
4. define `erp_modulos_visiveis = NULL` para administradores ativos de Sorriso,
   fazendo-os herdar automaticamente todos os módulos atuais e futuros do
   plano, inclusive as rotas operacionais derivadas.

## Segurança e multi-tenancy

- Nenhum dado do Gauchinho foi copiado para Sorriso.
- Nenhum lead, proposta, comissão, conta ou usuário foi excluído.
- Consultores e demais papéis continuam sujeitos às permissões e listas
  individuais; a herança total é exclusiva de `admin_empresa`.

## Validação

- Leitura de produção confirmou assinatura e catálogo equivalentes.
- Contrato automatizado cobre promoção administrativa, herança por `NULL` e
  derivação dos módulos diretamente da assinatura.
- Lint, testes dirigidos e build de produção executados antes da publicação.

