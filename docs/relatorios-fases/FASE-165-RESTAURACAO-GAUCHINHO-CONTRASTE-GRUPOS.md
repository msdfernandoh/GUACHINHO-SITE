# Fase 165 — Modelo Gauchinho preservado e Grupos Racon legíveis

Data: 31/08/2026.

## Diagnóstico confirmado

- A empresa Gauchinho continuava vinculada ao modelo publicado `gauchinho_default`, mas `menus_habilitados=[]` era legado da criação desse vínculo. A reconciliação da migration 160 transformou esse estado em `site_publico.operacional_habilitado=false`.
- O proxy corretamente bloqueava Grupos, porém a home institucional renderizava Racon sem conferir o código do modelo. Isso fazia o Gauchinho parecer convertido para Racon.
- No Racon, a regra CSS de descendentes de `bg-amber` tornava brancos todos os textos de uma linha selecionada, inclusive selects/options sobre fundo branco. Superfícies `bg-zinc-950/…` também escapavam da conversão para tema claro.
- O botão de link dependia do perfil legado, enquanto a API exige vínculo/permissão canônicos da empresa. Os formatos resumido e completo já existiam no modal.

## Correções

1. Script guardado e idempotente `gauchinho-app/scripts/restore-gauchinho-site-menus.mjs`: restaura somente os menus padrão do vínculo publicado Gauchinho vazio, com compare-and-set de modelo/status/lista. Dry-run por padrão; execução explícita com `--apply`.
2. Executado em produção: apenas `empresa_site_modelos.menus_habilitados` da empresa Gauchinho e timestamp foram preenchidos. O trigger existente sincronizou o entitlement para true. Modelo, cores, branding, outras empresas e dados comerciais não foram alterados. Não é necessária migration.
3. `InstitutionalTenantHome` só renderiza Racon quando `codigo=racon_inspired`. Modelo desconhecido, ausente ou bloqueado recebe aviso neutro, nunca identidade de outra empresa. O gate de autorização não foi relaxado.
4. CSS de Grupos limitado a `.tenant-racon .grupos-workspace`: linha selecionada azul-clara, painéis claros, controles/opções com texto escuro, estratégias ativas azuis com texto branco, barra de totais azul e botões legíveis. Classes legadas Gauchinho preservadas.
5. Link de proposta visível e identificado como resumida/detalhada. Visitante recebe orientação e link de login; geração continua protegida pela API. Página usa a mesma empresa ativa e permissão `gerenciar_propostas` da API. Modal reutiliza os dois formatos existentes; “completo” passa a “detalhado” apenas no rótulo.

## Verificações

- Navegador: Gauchinho em produção recuperou home própria e `/grupos`, sem redirect institucional, com todos os menus originais. Duas cotas e Ajustar preservam fundo escuro, dourado e controles legíveis.
- Navegador local: Racon, grupo 5588, duas cotas; R$ 2.255,04 na linha e totais. Select/options branco + texto escuro; detalhes claros; estratégia 25% selecionada azul + textos brancos; botão Link resumida/detalhada visível.
- Testes novos: 8 casos, incluindo renderização por modelo, modal dos dois formatos, contrato de permissão e reparação de configuração guardada.
- Suíte: 1.128 aprovados, 37 ignorados pelos testes existentes.
- TypeScript e ESLint dos arquivos alterados aprovados. Build de produção validado antes do envio.
- Não foram criadas propostas reais, alteradas senhas, removidos registros ou recalculadas operações para testar.

## Escopo preservado

Trabalho realizado no worktree isolado. Alterações locais preexistentes de cadastro/compartilhamento de grupos, usuários e formalização na raiz não foram incorporadas. Nenhum arquivo de outro projeto foi acessado.
