# ERP Operacional — evolução com referência funcional do legado

## Estado de entrada e reconciliação

- branch: `codex/erp-operacional-legado-superado`;
- base funcional anterior: `9c59a85233e2cd9a3e7e294e004e3e7f9f65ca06`;
- a branch foi reconciliada com `main` e com a migration 068 do fluxo Proposta → Contratação;
- Produção permaneceu intocada durante implementação e homologação isolada;
- arquivos locais alheios ao escopo foram preservados fora dos commits.

## Referência funcional do legado

A inspeção funcional anterior, já registrada em `ERP-EVOLUCAO-REFERENCIA-LEGADO.md`,
foi usada como evidência documental. O `AGENTS.md` vigente proíbe novo acesso ao
projeto `CONSORCIO SISTEMA`; portanto ele não foi reaberto nesta rodada.

Classificação consolidada:

| Função observada | Classificação no SaaS | Decisão |
|---|---|---|
| Clientes PF/PJ e carteira | B/C — entidades existem, navegação dispersa | Hub Clientes reutiliza Lead → Proposta → Contratação → Venda/Cota |
| Consultores e desempenho | B/C | reutiliza `participantes_comerciais`, comissões, metas e vendas |
| Lances e estratégias | A/B | reutiliza grupos, opções e modalidades de lance atuais |
| Regras múltiplas de comissão | B | interface evoluída sobre programas/regras/versões 060–063 |
| Repasse da franquia | B/C | hub sobre previsões, recebimentos, pagamentos, compensações e caixa |
| Assembleias e pedra do grupo | D — faltava persistência própria | implementado como módulo ERP independente na migration 069 |
| Recursos adicionais não representados | D | documentados para decisão futura; não implementados automaticamente |

Nenhum código, SQL, banco, autenticação, default comercial ou permissão do legado
foi copiado.

## Menu final e módulos configuráveis

O catálogo base continua em `empresas.configuracoes.erp_sistema`. Submódulos são
derivados somente quando o módulo-base está liberado:

- Painel;
- Clientes e carteira, Leads/CRM, Propostas, Contratações, Vendas e Cotas;
- Grupos, Lances e estratégias, Assembleias/Pedras;
- Comissões, Regras de comissão, Repasse da franquia;
- Financeiro e Caixa;
- Relatórios, Metas, Tarefas e Usuários.

Administradoras não integra o catálogo ERP. Sorteios promocionais/eventos não
integram o ERP e continuam exclusivamente no Portal/Site.

## Assembleias / Pedras

A migration forward-only `069_erp_assembleias_pedras.sql` cria:

- `erp_assembleias_grupo`: histórico append-only por tenant, grupo e data;
- `erp_assembleia_atencoes`: destaque operacional de cota na assembleia;
- validação estrutural de concessão do grupo e de pertencimento da cota ao mesmo
  tenant e grupo;
- RLS por `can_read_tenant_internal` e escrita por `can_write_tenant_internal`.

A análise consulta exclusivamente `cotas_definitivas`, nunca `grupos_cotas`, e
ordena pela distância absoluta entre `numero_cota` e `pedra_sorteada`, com
desempate determinístico. Marcar atenção não atualiza status, contemplação ou
resultado oficial da cota.

## Comissões, repasse e financeiro

- programas e múltiplas regras/versionamentos permanecem no motor 060–063;
- regra nova nasce não homologada e não participa do cálculo;
- somente Platform Superadmin homologa, com verificação preventiva de conflito;
- não há defaults automáticos de 4% ou 1,5%;
- cronogramas fecham em 100% ou no valor fixo total;
- repasse e financeiro reutilizam previsões, recebimentos, pagamentos,
  compensações, estornos e caixa canônicos;
- nenhuma RPC 060–063 foi alterada.

## Testes e homologação

- testes ERP: 17 PASS;
- suíte completa: 695 PASS / 37 SKIP;
- TypeScript: PASS;
- build: PASS, 120 rotas;
- lint do escopo ERP: PASS, zero warnings;
- npm audit `--omit=dev`: PASS, zero vulnerabilidades;
- migration 069 aplicada no Supabase isolado `codex-erp-assembleias-069` (`dtgzujsktggllybnpbpj`): PASS;
- teste SQL transacional: histórico, proximidade, append-only, cross-tenant,
  cross-group, RLS/grants e preservação do status real: PASS;
- `ROLLBACK`: zero vendas, assembleias e marcações residuais;
- Preview consolidado: pendente;
- homologação autenticada: somente será declarada se houver sessão legítima;
- Production: não alterada neste ponto do relatório.

Durante o teste isolado, os default privileges do projeto concederam inicialmente
`UPDATE/DELETE` ao papel `authenticated`. A migration foi corrigida antes do
Preview para revogar explicitamente todos os privilégios desse papel e conceder
somente `SELECT/INSERT` no histórico. O trigger append-only continua como segunda
barreira estrutural.

## Riscos e limites

- cotas sem `numero_cota` estritamente numérico não entram no ranking, pois não
  existe pedra real comparável;
- “atenção” é sinalização comercial, não decisão de contemplação;
- contas a receber representam comissão da franquia contra administradoras, não
  parcelas do cliente;
- funções classificadas como D fora de Assembleias/Pedras aguardam decisão do
  proprietário.
