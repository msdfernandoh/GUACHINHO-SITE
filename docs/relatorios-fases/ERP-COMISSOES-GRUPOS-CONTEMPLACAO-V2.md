# ERP — Comissões, Grupos, Contemplação e Governança V2

Data: 14/08/2026
Branch: `codex/erp-comissoes-grupos-contemplacao-v2`
Migration: `076_erp_comissoes_grupos_contemplacao_v2.sql`
Estado: implementação e homologação somente em branch/Preview; não aplicada em Production e não mesclada em `main`.

## Arquitetura

A fase estende os motores 060–063. As funções legadas de geração e cancelamento são preservadas e chamadas por dispatchers; vendas V2 usam snapshots de Tipo, Modalidade, regra, programa, versão e base original. Recebimento previsto continua no RPC 062. Excedente, pendência e curva acrescentam fatos auditáveis sem transformar status em lançamento financeiro.

Fluxos canônicos:

- venda → regra exata por Administradora + Tipo + Modalidade + vigência + versão → previsões mensais da Franqueadora;
- contemplação manual → evento único → consulta ao snapshot → previsão somente quando a regra contém `CONTEMPLACAO`;
- recebimento real da Administradora → caixa → elegibilidade acumulada → pagamento do participante;
- venda compartilhada → principal + no máximo um secundário, sem comissão adicional à Franqueadora;
- cancelamento antes da contemplação → curva configurável sobre valores efetivamente recebidos/pagos; depois da contemplação → exposição encerrada;
- grupo local completo → uso imediato no tenant → fila Platform → Global ou somente Local.

## Estruturas

Reutilizadas: `comissao_programas`, regras e previsões de Franqueadora/participantes, `financeiro_recebimentos`, pagamentos, compensações, estornos, caixa, `vendas`, `cotas_definitivas`, grupos, participantes, empresas, administradoras e auditoria central.

Novas tabelas principais:

- `administradora_tipos`, `administradora_modalidades_comissao`;
- `empresa_configuracoes_fiscais`;
- `administradora_curvas_estorno` e faixas;
- `comissao_regra_etapas` (`MES_RELATIVO` ou `CONTEMPLACAO`);
- `cota_contemplacoes`;
- `grupos_governanca_historico`;
- `financeiro_estornos_curva`;
- `financeiro_pendencias_recebimento`, movimentos append-only e divergências auditadas.

As novas colunas registram versão/estado de programas, escopo Tipo/Modalidade, modo/base/fonte do participante, governança do grupo, dados históricos da contemplação, valores bruto/imposto/líquido e conferência do participante.

## Racon e validação matemática

Os seis cronogramas são dados configuráveis. Parcela ausente não é persistida.

| Tipo | Modalidade | Mensal | Contemplação | Total |
|---|---|---:|---:|---:|
| Imóvel | Integral | 4,00% | — | 4,00% |
| Imóvel | Reduzida 60–99 | 4,00% | — | 4,00% |
| Imóvel | Reduzida abaixo de 59 | 2,75% | 1,25% | 4,00% |
| Automóveis | Integral | 3,50% | — | 3,50% |
| Automóveis | Reduzida 60–99 | 3,50% | — | 3,50% |
| Automóveis | Reduzida abaixo de 59 | 2,25% | 1,25% | 3,50% |

A migration aborta se qualquer soma divergir. Integral e 60–99 não possuem evento de contemplação.

## Programas, participantes e imposto

A UI organiza Programas → Franqueadora → Participantes → Histórico, cria nova versão, ativa/inativa e impede edição destrutiva após uso. Regras nascem não homologadas; somente Platform homologa, com bloqueio de vigência/escopo ambíguos.

A Franqueadora informa percentual direto sobre o valor vendido. Participantes podem ser automáticos sobre comissão líquida ou manuais sobre comissão líquida/valor vendido, com cronograma próprio. O secundário pode usar a fonte `PARTICIPANTE_PRINCIPAL`; a parte dele reduz o principal. A elegibilidade manual é acumulada pela fonte e distribuída cronologicamente sem pagar acima do liberado.

O imposto é configurado por empresa e vigência, aplicado antes da divisão. Participante vê somente líquido por padrão; bruto/imposto/líquido depende da configuração fiscal.

## Recebimentos, pagamentos e diferenças

- parcial mantém saldo e status parcial pelo 062;
- lote usa previsões selecionadas e registra cada lançamento pelo motor financeiro;
- excedente exige motivo e observação, liquida o previsto pelo 062 e registra o excedente como divergência + ajuste de caixa auditado;
- pendência preserva competência original, destino e movimentos; excedente posterior pode compensá-la;
- pagamento respeita a elegibilidade liberada; conferência do participante não cria novo pagamento.

## Contemplação e estorno

O evento registra data, tipo, valor atual do crédito, observação, usuário e horário. O valor atualizado é histórico; a comissão usa `vendas.valor_credito` congelado. Locks e índices únicos tornam clique duplo/retry idempotentes. Assembleia/Pedras não participa do disparo.

A curva Racon inicial é 80%, 70%, 70%, 70%, 60%, 60%, 50%, 50% nos meses 1–8. Antes da contemplação, cada beneficiário responde proporcionalmente apenas ao que recebeu; depois dela, nenhum novo estorno de curva é criado.

## Grupos e governança

Grupos legados ficam `CONFIGURACAO_PENDENTE`; nova venda é bloqueada sem Tipo e Modalidade. Grupo criado no ERP nasce Local/Pendente Platform e pertence ao tenant de origem. A Platform pode promover para Global ou manter Local, sempre com histórico. Exceção personalizada exige vigência e versão.

## Testes e gates

- parser PostgreSQL da 076: PASS;
- TypeScript: PASS;
- Vitest: 125 arquivos PASS, 9 skipped; 711 testes PASS, 37 skipped;
- build Next.js: PASS (127 páginas);
- lint do escopo: PASS;
- `npm audit --omit=dev --registry=https://registry.npmjs.org`: PASS, 0 vulnerabilidades;
- Supabase Preview efêmero: migration e testes funcionais registrados abaixo;
- lint de banco: nenhuma ocorrência nova da 076; uma falha histórica fora do escopo em `convert_ad_offer_order_to_campaign` e um warning histórico de variável não usada no RPC 062.

Testes funcionais no Supabase isolado confirmaram: seis somas; modalidade Integral com 0 previsão de contemplação; Reduzida abaixo de 59 com exatamente 1; retry reutilizado; R$ 1.250 sobre a base original de R$ 100.000 apesar do crédito histórico de R$ 112.000; parcial de R$ 500; pendência original de R$ 500 compensada por excedente; curva pré-contemplação de 80% sobre R$ 1.000 recebido = R$ 800; 0 estorno após contemplação; Microfranqueado a 50% recebendo R$ 625 sobre a etapa líquida de R$ 1.250. Cross-tenant e ambiguidade são cobertos por constraints, RLS e contratos automatizados.

## Histórico e backfill

Auditoria read-only em 14/08/2026 encontrou `0` cotas com `status='contemplada'` no Supabase principal: 0 com venda, 0 com data e 0 com crédito original associado. Portanto não há comissão histórica calculável por esse marcador no estado atual. Nenhum backfill foi executado.

## Preview e pendências

Branch Supabase efêmera final: `codex-erp-comissoes-grupos-076-v2` (`wzhpkvqdwgggmxfdzqre`). Preview ERP final: `https://codex-erp-comissoes-grupos-076-erp.vercel.app`. Preview Platform com fronteira de host própria: `https://codex-erp-comissoes-grupos-076.vercel.app` (deployment `GrdLc3f9UukGTev5YS6ztjHriQqU`).

A homologação visual autenticada passou em Programas/Regras/Imposto, regra automática e manual de participantes, Comissões da Franqueadora com seleção em lote e rótulo CONTEMPLAÇÃO, Minhas Comissões, Grupos, Clientes/Cota com formulário explícito e Platform Administradoras/Tipos/Modalidades/Curva. A fila Platform foi exercitada com um Grupo Local isolado: exibiu as duas decisões e `MANTER_LOCAL` removeu a pendência sem apagar o grupo.

Nenhuma migration, fixture, backfill ou deploy desta fase foi enviado a Production. Fixtures e identidade de teste existem somente na branch Supabase descartável.
