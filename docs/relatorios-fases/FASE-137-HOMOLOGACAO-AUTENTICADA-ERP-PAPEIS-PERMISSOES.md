# Fase 137 — Homologação autenticada dos menus, papéis e permissões do ERP

**Data:** 26/08/2026  
**Migration:** não aplicável  
**Código final:** `main@6fe2a46`  
**Deployment Production:** `dpl_3jzKGMWXjXYmJvuLk2JkfamfQL9T` (`READY`)  
**Status:** concluída, autenticada e validada em Production.

## 1. Objetivo

Fechar a pendência declarada na Fase 132: naquela fase, menus, URLs e ações
foram auditados estruturalmente, mas sessões autenticadas não foram simuladas.
Esta fase percorreu as 20 rotas do ERP com papéis distintos, confrontou o menu
visível com a URL direta e corrigiu divergências de autorização encontradas.

## 2. Falha encontrada

`resolveErpUserAccess` tratava `erp_modulos_visiveis = null` como herança de
todos os módulos habilitados para qualquer vínculo. Como os papéis
`parceiro_comercial` e `parceiro_imobiliaria` também podem pertencer a uma
empresa, um parceiro legado podia receber a barra do ERP e alcançar páginas que
usam cliente administrativo para carregar dados tenant-scoped.

O RLS continuava sendo uma barreira em tabelas acessadas pela sessão, mas não
era aceitável depender dele em páginas que já haviam elevado a consulta no
servidor. O menu individual precisava ser uma redução do papel, nunca uma forma
de ampliar autoridade.

## 3. Correção implantada

Foi criada uma matriz canônica em `src/lib/erp/erp-acesso.ts`:

1. a empresa precisa ter o ERP e o módulo habilitados;
2. o vínculo precisa herdar ou selecionar a rota;
3. o papel precisa pertencer ao conjunto próprio do ERP;
4. gestor, consultor e visualizador precisam possuir a permissão canônica da
   rota;
5. superadmin e administrador da empresa continuam limitados pelos módulos
   contratados/selecionados, embora não dependam da permissão intermediária.

Os papéis de parceiro ficam fora do ERP e continuam usando a área de parceiro.
Nenhum papel foi inferido por `usuarios.perfil`, nome de pessoa ou texto do
papel.

O guard autorizado passou a ser usado pelo layout, dashboard, rota dinâmica,
fila de contratações e consulta/alteração de Contas a Pagar. Assim, sidebar,
URL direta e ação no servidor resolvem a mesma lista efetiva.

## 4. Divergência adicional corrigida

Na primeira rodada, o gestor visualizava **Consultores**, mas a página
reutilizada exige `gerenciar_participantes` e o redirecionava ao portal. A
matriz foi alinhada ao guard real: a rota agora exige essa permissão. Não foi
concedido poder adicional ao gestor de forma implícita.

## 5. Matriz autenticada final

Foram verificadas as rotas: Painel, Clientes, Consultores, Lances, Assembleias,
Regras de Comissão, Repasse, Minhas Comissões, Contas a Pagar, Leads,
Propostas, Contratações, Vendas, Grupos, Comissões, Financeiro, Relatórios,
Metas, Tarefas e Usuários.

| Papel | Permitidas | Bloqueadas | Resultado |
|---|---:|---:|---|
| `super_admin` | 20 | 0 | aprovado |
| `admin_empresa` | 20 | 0 | aprovado |
| `gestor` | 18 | 2 | Consultores e Usuários retornam 404 |
| `consultor` | 11 | 9 | somente operação comercial e extrato próprio |
| `visualizador` | 3 | 17 | Painel, Relatórios e Metas |
| `parceiro_comercial` | 0 | 20 | sai do ERP para login/área permitida |
| `parceiro_imobiliaria` | 0 | 20 | sai do ERP para Minha Imobiliária |

No consultor, foram aprovados Painel, Clientes, Lances, Assembleias, Minhas
Comissões, Leads, Propostas, Contratações, Vendas, Grupos e Tarefas. Comissões
globais, Consultores, Contas a Pagar, Financeiro, Metas, Regras, Relatórios,
Repasse e Usuários retornaram 404.

## 6. Método de homologação e preservação

As sessões foram obtidas pelo fluxo oficial do Supabase Auth, sem alterar
senhas e sem registrar credenciais. Para gestor e visualizador foi reutilizada
uma conta técnica de homologação já existente; somente o `papel_id` do vínculo
técnico foi trocado durante o teste. O snapshot original foi restaurado em
`finally` e o pós-check confirmou `restaurado=true`.

Não foram criados clientes, vendas, contas, comissões, movimentos financeiros
ou usuários permanentes. Nenhum dado de produção foi apagado ou recalculado.

## 7. Testes e build

- suíte completa: **185 arquivos e 1.028 testes aprovados**;
- ignorados explicitamente: 9 arquivos e 37 testes;
- build Next.js: TypeScript aprovado e **146 rotas** geradas;
- `admin_empresa`: 20/20 respostas autenticadas dentro de `/erp`;
- `super_admin`: 20/20 respostas autenticadas dentro de `/erp`;
- negativas de consultor/gestor: 404 na URL original;
- parceiros: nenhum retorno final dentro de `/erp`;
- deployment final: `READY` com aliases do domínio principal, `www` e Platform.

## 8. Banco de dados

Não existe SQL pendente desta fase. Nenhuma migration foi criada, pois a falha
estava na composição de autorização da aplicação. O Supabase permanece com
histórico contínuo `001–135`.

## 9. Próxima fase e bloqueio explícito

A próxima etapa na ordem aprovada é **importação de clientes e comissões
legadas**. Ela continua bloqueada por uma dependência externa objetiva: falta
uma amostra real do relatório da Racon/administradora. Sem cabeçalhos, formatos,
regras de competência, identificação da cota e exemplos de estorno, não é
seguro inventar o parser nem a contabilização.

Enquanto a amostra não for fornecida, a próxima fase executável é
**conciliação bancária e projeção de caixa**. Integrações com administradoras
continuam aguardando documentação oficial das APIs.
