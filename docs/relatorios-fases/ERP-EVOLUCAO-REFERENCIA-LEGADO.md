# Evolucao do ERP — referencia funcional do CONSORCIO SISTEMA

## Escopo e seguranca

- Referencia auditada somente para leitura: `C:\Users\msdfe\Downloads\CONSORCIO SISTEMA`.
- Nenhum arquivo, dependencia, banco, servico ou configuracao do legado foi alterado.
- Nenhum codigo ou schema do legado foi copiado para o SaaS atual.
- A implementacao permanece tenant-aware e usa os cadastros atuais de `grupos_consorcio`, `grupos_cotas`, participantes, vendas, comissoes e financeiro.

## Comparacao funcional

| Area | Legado | SaaS atual | Evolucao desta branch |
|---|---|---|---|
| Clientes | Cadastro PF/PJ, socios, consultor e acesso a cotas | Leads, propostas, contratacoes e vendas separados | Hub Clientes e carteira conecta o ciclo completo sem duplicar entidade |
| Consultores | Usuarios marcados como consultor e percentual padrao | Participantes comerciais N:N por tenant | Atalho ERP para participantes, preservando identidade operacional canonica |
| Lances | Tela de lances por cota e atualizacao em massa | Estrategias por grupo/cota, lance embutido e recurso proprio | Hub de lances abre os grupos e estrategias atuais; nao importa tabela legada |
| Sorteios | Ordem de contemplacao com sorteio e tipos de lance | Sorteios de grupos pela Loteria Federal ja aprovados | Apenas acesso ERP ao modulo existente; runtime e regras preservados |
| Comissao do consultor | Percentuais e parcelas por regra | Regras versionadas, snapshot e elegibilidade por caixa recebido | Nova leitura ERP das regras e cronogramas canonicos |
| Comissao da franquia | Regra por administradora, apuracao e NF | Motor 060–063, recebimentos parciais, estornos e compensacoes | Cadastro de programas e multiplas regras versionadas, mais o hub de repasse |

## Decisoes de arquitetura

O legado possuia maior profundidade de navegacao, mas tambem continha defaults comerciais implicitos e operacoes SQL diretas. Esses comportamentos nao foram transportados. O SaaS atual continua exigindo:

- regra homologada explicitamente;
- nenhuma selecao automatica de 4% ou 1,5%;
- vigencia, escopo, versao e cronograma deterministas;
- snapshots imutaveis depois da venda;
- pagamentos limitados ao valor elegivel;
- idempotencia e historico append-only;
- RLS e isolamento por `empresa_id`.

## Arquivos da evolucao

- `gauchinho-app/src/lib/erp/erp-operational.ts`
- `gauchinho-app/src/lib/erp/erp-operational.test.ts`
- `gauchinho-app/src/components/erp/erp-sidebar.tsx`
- `gauchinho-app/src/components/erp/erp-operational-pages.tsx`
- `gauchinho-app/src/app/erp/page.tsx`
- `gauchinho-app/src/app/erp/[modulo]/page.tsx`

## Funcionalidades entregues na branch

- central operacional na entrada `/erp`;
- menu dividido entre Operacao e Modulos base;
- Clientes e carteira;
- Consultores;
- Lances e estrategias;
- acesso aos Sorteios de grupos existentes;
- Regras de comissao com programas, versao, escopo, valor, vigencia, cronograma e estado de homologacao;
- criacao de varios programas por administradora e de varias regras/versionamentos dentro de cada programa;
- cadastro explicito por percentual sobre credito ou valor fixo, sem restaurar defaults 4%/1,5%;
- escopo opcional por modalidade, opcao de cota e plano/condicao;
- cronograma com uma ou mais etapas e validacao de fechamento em 100% ou no valor fixo total;
- novas regras sempre nascem nao homologadas e nao participam do calculo;
- homologacao visivel apenas ao Platform Superadmin, com bloqueio preventivo de escopo/vigencia ambiguos; o motor 061 permanece como barreira definitiva;
- Repasse da franquia conectado a regras, previsoes e financeiro;
- submodulos derivados somente quando o modulo-base estiver liberado para a empresa.

## Validacao

- testes ERP/cadastro: 10 PASS;
- suite total: 681 PASS / 37 SKIP;
- TypeScript: PASS;
- build Next.js: PASS, 120 paginas;
- npm audit de producao: 0 vulnerabilidades;
- migration: nao necessaria;
- Sorteios: nenhum arquivo de regra, API, tabela ou runtime alterado.

## Estado de entrega

- branch: `codex/erp-operacional-legado-superado`;
- commit funcional: `c792d86a813f333519206ab32ff3c3d098fd0ad8`;
- Preview: `dpl_HPwCKg382eBVseWQFVPYeqz15CeH`;
- URL: `https://guachinho-site-9bezrkon6-hugo-8097s-projects.vercel.app`;
- estado: READY;
- Production: nao alterada;
- homologacao autenticada: pendente antes de qualquer promocao.

## Incremento — cadastro de multiplas regras

- branch mantida: `codex/erp-operacional-legado-superado`;
- commit funcional: `9c59a85233e2cd9a3e7e294e004e3e7f9f65ca06`;
- Preview: `dpl_4Ghgc3srBKgcqDXjLBv3xTj2PAeB` (`READY`);
- URL: `https://guachinho-site-i90rsuptf-hugo-8097s-projects.vercel.app`;
- banco e migrations: nenhuma alteracao; reutiliza integralmente as tabelas e validacoes 060–063;
- Production: nao alterada;
- arquivos principais: `commission-rule-manager.tsx`, `commission-rule-input.ts` e `app/erp/regras-comissao/actions.ts`;
- autorizacao de escrita: `can_write_tenant_internal(empresa_id)` e RLS da sessao, sem `service_role`;
- proximo gate: Preview autenticado antes de qualquer merge ou promocao.
