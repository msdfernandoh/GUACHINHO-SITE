# Fase 148 — Tipo canônico, reajuste SaaS e menus de consulta no site

Data: 27/08/2026
Escopo: catálogo global de grupos, site administrativo, ERP e Plataforma SaaS.

## Resultado entregue

- `tipo_administradora_id` (UUID) é a fonte estrutural do tipo do grupo.
- `grupos_consorcio.modalidade` permanece apenas como texto legado sincronizado automaticamente.
- Divergências históricas, inclusive o grupo 1173, são corrigidas pela migration 147.
- Um grupo pode ser publicado em várias categorias do site por `grupos_categorias`, sem duplicar UUID, taxas ou créditos. Assim, um grupo do tipo oficial Imóvel pode também aparecer na aba Moto quando a categoria Moto for marcada no SaaS.
- O admin do site mantém os menus Empresas (SaaS), Catálogo de Administradoras e Catálogo de Grupos somente para consulta. As rotas antigas de inclusão redirecionam para as listagens.
- Inclusão e alteração global permanecem exclusivamente na Plataforma SaaS.
- O reajuste anual atualiza apenas `grupos_cotas.valor_credito`; o site continua responsável por calcular parcelas usando crédito, prazo, taxas, seguro e modalidade.
- Cada reajuste grava valores anteriores, valores novos, marco anual, percentual de referência, operador e observação em `grupos_creditos_reajustes`.

## Fluxo operacional

1. A Plataforma abre o grupo em `/platform/grupos/{uuid}`.
2. Define uma ou mais categorias de publicação. Todas as categorias marcadas passam a exibir o mesmo grupo no site.
3. Quando um novo marco anual estiver pendente, usa “Ajustar créditos”.
4. Pode aplicar um percentual geral e corrigir valores individualmente.
5. A RPC valida o papel Platform Superadmin, bloqueia concorrência, altera todos os créditos numa transação e registra auditoria.
6. Sites e ERPs recebem os créditos atualizados pelo catálogo compartilhado; nenhuma parcela comercial aceita anteriormente é recalculada ou sobrescrita.

## Regra de separação

- Tipo oficial: classificação estrutural única da administradora, ligada por UUID.
- Categoria de publicação: N:N e destinada às abas/vitrines do site.
- Modalidade de parcela: Integral, Reduzida e Personalizada; não é tipo nem categoria.
- Crédito: valor oficial global ajustável no SaaS.
- Parcela: resultado calculado pelo motor do site e preservado no snapshot da proposta/contratação.

## Banco e segurança

Migration: `supabase/migrations/147_grupos_tipo_canonico_e_admin_site_readonly.sql`.

Objetos:

- triggers `trg_sync_grupo_modalidade_tipo_canonico` e `trg_sync_grupos_apos_renomear_tipo_administradora`;
- tabela RLS `grupos_creditos_reajustes`;
- RPC restrita `rpc_platform_reajustar_creditos_grupo`;
- política de leitura exclusiva para Platform Superadmin.

## Validação

- TypeScript sem erros;
- teste de contrato cobre UUID canônico, leitura sem formulários, auditoria do reajuste e publicação multicategoria;
- suíte regressiva, lint e build devem ser executados antes da publicação em produção.
