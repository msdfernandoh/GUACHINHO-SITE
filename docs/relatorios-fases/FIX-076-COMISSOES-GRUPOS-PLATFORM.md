# Correção operacional da Fase 076 — Comissões, Grupos e Platform

Data da homologação técnica: 14/08/2026

Branch: `codex/fix-076-comissoes-grupos-platform`

Migration: `078_fix_076_fluxo_administradora_operacional.sql`

Supabase isolado: `codex-fix-076-operacional-v2` (`bfpgyralphzjozrcwjsn`)

Production: **não alterada**

## Resultado

A implementação existente da fase 076 foi corrigida de forma forward-only. As migrations 060–076 não foram modificadas. Administradora é a fonte oficial de Tipos, Modalidades, curvas, programas e regras; os módulos ERP consomem essa configuração sem recriar catálogos paralelos.

Foram entregues:

- detalhe operacional de Administradora na Platform, com abas, formulários estruturados, códigos gerados e feedback de persistência;
- gestão global de Grupos na Platform e gestão local/read-only global no ERP;
- regras oficiais vinculadas à Administradora, versionamento/inativação/exclusão segura e configuração fiscal versionada;
- participante automático sem cronograma próprio e participante manual com cronograma obrigatório de 100%;
- recebimento real separado de conciliação, com uma única entrada de Caixa;
- estratégia de lance por cota, validação do limite do Grupo e histórico append-only;
- manual operacional dentro do sistema e em `docs/manuais/MANUAL-CONFIGURACAO-COMISSOES.md`.

## Regra matemática validada

| Tipo | Modalidade | Mensal | Contemplação | Total |
|---|---:|---:|---:|---:|
| Imóvel | Integral | 4,00% | — | 4,00% |
| Imóvel | Reduzida 60–99 | 4,00% | — | 4,00% |
| Imóvel | Reduzida abaixo de 59 | 2,75% | 1,25% | 4,00% |
| Automóveis | Integral | 3,50% | — | 3,50% |
| Automóveis | Reduzida 60–99 | 3,50% | — | 3,50% |
| Automóveis | Reduzida abaixo de 59 | 2,25% | 1,25% | 3,50% |

O teste transacional criou duas vendas temporárias sob `BEGIN/ROLLBACK`. Na modalidade Integral, a contemplação foi registrada sem previsão adicional. Na modalidade abaixo de 59, foi criada exatamente uma previsão de R$ 1.250,00 sobre a base original de R$ 100.000,00, mesmo com crédito histórico informado de R$ 140.000,00; a soma final foi R$ 4.000,00. A segunda chamada retornou `reused=true` e não duplicou evento nem previsão.

## Consolidação do catálogo Racon

O ambiente isolado terminou com dois Tipos ativos da Racon: `IMOVEL`/Imóvel e `AUTOMOVEIS`/Automóveis. A variante legada permaneceu inativa e registrada como alias. Referências operacionais foram migradas ao Tipo canônico; snapshots históricos não foram reescritos.

## Gates executados

- `npx tsc --noEmit`: PASS;
- lint somente dos arquivos desta entrega: PASS, zero erro/aviso;
- `npm test`: PASS — 732 testes, 37 skips, 130 arquivos aprovados e 9 ignorados;
- `npm run build`: PASS — 131 páginas geradas/validadas;
- teste SQL estrutural/matemático 076 no Supabase isolado: PASS;
- teste SQL transacional 078, incluindo contemplação com/sem etapa e idempotência: PASS no ambiente isolado e em Production sob `BEGIN/ROLLBACK`;
- `supabase db lint --linked --level error`: nenhuma falha da migration 078. Permanece um erro legado em `convert_ad_offer_order_to_campaign`, anterior e fora deste escopo;
- lint global do frontend: permanece vermelho por 53 erros e 77 avisos preexistentes fora dos arquivos desta entrega; o recorte novo está limpo.

## Segurança e promoção

A migration, originalmente homologada como 077 e renumerada para 078 após a integração da migration `077_erp_importacao_socios_permissoes.sql`, foi validada em dois branches efêmeros derivados de Production. As migrations 077 e 078 foram aplicadas no Supabase principal em 14/08/2026; o histórico remoto `001–078` e os testes transacionais com rollback foram verificados após a aplicação.

## Evidência de Preview

- Vercel Preview: `https://guachinho-site-2gxriobc4-hugo-8097s-projects.vercel.app`;
- deployment: `dpl_4pXxfCH6NdKQ1DUEm6Jx5AkYME3m`, estado `READY`;
- o domínio técnico do Preview exige autenticação Vercel SSO e não foi tornado público;
- a inspeção autenticada equivalente foi executada no build local da mesma branch, conectado exclusivamente ao Supabase isolado;
- detalhe Racon/Programas: `docs/evidencias/fix-076/platform-racon-programas.png`;
- operação ERP/Lances: `docs/evidencias/fix-076/erp-lances.png`;
- erros de console nas duas rotas inspecionadas: zero.
