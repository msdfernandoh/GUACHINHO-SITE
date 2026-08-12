# Plataforma SaaS Master — UX e Governança

## Escopo

Primeira rodada executada exclusivamente na branch
`codex/plataforma-saas-master-ux-governanca`, Supabase isolado e Preview. Nenhuma
migration desta rodada foi aplicada no projeto principal e não houve merge em
`main` nem deploy Production.

## Arquitetura Platform

- `admin.gauchinhoconsorcios.com.br` continua sendo `PLATFORM_HOST`, sem
  `empresa_id` e sem registro em `empresa_dominios`;
- o host aceita somente login e rotas `/platform`; rotas operacionais `/admin`
  são indisponíveis mesmo para Superadmin nesse contexto;
- todo layout `/platform` revalida `is_platform_superadmin()` no servidor;
- `admin_empresa`, gestor, consultor e visualizador permanecem bloqueados;
- o shell é neutro, separado do Portal e do ERP Gauchinho, com sidebar própria,
  header, conteúdo responsivo e claro/escuro persistido localmente.

## Navegação

Dashboard; Master Franquias; Usuários/Responsáveis; Domínios; Administradoras;
Grupos; Cotas/Produtos; Sites/Portais; Modelos; Catálogo ERP; Liberações e
overrides; Planos; Assinaturas; Auditoria; Configurações.

## Reuso canônico

- empresas, empresa_usuarios e empresa_dominios;
- administradoras e empresa_administradoras;
- grupos_consorcio e grupos_cotas (produto global), sem confundir com
  cotas_definitivas (operação tenant);
- empresa_branding e configuração ERP em empresas.configuracoes;
- RPC `is_platform_superadmin()` e autenticação atual.

## Migration 070

Acrescenta somente governança não existente: modelos de site e atribuição à
empresa, catálogo global ERP, planos, relação plano/módulo, assinaturas SaaS,
overrides explícitos, configurações e auditoria Platform. As tabelas são
Platform-only por RLS. Preços ficam NULL; PLANO 1–3 nascem como RASCUNHO. Apenas
`gauchinho_default` é registrado e associado à Gauchinho como representação do
runtime atual; nenhum template Racon ou tenant Sorriso é criado.

O modelo não é consumido pelo runtime tenant nesta rodada, evitando alteração
visual da Gauchinho. Também não há billing, cobrança, publicação externa,
impersonação ou atualização de software por banco.

## Onboarding

Nova Master Franquia cria somente empresa inativa `em_treinamento`. Usuários,
plano, taxa/mensalidade, administradoras, template, domínio, recursos, ERP e
publicação permanecem gates explícitos e auditáveis.

## Validação

Resultados de testes, branch Supabase e Preview serão registrados ao final da
homologação desta rodada.
