# Fase 132 — Check-up Geral dos Menus e Autorização do ERP

Data da auditoria e implementação local: 26/08/2026  
Migration: não aplicável  
Estado: implementada e validada localmente; sem alteração de banco.

## Escopo do check-up

Foram confrontados:

- catálogo dos módulos base (`ERP_MODULES`);
- catálogo das rotas operacionais (`ERP_OPERATIONAL_ROUTES`);
- itens efetivamente exibidos pela barra lateral;
- rotas físicas e rota dinâmica `/erp/[modulo]`;
- layouts de autorização;
- ações de escrita específicas do ERP;
- consultas com cliente administrativo;
- isolamento por empresa e por administradora concedida;
- build completo das 146 rotas da aplicação.

A tentativa de validação visual em Production confirmou que `/erp` redireciona usuário anônimo para `/login?next=/erp`. A navegação autenticada não foi simulada com credenciais. O check-up funcional autenticado permanece parte da homologação pós-deploy, sem reduzir as validações estruturais executadas em código.

## Correções aplicadas

### URL direta e menu oculto

Foram criados guards server-side para `leads`, `propostas`, `contratacoes`, `grupos`, `lances` e `repasse-franquia`. Assim, retirar um módulo de `empresa_usuarios.erp_modulos_visiveis` bloqueia também a URL digitada diretamente e todas as subrotas físicas.

As rotas dinâmicas continuam protegidas por `canAccessErpRoute`. Os guards retornam contexto tipado com usuário, empresa e vínculo não nulos depois da autorização.

### Ações fora da interface

As ações de Clientes, Grupos, Lances, Assembleias, Minhas Comissões, Regras de Comissão, Repasse e Vendas agora revalidam o acesso individual ao módulo no servidor. Esconder o botão deixou de ser a única barreira.

Operações críticas de Vendas deixaram de usar `usuarios.perfil`, `requireStaffAdmin` e comparação textual de nomes de papel. Escritas exigem `formalizar_vendas`; edição/exclusão master exige `papeis.codigo = admin_empresa` ou superadmin real da plataforma.

### Documentos

Antes de criar URL assinada com cliente administrativo, o módulo Clientes extrai o UUID da contratação e comprova que `contratacoes_online.empresa_id` coincide com a empresa ativa. Um caminho arbitrário de outro tenant não é mais suficiente para obter uma URL.

### Grupos e administradoras

A listagem, o detalhe de grupo e os seletores de Regras de Comissão foram limitados às administradoras com concessão ativa para a franquia. Grupos locais de outra empresa continuam bloqueados. O atalho para o editor da Platform só aparece para superadmin.

### Propostas

Criação, edição, pesquisa e download exigem `gerenciar_propostas`, usam `empresa_id` explícito e validam cliente/lead na empresa ativa. Uma proposta criada pelo ERP retorna ao ERP, não ao portal administrativo. Foram removidos fallbacks para o UUID fixo da Gauchinho nas páginas reutilizadas pelo ERP.

## Resultado menu a menu

| Menu | Rota | Resultado estrutural | Observação |
|---|---|---|---|
| Painel | `/erp` | Aprovado | Exige módulo `painel`; dashboard tenant-scoped. |
| Clientes e carteira | `/erp/clientes` | Aprovado após correção | Layout protege lista, novo, detalhe e edição; ações também protegidas. |
| Consultores | `/erp/consultores` | Aprovado | Rota dinâmica protegida; usa participantes do tenant. |
| Lances e estratégias | `/erp/lances` | Aprovado após correção | Leitura e ações exigem módulo; registros usam empresa ativa. |
| Assembleias / Pedras | `/erp/assembleias` | Aprovado após correção | Guard individual passou a considerar `erp_modulos_visiveis`. |
| Regras de comissão | `/erp/regras-comissao` | Aprovado após correção | Ações exigem módulo, tenant ativo e escrita autorizada; catálogos limitados às administradoras concedidas. |
| Repasse da franquia | `/erp/repasse-franquia` | Aprovado após correção | Exige módulo e `gerenciar_financeiro`. |
| Minhas comissões | `/erp/minhas-comissoes` | Aprovado | Consulta por empresa, usuário e participante comercial vinculado. |
| Contas a pagar e caixa | `/erp/contas-pagar` | Segurança aprovada; escala pendente | Permissão financeira e documentos privados já cobertos; paginação server-side será a Fase 133. |
| Leads / CRM | `/erp/leads` | Aprovado após correção | URL direta e subrotas protegidas pelo módulo. |
| Propostas | `/erp/propostas` | Aprovado após correção | Tenant explícito e retorno correto na criação pelo ERP. |
| Contratações | `/erp/contratacoes` | Aprovado após correção | Lista protegida; formalização mantém permissão `formalizar_vendas`. |
| Vendas e Cotas | `/erp/vendas` | Aprovado após correção | Autoridade crítica migrada para papel/permissão canônicos. |
| Grupos | `/erp/grupos` | Aprovado após correção | Somente administradoras concedidas e grupos locais da própria empresa. |
| Comissões | `/erp/comissoes` | Aprovado após correção | Sem fallback para primeira empresa; consultas usam empresa ativa. |
| Financeiro e Caixa | `/erp/financeiro` | Aprovado após correção | Sem fallback fixo; movimento continua protegido pela RPC tenant-aware. |
| Relatórios | `/erp/relatorios` | Aprovado estruturalmente | Rota dinâmica e acesso individual protegidos. |
| Metas | `/erp/metas` | Aprovado estruturalmente | Rota dinâmica e acesso individual protegidos. |
| Tarefas | `/erp/tarefas` | Aprovado estruturalmente | Rota dinâmica e acesso individual protegidos. |
| Usuários | `/erp/usuarios` | Aprovado estruturalmente | Rota dinâmica protegida; gestão permanece condicionada às ações canônicas de usuário. |

## Próxima fase

A Fase 133 deve retirar de Contas a Pagar o carregamento de até 10.000 registros e 500 logs no primeiro render. A meta é paginação, filtros, saldos e agregações no servidor/banco, mantendo o fechamento contábil consistente sem calcular a partir de uma página parcial.

Depois da Fase 133, a implementação do fechamento formal entre sócios depende da definição sobre percentuais de participação e modalidades de quitação. A importação de clientes/comissões legadas depende do layout real do relatório da administradora.
