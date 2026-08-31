# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> [!IMPORTANT]
> **ESTADO-ALVO E CORREÇÕES OBRIGATÓRIAS**
> Antes de alterar tenancy, usuários, catálogo, sites, comissões, financeiro, Storage, RPCs ou migrations, leia também integralmente [`SAAS-ARQUITETURA-ALVO-E-PLANO-DE-CORRECAO.md`](./SAAS-ARQUITETURA-ALVO-E-PLANO-DE-CORRECAO.md). O documento descreve o estado-alvo e o plano de remediação; seus itens não devem ser interpretados como já implantados sem evidência no banco e no código.

> **Versão da Arquitetura:** 7.1.0
> **Data de Atualização:** 26/08/2026
> **Production code:** Fase 145 publicada em `main@4a3d3ee`; Supabase principal `eaeuoynprurmmulzhydt` alinhado de `001–144`.
> **Preview/isolado desta fase:** a branch `bwwgbmiwtrglbtxsdooi` permanece preservada como evidência de homologação da 083 até autorização separada de exclusão.
> **Fase atual:** catálogo central armazena grupos, categorias e créditos; site calcula parcelas; ERP preserva a proposta, aplica restrições locais e envia alterações estruturais para homologação Platform. Projeção de caixa opera sem conciliação bancária.
> **Vercel Production:** deployment funcional da Fase 145 `dpl_GRV1UgjBzLvwg4j3AZZgMcm1FjcW` está `READY`; os hosts público, `www` e Platform responderam pela Vercel.
> **Segurança:** o Platform Host continua global, sem fallback de tenant, e exige `is_platform_superadmin()`.

> **Projeto Físico:** `C:\Fernando Hugo\GAUCHINHO SITE`  
> **Repositório Git:** `https://github.com/msdfernandoh/GUACHINHO-SITE.git`

---

## 1. Visão Geral e Objetivo Arquitetural

O projeto **Gauchinho Site** foi transformado em uma **plataforma SaaS multiempresa de gestão e comercialização de consórcios**.

A plataforma suporta:
* **Multi-tenant (Multiempresa):** Múltiplas empresas de consórcio operando de forma isolada e segura.
* **Sites e Domínios:** Resolução de sites públicos por subdomínio, domínio customizado ou rota.
* **Branding por Empresa ou Parceiro:** Logotipos, cores, favicons, textos, menus públicos e administrativos configuráveis.
* **Catálogo Global de Administradoras:** Entidade global para administradoras (ex: Racon), compartilhando grupos e cotas habilitados por empresa.
* **Participantes Comerciais:** Vendedores, atendentes, consultores, gestores, indicadores, imobiliárias e parceiros.
* **Motor Configurável de Comissões e Repasses:** Programas de comissão da franquia por administradora, modalidade, plano e vigência.
* **Financeiro Completo e Caixa:** Separação entre parcela do cliente (paga à administradora), comissão da empresa e repasse ao participante.
* **Gestão, Metas, Tarefas e Auditoria Central:** Equipes comerciais, motor de apuração de metas por indicador canônico, acompanhamento de tarefas operacionais e trilha de auditoria com correlation ID.
* **Onboarding & Governança:** Governança exclusiva de concessões de administradoras por `PLATFORM_SUPERADMIN`, onboarding formalizado de novos tenants e runbook de operações.

---

## 2. Princípios de Preservação e Negócio

1. **Gauchinho Consórcios como Empresa 1:** A empresa Gauchinho Consórcios é a tenant número 1 da plataforma. Todos os dados existentes (`usuarios`, `leads`, `propostas`, `grupos_consorcio`, `grupos_cotas`, `contratacoes_online`, `agenda_eventos`, `indices_financeiros`) foram preservados integralmente.
2. **Padrão de Nomenclatura do Banco:** **Português snake_case** (`empresas`, `empresa_usuarios`, `papeis`, `permissoes`, `papel_permissoes`, `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`).
3. **Identidade N:N de Usuários:** Um usuário (`public.usuarios`) pode ter vínculo ativo com uma ou mais empresas através de `public.empresa_usuarios`.
4. **Desvinculação Técnica do Consultor:** A identidade de autenticação (`auth.uid()`) se conecta a `public.usuarios.auth_user_id`. Vendas e comissões apontam para perfis operacionais de participantes/consultores (`consultant_id` / `participant_id`), nunca para `auth.uid()` diretamente.
5. **Cota Definitiva:** O número definitivo da cota nasce `NULL` e é preenchido e auditado posteriormente ao processamento da adesão pela administradora.
6. **Imutabilidade do Caixa:** Lançamentos de caixa (`caixa_movimentos`) são estritamente append-only.
7. **Metas Não Gravam Realizado Fixo:** O realizado das metas é apurado dinamicamente a partir dos dados reais das vendas, propostas, comissões e recebimentos.

---

## 3. Modelo Relacional e Tabelas da Fundação SaaS

### Tabelas do Core SaaS (Fases 1 a 5 - Migrations 001–052)
- `empresas`, `empresa_dominios`, `empresa_branding`, `papeis`, `permissoes`, `papel_permissoes`, `empresa_usuarios`, `empresa_grupos_config`.

### Tabelas Comerciais e Vendas (Macrobloco B - Migration 053)
- `vendas`, `cotas_definitivas`.

### Tabelas do Motor de Comissões e Competências (Macrobloco C - Migration 054)
- `comissao_programas`, `comissao_regras_franquia`, `comissao_regras_participantes`, `comissao_previsoes_franquia`, `comissao_previsoes_participantes`.

### Tabelas Financeiras e Caixa (Macrobloco D - Migration 055)
- `financeiro_recebimentos`, `financeiro_recebimento_itens`, `financeiro_pagamentos`, `financeiro_pagamento_itens`, `financeiro_compensacoes`, `caixa_movimentos`.

### Tabelas de Gestão, Metas e Auditoria (Macrobloco E - Migration 056)
- `equipes`, `equipe_membros`, `metas_comerciais`, `tarefas_gestao`, `audit_logs_central`.

### Hardening transversal (Migrations 057–059)
- identidade canônica `auth.uid()` → `usuarios.auth_user_id` → `empresa_usuarios`;
- leitura tenant para `admin_empresa`, `gestor`, `consultor` e `visualizador`;
- escrita tenant somente para `admin_empresa` ou Platform Superadmin;
- 68 policies explícitas nas 18 tabelas internas, sem `FOR ALL`;
- integridade lógica cross-tenant por triggers;
- `caixa_movimentos` e `audit_logs_central` protegidos como append-only.

### Platform Host (sem migration)
- `admin.gauchinhoconsorcios.com.br` é um contexto global `PLATFORM`, não uma linha de `empresa_dominios` e nunca aponta para a tenant Gauchinho;
- o proxy decide o host antes de consultar tenant, não injeta `x-tenant-empresa-id`/`x-tenant-slug` e não permite fallback de empresa;
- anônimo é direcionado a `/login`; após autenticação, somente o RPC canônico `is_platform_superadmin()` autoriza o painel master existente (`/admin/empresas` e `/admin/administradoras`);
- `admin_empresa`, `gestor`, `consultor` e `visualizador` recebem 403; rotas operacionais ficam indisponíveis nesse host.

### Motor canônico e financeiro transacional (Migrations 060–063)
- regras de franquia e de participante independentes, sem percentual/default comercial implícito;
- seleção determinística por tenant, administradora explícita, vigência da venda, modalidade, opção de cota e plano/condição;
- precedência do beneficiário: participante específico, organização específica e regra genérica, com falha obrigatória em ambiguidade;
- bases permitidas: percentual sobre crédito ou valor fixo, com cronograma configurável e snapshot imutável da regra/versão;
- conversão contratação→venda→cota→previsões em RPC PostgreSQL atômico;
- recebimento e pagamento em RPCs com locks, idempotência, aritmética `numeric` e elegibilidade proporcional ao caixa da franquia efetivamente liquidado;
- compensações, consumos, cancelamentos de crédito e estornos registrados como eventos append-only; nenhum pagamento líquido negativo;
- `operacoes_idempotentes`, `financeiro_compensacao_movimentos`, `financeiro_estornos` e view `financeiro_compensacoes_saldos`;
- estado: aplicado ao projeto principal em 11/08/2026 após auditoria final e autorização explícita.

### Fechamento técnico da base (Migrations 064–066 — aplicadas em Produção)
- `064_retencao_historico_comercial_financeiro`: FKs de fatos comerciais, financeiros, caixa, auditoria e gestão trocadas de `CASCADE` para `RESTRICT`; relações configuráveis ambíguas permanecem inalteradas.
- `065_storage_privado_tenant_aware`: os buckets privados `propostas-pdf` e `contratacoes-documentos` passam a autorizar pelo registro de negócio e pelas funções canônicas `can_read_tenant_internal`/`can_write_tenant_internal`, preservando os caminhos legados sem migração destrutiva de objetos.
- `066_auditoria_runtime_transacional`: eventos de fatos críticos são append-only na mesma transação por trigger de banco; metadata contém somente campos alterados, sem valores sensíveis. `correlation_id` preserva `x-correlation-id`/`x-request-id` quando presente.
- A branch Supabase descartável `codex-fechamento-tecnico-064` aplicou e testou 064–066 com `ROLLBACK`. As três migrations foram posteriormente aplicadas no projeto principal (`eaeuoynprurmmulzhydt`) e permanecem como parte do estado canônico de Produção; não devem ser refeitas nem revertidas por trechos históricos deste documento.

### ERP Sistema (Migration 067)
- `/erp` é um shell visual de gestão separado do Portal, sem banco, autenticação, RBAC, RLS, serviços ou módulos paralelos; as telas existentes de `/admin` são reutilizadas.
- O catálogo ERP é controlado e exclui explicitamente Administradoras e sorteios. A governança por tenant usa `empresas.configuracoes.erp_sistema`, editável somente por `PLATFORM_SUPERADMIN`.
- `067_erp_sistema_gauchinho_config` ativou o ERP exclusivamente para Gauchinho Consórcios, preservando as demais chaves JSON; Empresa B não recebeu configuração ERP.
- Produção da fase: `001–067` foi conferido como local=remote quando aplicado; o deployment `dpl_FkuFYLNuZ9jwULjg21qgdUkfneLg` e o commit `55f7715cea0bec077a3592eb16a9dd81d93c9bb6` são referências históricas da promoção, não o deployment Production atual.

### Evolucao operacional do ERP (branch de homologacao)
- O sistema legado `CONSORCIO SISTEMA` foi auditado somente como referencia funcional, sem acesso de escrita, execucao de servicos ou integracao de codigo/banco.
- A profundidade de navegacao de Clientes, Consultores, Lances, Sorteios, Regras de Comissao e Repasse da Franquia foi reinterpretada sobre os modelos canonicos atuais.
- Os atalhos operacionais sao derivados dos modulos-base ja autorizados em `empresas.configuracoes.erp_sistema`; nenhuma permissao nova e concedida implicitamente.
- Regras de comissao continuam sob o motor 060–063: versao, vigencia, escopo, homologacao explicita, snapshots, idempotencia e falha em ambiguidade.
- O ERP agora permite cadastrar multiplos programas por administradora e multiplas regras/versionamentos de comissao da franquia por programa, sem migration nova e sem duplicar o motor financeiro.
- Cada regra informa explicitamente percentual sobre credito ou valor fixo, vigencia, modalidade, opcao de cota, plano/condicao e cronograma. O servidor valida que o cronograma fecha em 100% ou no valor fixo total.
- Toda regra criada pelo ERP nasce com `configuracao_homologada=false` e `origem_configuracao=ERP_MANUAL_NAO_HOMOLOGADO`; nenhum percentual comercial e presumido.
- `admin_empresa` pode preparar regras dentro do proprio tenant via `can_write_tenant_internal`; somente `PLATFORM_SUPERADMIN`, confirmado por `is_platform_superadmin()`, recebe a acao de homologacao.
- Antes da homologacao, a aplicacao recusa outra regra homologada da mesma administradora com igual escopo/precedencia e vigencia sobreposta. O RPC 061 continua falhando obrigatoriamente se qualquer ambiguidade persistir.
- Sorteios apenas reutilizam a pagina protegida existente. Nenhuma tabela, API, policy ou runtime de sorteios foi alterado.
- Relatorio: `docs/relatorios-fases/ERP-EVOLUCAO-REFERENCIA-LEGADO.md`.
- A migration 069 acrescenta Assembleias/Pedras como operação tenant-aware e
  independente: histórico append-only, ranking somente sobre `cotas_definitivas`
  do mesmo grupo e marcação de atenção sem mutar contemplação. O antigo atalho
  ERP para sorteios do Portal foi removido; sorteios promocionais permanecem intactos.
- Relatório consolidado: `docs/relatorios-fases/ERP-OPERACIONAL-LEGADO-SUPERADO.md`.
- Produção: a migration `069` e o ERP operacional foram promovidos; `origin/main`
  reconciliado está em `52e0655`. A estrutura `erp_assembleias_grupo` respondeu
  no Supabase principal durante a reconciliação, sem escrita de fixtures.

### Fluxo canônico Proposta → Contratação (Migration 068, branch de correção)
- a proposta passa a existir quando nome e telefone forem válidos e pode permanecer `Gerada` durante o preenchimento;
- CPF/CNPJ, endereço, pagamento e documentos pertencem ao estado da proposta, sem criar `contratacoes_online` antecipadamente;
- `propostas_documentos` registra somente uploads cujo objeto e metadata foram persistidos, com `empresa_id`, path não vazio e tamanho positivo;
- `rpc_finalizar_contratacao_proposta` é a única criação do novo fluxo: revalida mínimos no banco, exige documento, bloqueia cross-tenant e executa sob lock;
- `contratacoes_online.proposta_id` é único; retry e double-click retornam a contratação existente;
- a API revalida ainda e-mail, CPF/CNPJ, endereço, pagamento e catálogo de grupo/cota antes do RPC;
- status existentes foram preservados: `Gerada` em andamento e `Enviada` após confirmação final;
- registros históricos incompletos permanecem preservados e documentados, sem limpeza automática;
- relatório: `docs/relatorios-fases/CORRECAO-FLUXO-PROPOSTA-CONTRATACAO.md`.
- Produção: migration `068` aplicada, `001–068` local=remote, merge funcional
  `cbb2aadd264e0ce706a8a8c2b6e6fb8cdf9bb9c5` e deployment
  `dpl_5zbq3oGeJ8MrMagteqkZAgZGADuW` READY; smoke sem criação de fixtures.

### Plataforma SaaS Master (Migration 070 — Produção)
- o contexto global passa a usar shell próprio em `/platform`, sem herdar menu,
  identidade ou operação tenant da Gauchinho;
- o host Platform autoriza somente login e `/platform`, sempre pelo RPC
  `is_platform_superadmin()`;
- a migration 070 modela templates, catálogo ERP, planos, assinaturas,
  entitlements/overrides, configurações e auditoria Platform, sem preços
  presumidos, billing real ou integração com o runtime tenant;
- detalhes e homologação: `docs/relatorios-fases/PLATAFORMA-SAAS-MASTER-UX-GOVERNANCA.md`.
- estado reconciliado: a migration 070 integra `origin/main`; o marco `001–079`
  foi histórico e o Supabase principal está atualmente em `001–082`. O deployment Preview inicial permanece apenas
  como evidência histórica; a 070 está implantada em Production.

---

## 4. Status de Homologação de Todos os Macroblocos

| Macrobloco | Branch | Migrations | Status | URL / Deploy |
|---|---|---|---|---|
| Macrobloco A (Fundação SaaS & Catálogo) | `main` | 001–052 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco B (Comercial, CRM & Vendas) | `main` | 053 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco C (Motor de Comissões) | `main` | 054, 060–061 | AUDITADO E IMPLANTADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco D (Financeiro, Estornos & Caixa) | `main` | 055, 062–063 | AUDITADO E IMPLANTADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco E (Gestão, Metas & Auditoria) | `main` | 056 | HOMOLOGADO | Produção (`gauchinhoconsorcios.com.br`) |
| Macrobloco F (Homologação Geral & Onboarding) | `main` | 001–063 | IMPLANTADO | Produção (`gauchinhoconsorcios.com.br`) |
| Fechamento técnico e hardening | `main` | 057–066 | IMPLANTADO | Supabase principal |
| ERP configurável e operacional | `main` | 067, 069 | IMPLANTADO | Production atual |
| Proposta → Contratação | `main` | 068 | IMPLANTADO | Production atual |
| Plataforma SaaS Master | `main` | 070 | IMPLANTADO | Supabase principal |
| ERP Clientes e participantes | `main` | 071–074 | IMPLANTADO | Supabase principal |
| Financeiro operacional | `main` | 075 | IMPLANTADO | Supabase principal |
| Comissões, Grupos e Contemplação V2 | `main` | 076 | IMPLANTADO | Supabase principal + Production Vercel |
| Importação, sócios e permissões | `main` | 077 | IMPLANTADO | Supabase principal |
| Correção operacional da fase 076 | `main` | 078 | IMPLANTADO | Supabase principal |
| Governança de contas pagas e a pagar | `main` | 079 | IMPLANTADO | Supabase principal |
| Catálogo Grupo N:N Modalidades | `main` | 080 | IMPLANTADO | Supabase principal + Production Vercel |
| Formalização de Contratações | `main` | 081–082 | IMPLANTADO | Supabase principal + Production Vercel |
| Platform Administradoras V2 | `main` | 083 | IMPLANTADO | Supabase principal + Production Vercel |

---

### ERP Clientes operacional (Migration 071 — Produção)
- `clientes` é a identidade cadastral atual, tenant-aware e distinta de lead, proposta, contratação, venda e cota;
- a criação automática ocorre somente quando `contratacoes_online.contrato_assinado = true`; CPF/CNPJ normalizado é a identidade idempotente por empresa, sem deduplicar pessoas por nome ou telefone;
- documentos permanecem em `contratacoes_documentos` e no bucket privado existente; as cotas reais são sempre lidas de `cotas_definitivas` por meio de venda;
- o botão Nova Cota apenas inicia o fluxo comercial canônico, sem criar venda ou cota diretamente e sem alterar 060–063;
- `071_erp_clientes_operacional.sql` é forward-only, tem RLS explícita e não executa backfill automático. Em 12/08/2026, após auditoria e autorização expressa, foram vinculadas somente as 7 contratações assinadas da Gauchinho, sem documento ausente ou duplicidade de CPF/CNPJ.
- relatório: `docs/relatorios-fases/ERP-CLIENTES-OPERACIONAL.md`.

### Participantes de venda e simulação compartilhável (Migrations 072–073 — Produção)
- a contratação pode definir Microfranquia principal e um participante secundário opcional (`SDR`, `PARCEIRO` ou `CONSULTOR`), sempre no mesmo tenant;
- a fração configurada reduz a previsão da Microfranquia e transfere exatamente essa parcela ao secundário nas vendas novas, preservando previsões e pagamentos históricos;
- o link SDR carrega uma simulação assinada sem persistir proposta/contratação antes dos dados mínimos do cliente;
- migrations 072–073 integram o estado atual `001–082` do Supabase principal; relatório: `docs/relatorios-fases/VENDAS-PARTICIPANTES-COMISSAO.md`.

### Usuários do site no ERP (Migration 074 — Produção)
- usuários ativos já vinculados por `empresa_usuarios` são espelhados idempotentemente como participantes comerciais ativos do mesmo tenant, sem criar login novo nem alterar credenciais;
- o tipo inicial respeita o perfil operacional: SDR/SRD → `SDR`, consultor → `CONSULTOR`, imobiliária/parceiro → `PARCEIRO`, master/admin → `GESTOR`;
- novos vínculos ativos de empresa também são sincronizados pelo trigger; participantes vinculados a usuário podem não possuir telefone/WhatsApp, pois o login canônico já é sua identidade;
- o ERP deixa de depender da flag histórica `FASE3_ADMIN_PARTICIPANTES_ENABLED` quando o schema está disponível.
- estado reconciliado: migration 074 aplicada no Supabase principal.

### Financeiro operacional ERP (Migration 075 — Produção)
- contas a pagar, bancos e centros de custo são entidades tenant-aware próprias;
- a baixa empresarial gera saída append-only em `caixa_movimentos`; pagamento pessoal de sócio não movimenta caixa empresarial;
- o fechamento mensal calcula valores adiantados por sócio e o ajuste igualitário entre os pagadores;
- relatório: `docs/relatorios-fases/ERP-FINANCEIRO-CONTAS-PAGAR.md`.
- estado reconciliado: migration 075 aplicada no Supabase principal.

### Comissões, Grupos e Contemplação V2 (Migration 076 — Produção)
- Tipos e Modalidades pertencem à Administradora; o Grupo exige ambos para vendas novas e pode seguir governança Local → Platform → Global;
- regras são selecionadas por Administradora + Tipo + Modalidade + vigência + versão, com snapshot histórico e evento opcional `CONTEMPLACAO` sem mês fictício;
- tabelas Racon fecham em 4,00% (Imóvel) e 3,50% (Automóveis); somente Reduzida abaixo de 59 contém 1,25% de contemplação;
- imposto empresarial por vigência precede a divisão; participantes automáticos ou manuais podem ter cronograma e fonte próprios, com elegibilidade acumulada;
- recebimentos, pagamentos, divergências, pendências, compensações e estornos estendem 060–063, mantendo caixa, locks, idempotência e fatos append-only;
- contemplação manual registra crédito atualizado apenas para histórico e encerra novos estornos de curva, sem integração automática com Assembleias/Pedras;
- relatório: `docs/relatorios-fases/ERP-COMISSOES-GRUPOS-CONTEMPLACAO-V2.md`;
- estado: concluída, mesclada em `main` e promovida em 14/08/2026. A validação
  pós-migration confirmou as seis regras Racon e preservou os dados históricos.

### Importação financeira, sócios e acesso individual ao ERP (Migration 077 — Produção)
- o número 077 oficial pertence a `077_erp_importacao_socios_permissoes.sql`;
- foi aplicado no Supabase principal em 14/08/2026 e integra `origin/main`;
- relatório: `docs/relatorios-fases/ERP-IMPORTACAO-SOCIOS-PERMISSOES-CAIXA.md`.

### Correção operacional da Fase 076 (Migration 078 — Produção)
- o número 078 oficial pertence a `078_fix_076_fluxo_administradora_operacional.sql`;
- consolidou Administradora como raiz do catálogo, tipos Racon e fluxos de
  comissão/caixa sem reescrever as migrations anteriores;
- foi validada em ambientes efêmeros e aplicada no Supabase principal em
  14/08/2026;
- relatório: `docs/relatorios-fases/FIX-076-COMISSOES-GRUPOS-PLATFORM.md`.

### Catálogo canônico Grupo N:N Modalidades (Migration 080 — Produção)
- corrige o conceito singular introduzido na 076: um Grupo possui N modalidades de pagamento da sua Administradora;
- `grupos_cotas` continua produto comercial e recebe valores dinâmicos por modalidade; `cotas_definitivas` continua cota real do cliente;
- vendas novas escolhem explicitamente Produto + Modalidade e congelam o valor correspondente; a regra continua resolvida por Administradora + Tipo + Modalidade + vigência;
- colunas singulares e parcelas antigas permanecem somente para compatibilidade histórica, sem recálculo de fatos;
- relatório: `docs/relatorios-fases/AUDITORIA-CORRECAO-CATALOGO-GRUPOS-COTAS.md`;
- estado: E2E de três modalidades/vendas aprovado no isolado e migration posteriormente promovida para Production mediante autorização expressa; fatos históricos permaneceram intactos.

### Platform Administradoras V2 (Migration 083 — Produção)
- `/platform/administradoras` passa a ser o editor canônico global, sem redirecionamento para `/erp/regras-comissao`;
- Modalidades podem atender todos os Tipos ou Tipos selecionados; Curvas podem atender todos ou subconjuntos de Tipos e Modalidades;
- Modelos Master são governança/referência sobre `comissao_regras_franquia`, sem motor de cálculo paralelo;
- cada regra canônica escolhe opcionalmente sua Curva; Programas mantêm rascunho, homologação/ativação, inativação e nova versão;
- exclusões consultam vínculos, previsões e snapshots históricos; itens utilizados devem ser inativados ou versionados;
- relatório: `docs/relatorios-fases/PLATFORM-ADMINISTRADORAS-V2.md`; manual: `docs/manuais/MANUAL-PLATFORM-ADMINISTRADORAS.md`;
- estado: promovida em Production após dry-run exclusivo, histórico remoto confirmado em `001–083` e deployment `dpl_9GhcpmEEgo4HCHACcJYcT4EWW6rc` `READY`; não houve fixture, backfill, limpeza de legado ou recálculo histórico. O isolado `bwwgbmiwtrglbtxsdooi` permanece preservado.

### Homologação e Versionamento de Programas Platform (Migration 084 Forward-Only)
- Correção forward-only da função `rpc_platform_status_programa`: a validação do cronograma compara a soma das etapas com o percentual/valor total de comissão configurado na própria regra (`r.percentual_total_comissao` / `r.valor_fixo_total`), nunca em 100% fixo;
- Suporte canônico a etapas de parcelas mensais somadas a etapas de `CONTEMPLACAO`;
- Validação com mensagens descritivas por tipo de pendência (Tipo, Modalidade, Comissão, Cronograma);
- Salvaguardas de versionamento na RPC `rpc_platform_nova_versao_programa`: rascunhos são editáveis diretamente e não geram duplicatas; versões homologadas geram cópia em rascunho e passam a `SUBSTITUIDO`;
- UX unificada: visualização agrupada por Programa → Versão → Regras Internas; ação única de homologação com feedback explícito; confirmação de nova versão apenas para programas homologados/históricos;
- Relatório: `docs/relatorios-fases/PLATFORM-PROGRAMAS-HOMOLOGACAO-084.md`.

### Catálogo Operacional de Grupos, Cotas e Modalidades (Migration 085 Forward-Only)
- Transforma Grupo no catálogo operacional oficial da Franqueadora/Administradora com hierarquia canônica `ADMINISTRADORA → GRUPO → PRODUTOS/COTAS DE CRÉDITO → MODALIDADES DISPONÍVEIS`;
- Resolução da inconsistência da aba Grupos na Administradora através do join canônico com `grupos_modalidades_disponiveis`;
- Cota Mínima e Máxima calculadas dinamicamente a partir dos produtos ativos do grupo;
- Taxa Total calculada somando Taxa de Administração + Fundo de Reserva + Seguro Prestamista;
- Entrada em lote de cotas comerciais com normalização automática de texto monetário BRL e desduplicação;
- Suporte a overrides por cota (habilitação e parcelas por modalidade) e modalidade reduzida fixa vs personalizada com percentual padrão;
- Painel estatístico e de lances informativos para suporte à venda com gravação de histórico auditado em `grupo_estatisticas_historico`;
- Isolamento multi-tenant entre SaaS Global e ERP Local através de `empresa_grupos_config`;
- Relatório: `docs/relatorios-fases/PLATFORM-GRUPOS-CATALOGO-085.md`.


### Governança de contas pagas e a pagar (Migration 079)
- período por vencimento ou pagamento e filtros tenant-aware por banco, centro de custo e sócio;
- alteração, estorno, exclusão lógica e leitura do log exigem perfil `master` com vínculo N:N ativo `admin_empresa` no tenant;
- exclusão exige motivo; contas pagas pela empresa geram movimento inverso append-only antes do cancelamento;
- relatório: `docs/relatorios-fases/ERP-FINANCEIRO-GOVERNANCA-CONTAS.md`.
- estado: aplicada no Supabase principal em 17/08/2026; histórico remoto confirmado de 001 a 079.
- o balanço de dois sócios trata o total pago pessoalmente como débito da empresa, divide a responsabilidade em 50% para cada um e distingue dois acertos equivalentes: transferência de metade da diferença ou novas despesas pelo valor integral da diferença.
- contas são apresentadas por vencimento crescente; o resumo operacional separa pagas e vencíveis no mês atual, vencimentos futuros e entradas de caixa do mês atual.

## 5. Declaração Final de Segurança e Riscos

### ERP Contratações — Formalização V1 (Migrations 081–082 — Produção)
- `/erp/contratacoes` deixa de espelhar a tela do site e passa a ser uma fila operacional própria;
- a formalização continua exclusivamente no RPC canônico `rpc_converter_contratacao_venda`, sem segundo motor de Venda/Cota;
- a migration de Formalização foi homologada como 079 somente no Supabase Preview `bfpgyralphzjozrcwjsn`, após repair estritamente de metadata e alinhamento comprovado de 001–078; para Production, foi reconciliada como 081 porque `main` já contém 079 Financeiro e 080 Catálogo;
- Cliente é reutilizado pela identidade canônica empresa + documento da 071; documentos permanecem no Storage privado;
- a promoção para Production foi autorizada e concluída sem backfill histórico ou fixtures em Production.
- o primeiro provisionamento (`llvkybltnrmznvrntxng`) falhou; a branch saudável `bfpgyralphzjozrcwjsn` recebeu o repair direcionado 077→078, a 077 atual e, após dry-run exclusivo, a 079;
- a homologação transacional revelou que o trigger 071 `sync_cliente_from_contratacao()` tenta gravar histórico antes da contratação existir no `BEFORE INSERT`; a transação foi revertida e a promoção permanece bloqueada até correção forward-only autorizada;
- a correção forward-only foi homologada como 080 no Preview e reconciliada como 082 para Production; ela mantém identidade e `NEW.cliente_id` no BEFORE e move o histórico idempotente para AFTER INSERT/UPDATE; a matriz transacional passou integralmente e deixou zero fixtures;
- a colisão foi resolvida antes da promoção: `081_erp_contratacoes_formalizacao_v1` e `082_fix_sync_cliente_contratacao_historico` são os números finais desta entrega em Production;
- manual: `docs/manuais/MANUAL-ERP-CONTRATACOES.md`; relatório: `docs/relatorios-fases/ERP-CONTRATACOES-FORMALIZACAO-V1.md`.

* O estado funcional do Supabase Production inclui migrations `001–087`.
* `admin.gauchinhoconsorcios.com.br` está ativo, verificado e associado ao deployment Production da `main`; ele não é tenant e não possui fallback para Gauchinho.
* As migrations `070–087` estão versionadas e aplicadas em Produção; correções futuras permanecem obrigatoriamente forward-only.
* Os ambientes Preview/isolados registrados nos relatórios são descartáveis e não substituem a evidência de promoção do Supabase principal.
* A migration 083 de Platform Administradoras V2 foi aplicada em Production após conferência de `001–082`, com somente a própria 083 pendente no dry-run.
* Nenhum backfill ou recálculo histórico foi executado em Production nesta rodada.
* A Gauchinho permanece com ERP habilitado e a Empresa B permanece sem concessão de administradora. Nenhum tenant Sorriso foi criado.
* A 083 foi homologada no isolado com E2E real antes da promoção; o smoke público Production confirmou o host Platform e o redirecionamento autenticado sem erro 500.
* Platform Grupos Catálogo Operacional (Migration 085) e Assembleias Temporais & Herança de Modalidades (Migration 086):
  - Inconsistência de visualização na Administradora corrigida com join canônico em `grupos_modalidades_disponiveis`.
  - Herança de configurações padrão das modalidades da Administradora com suporte a override pontual por Grupo (`GRUPO_OVERRIDE` vs `ADMINISTRADORA_PADRAO`).
  - Cálculo temporal de assembleias (`calcularAssembleiasTemporal`) considerando dia/mês exato da 1ª assembleia, prazo total e data de referência no formato `realizadas / total / restantes` (ex: `7 / 100 / 93`), sem impactar o módulo de Assembleias/Pedras.
  - Exibição consistente em listagens (`/platform/grupos`, Administradora → Grupos) e no detalhe com cartões executivos de Prazo, 1ª Assembleia e Próxima Assembleia.
* Platform Programas da Franqueadora & Editor de Regras (Migration 087):
  - Edição completa e interativa de Programas em rascunho (ex: `SOCIOS`, novos programas, etc.).
  - Geração automática de regras padrão para todos os Tipos e Modalidades ativos da Administradora (`rpc_platform_gerar_regras_padrao_programa`).
  - Criação, edição e exclusão de Regras de Comissão e Cronogramas de Repasse com validação ao vivo da soma das etapas em relação à comissão total (`rpc_platform_salvar_regra_programa`, `rpc_platform_excluir_regra_programa`).
  - Suporte a criação de novos Programas em rascunho a partir da aba Programas da Franqueadora (`rpc_platform_criar_programa`).
  - Relatório: `docs/relatorios-fases/PLATFORM-PROGRAMAS-REGRAS-EDITOR-087.md`.

* Platform Modelos de Site, Domínios & Onboarding de Franquias (Migration 088):
  - Catálogo global de templates de site (`site_modelos`) com criação, duplicação, edição detalhada em 8 abas, versionamento e preview visual responsivo.
  - Preset canônico "Racon Inspired" criado em rascunho e modelo padrão "Gauchinho Default" preservado.
  - Motor estrito de sanitização de HTML/CSS (`html-sanitizer.ts`) bloqueando `<script>`, `<iframe>`, handlers `on*`, protocolos executáveis e injeções CSS perigosas.
  - Gestão de domínios com status de DNS e bloqueio estrito de `admin.gauchinhoconsorcios.com.br` para tenants.
  - Onboarding guiado em 8 etapas para Master Franquias com criação atômica no status seguro `em_treinamento` (inativo até ativação explícita).
  - Relatório: `docs/relatorios-fases/fase-088-platform-templates-dominios-onboarding.md`.

* Modelo de Site Canônico por Empresa e Runtime Gauchinho (Migration 132 / Fase 134):
  - `empresa_site_modelos(empresa_id, modelo_id)` é a fonte canônica da atribuição de template; `empresa_branding` armazena somente identidade e conteúdo editável.
  - Troca transacional e auditada por UUID via `rpc_platform_alterar_modelo_empresa`, limitada ao Platform Superadmin e a modelos publicados.
  - Runtime operacional da Gauchinho protegido por duas condições: entitlement `site_publico.operacional_habilitado` e vínculo publicado com `gauchinho_default`.
  - UI da empresa exibe vínculo real, versão, descrição, paleta, publicação, runtime e domínio, sem fallback que esconda ausência de configuração.
  - Relatório: `docs/relatorios-fases/fase-134-modelo-site-canonico-gauchinho.md`.

* Platform Catálogo ERP, Planos SaaS, Assinaturas, Sites de Parceiros e Overrides (Migrations 089 & 090):
  - Catálogo global de módulos ERP gerenciável com categorias e resolução automática de dependências em cascata.
  - Planos SaaS operacionais com workspace de 8 abas, entitlements de ERP, Site principal, limites de sites/domínios de parceiros e precificação.
  - Gestão de Assinaturas de Master Franquias vinculando plano, quantidades contratadas e vigência.
  - Onboarding em 8 etapas sincronizado com herança do plano e estimativa financeira em tempo real.
  - Mecanismo de liberações e overrides com resolução hierárquica (`Catálogo Global → Plano → Assinatura → Override → Usuário`).
  - Relatório: `docs/relatorios-fases/fase-089-platform-planos-assinaturas-limits.md`.

* Platform Template Racon Inspired V2 & Preview de Alta Fidelidade (Migration 091):
  - Refatoração estrutural da experiência do template Racon Inspired com topbar utilitária discreta, header clean em branco, hero com gradiente navy e simulador interativo integrado.
  - Seções comerciais de alta conversão: cards de segmentos com acervo de imagens do projeto, 4 pilares do consórcio, 3 passos da contemplação, barra de estatísticas/credibilidade e rodapé regulatório com autorização do Banco Central.
  - Componente canônico `RaconInspiredHome` integrado ao preview do workspace de templates e à renderização de novos tenants.
  - Publicação oficial do template (`status = 'PUBLICADO'`, versão 2) selecionável no onboarding de novas franquias.
  - Relatório: `docs/relatorios-fases/fase-091-platform-template-racon-inspired-v2.md`.

* Platform Motor Comercial de Planos SaaS, Assinaturas, Quotas e Overrides (Migration 092):
  - Catálogo global ERP com governança completa e criação de novos módulos operacionais (`rpc_platform_criar_modulo_catalogo`).
  - Planos SaaS operacionais com workspace de 8 abas, entitlements, precificação e exclusão segura (`rpc_platform_excluir_plano`).
  - Assinaturas de Master Franquias com validação de limites máximos contratados vs limites do Plano no backend.
  - Integração do Plano no Onboarding da Master Franquia com estimativa financeira detalhada.
  - Relatório: `docs/relatorios-fases/fase-092-platform-planos-quotas-overrides.md`.

* Platform HUB Operacional de Master Franquias (Migration 093):
  - Central de monitoramento em `/platform/empresas` com filtros dinâmicos, métricas de MRR e atalho para novo onboarding.
  - HUB do Cliente SaaS em `/platform/empresas/[id]` com 10 abas operacionais (Visão Geral, Empresa, Plano & Assinatura, ERP & Módulos, Usuários, Administradoras, Site & Identidade, Domínios, Parceiros & Sites, Histórico).
  - Checklist de Prontidão da Master com bloqueio de ativação até resolução de pendências mínimas (`rpc_platform_ativar_empresa`).
  - Suspensão preservando dados históricos com motivo e observação (`rpc_platform_suspender_empresa`).
  - Troca assistida de Plano SaaS com recálculo financeiro e sincronização de quotas operacionais (`rpc_platform_alterar_plano_empresa`).
  - Concessão/revogação de administradoras e criação de sites de parceiros respeitando quotas da franquia.
  - Relatório: `docs/relatorios-fases/fase-093-platform-master-franquias-hub.md`.

* Platform Governança Global de Usuários e Responsáveis (Migration 094):
  - Central de governança em `/platform/usuarios` com filtros por status, papel, franquia e convite pendente.
  - Fluxo de convite seguro (`+ Novo Usuário / Convidar`) com validação estrita de quotas no backend e bloqueio por limite atingido (`rpc_platform_convidar_usuario`).
  - Resolução hierárquica estrita de módulos (`Catálogo Global → Plano → Overrides → Vínculo → Efetivo`), impedindo concessão de módulos bloqueados para a Master Franquia.
  - Marcação de Responsável Principal único por Master Franquia com índice parcial único e transferência auditada (`rpc_platform_definir_responsavel_empresa`).
  - Reenvio de convite seguro sem criação de senha manual e integração total com a aba de usuários do HUB de franquias.
  - Relatório: `docs/relatorios-fases/fase-094-platform-usuarios-governanca.md`.

* Ativação coerente do Plano SaaS no onboarding (Migration 157):
  - O plano escolhido no onboarding cria uma assinatura `RASCUNHO`, reconhecida como vínculo válido pelo gate de ativação da Master Franquia.
  - A ativação explícita promove empresa e assinatura vinculada de forma atômica para `ativa`/`ATIVA`, mantendo administradora e usuário ativo como gates obrigatórios.
  - Não cria ou duplica assinatura, não executa backfill e registra a transição da assinatura na auditoria Platform.
  - Relatório: `docs/relatorios-fases/HOTFIX-ATIVACAO-MASTER-ASSINATURA-RASCUNHO-157.md`.

* Platform Gestão Operacional de Exceções & Overrides (Migration 095):
  - Central de governança em `/platform/overrides` (e `/platform/recursos`) para concessões pontuais e bloqueios de módulos/limites por Master Franquia.
  - Suporte a 7 tipos de exceções: `MODULO_ERP`, `LIMITE_USUARIOS`, `LIMITE_PARCEIROS`, `LIMITE_SITES`, `LIMITE_DOMINIOS_PROPRIOS`, `ERP_HABILITADO` e `RECURSO_CATALOGO`.
  - Resolução de valores explícita (`PLANO | CONTRATADO | OVERRIDE | EFETIVO`) sem ambiguidades.
  - Vigência temporária com retorno automático à herança do Plano e resolução de conflitos no backend (`rpc_platform_criar_override`).
  - Encerramento auditado com preservação de dados e histórico (`rpc_platform_encerrar_override`).
  - Relatório: `docs/relatorios-fases/fase-095-platform-overrides-gestao-operacional.md`.

* ERP Contas a Pagar — Governança, Autorização de Estorno, Exclusão Master e Log de Utilização (Migration 101):
  - Edição de contas a pagar abertas e dados cadastrais de contas pagas preservando fatos contábeis.
  - Exclusão de contas a pagar em aberto com motivo obrigatório (mín. 3 caracteres) por operadores; exclusão de contas pagas restrita exclusivamente a usuários Master com reversão contábil do caixa.
  - Estorno de contas pagas para usuários Master e consultores/usuários autorizados via flag `pode_estornar_contas` na tabela `empresa_usuarios`, configurável na tela de gestão de Usuários/Consultores.
  - Aba e painel de "Log de utilização (Auditoria)" para todos os operadores da empresa, com busca textual, filtros por ação (`CRIACAO`, `ALTERACAO`, `BAIXA`, `ESTORNO`, `EXCLUSAO`), datas e detalhamento de motivos e campos alterados.
  - Relatório: `docs/relatorios-fases/ERP-FINANCEIRO-GOVERNANCA-CONTAS.md`.

* O estado funcional do Supabase Production inclui as evoluções até a migration `130`. O metadata remoto possui uma lacuna histórica entre `092–127`, causada por aplicações manuais anteriores; as versões `128–130` foram registradas após execução e pós-check. Essa lacuna de metadata não autoriza reaplicação automática das migrations antigas.
* `admin.gauchinhoconsorcios.com.br` está ativo, verificado e associado ao deployment Production da `main`; ele não é tenant e não possui fallback para Gauchinho.
* As migrations `070–101` estão versionadas e aplicadas em Produção; correções futuras permanecem obrigatoriamente forward-only.
* Evidências consolidadas: `docs/relatorios-fases/PLATFORM-GRUPOS-CATALOGO-085.md`, `docs/relatorios-fases/PLATFORM-GRUPOS-TEMPORAL-HERANCA-086.md`, `docs/relatorios-fases/PLATFORM-PROGRAMAS-REGRAS-EDITOR-087.md`, `docs/relatorios-fases/fase-088-platform-templates-dominios-onboarding.md`, `docs/relatorios-fases/fase-089-platform-planos-assinaturas-limits.md`, `docs/relatorios-fases/fase-091-platform-template-racon-inspired-v2.md`, `docs/relatorios-fases/fase-092-platform-planos-quotas-overrides.md`, `docs/relatorios-fases/fase-093-platform-master-franquias-hub.md`, `docs/relatorios-fases/fase-094-platform-usuarios-governanca.md`, `docs/relatorios-fases/fase-095-platform-overrides-gestao-operacional.md` e `docs/relatorios-fases/ERP-FINANCEIRO-GOVERNANCA-CONTAS.md`.

## 6. Consolidação para escala — Migrations 126–127

Em 26/08/2026 foi concluído o hardening necessário para expansão multiempresa. O contrato comercial da formalização separa definitivamente `grupo_id`, `grupo_cota_id`, `administradora_modalidade_id`, valor da parcela da modalidade e prazo restante na data da venda. Vendas e cotas definitivas congelam os UUIDs e o snapshot temporal; grupos em andamento não reutilizam o prazo original como saldo restante.

O tenant operacional é resolvido pelo domínio e pelo vínculo N:N exato. O acesso público operacional depende de `empresas.configuracoes.site_publico.operacional_habilitado`, sem exceção de autorização por slug ou UUID. Imobiliárias, imóveis, simulações, eventos de analytics e integrações passam a carregar empresa; usuários imobiliários recebem vínculo por empresa em `empresa_usuarios.imobiliaria_id`.

As migrations locais que antes usavam os números `102–105` foram supersedidas para evitar colisão com a linha oficial da `main`, já avançada até a `125`. A sequência final é `126_hardening_multitenant_escala_franquias.sql` seguida de `127_formalizacao_canonica_e_comissoes_estritas.sql`.

O diagnóstico de Production confirmou o conversor antigo usando `grupos_cotas.valor_parcela`. A `127` elimina essa fonte, exige valor em `grupo_cota_modalidade_valores` e remove defaults implícitos de comissão. As duas migrations compilaram conjuntamente no Supabase Production dentro de transação encerrada por `ROLLBACK` e, depois, foram aplicadas em ordem e verificadas. O pós-check confirmou zero fatos sem empresa, RPCs estritas, acesso anônimo negado e preservação de 4 vendas, 23 previsões da franquia e 23 previsões de participantes. Relatório: `docs/relatorios-fases/FASE-126-127-CONSOLIDACAO-PRODUCAO-FORMALIZACAO-COMISSOES.md`.

## 7. Hardening financeiro de Contas a Pagar — Migration 128

Em 26/08/2026 foi implementada localmente a primeira subfase financeira posterior à consolidação 126–127. A migration `128_financeiro_contas_pagar_hardening_privacidade_tenant.sql` converte o bucket `contas-pagar-documentos` para privado, substitui as políticas amplas da migration 118 por políticas tenant-aware e impede novos vínculos cruzados de centro de custo, banco, fornecedor, sócio pagador ou documento.

Novos anexos usam caminho `empresa_id/competencia/uuid_nome`, não sobrescrevem objetos e só são abertos por URL assinada após autorização financeira. URLs públicas históricas continuam reconhecidas como referência legada para permitir a transição sem perda dos arquivos. A aplicação deixou de usar `usuarios.perfil` como autoridade no módulo e passou a exigir a permissão canônica `gerenciar_financeiro` do vínculo N:N ativo.

O build de produção e os seis testes contratuais da subfase foram aprovados. Em 26/08/2026, a migration 128 foi aplicada no Supabase Production canônico. O pós-check confirmou bucket privado com limite de 20 MB, quatro políticas tenant-aware e trigger de integridade ativo. Evidências e procedimento estão em `docs/relatorios-fases/FASE-128-HARDENING-CONTAS-PAGAR-PRIVACIDADE-TENANT.md`.

## 8. Contas recorrentes e duplicação — Migration 129

A migration `129_financeiro_contas_recorrentes_duplicacao.sql` introduz séries financeiras tenant-aware e idempotentes. Uma série possui UUID, empresa, tipo, primeiro vencimento, total de ocorrências e usuário responsável. As ocorrências permanecem fatos independentes em `financeiro_contas_pagar`, identificadas por série, índice e total.

A criação recorrente e a duplicação usam RPCs transacionais com permissão `gerenciar_financeiro` e validação de todas as referências contra a empresa ativa. Duplicações geram somente competências futuras abertas; comprovantes, pagamentos e movimentos de caixa não são copiados. A interface permite repetir inicialmente por 6 meses, alterar até 120, duplicar uma despesa existente e filtrar compromissos dos próximos 3, 6 ou 12 meses.

O build, o TypeScript e seis testes contratuais específicos foram aprovados. Em 26/08/2026, a migration 129 foi aplicada no Supabase Production; tabela de séries com RLS, três colunas de recorrência e ambas as RPCs foram confirmadas no pós-check. Relatório: `docs/relatorios-fases/FASE-129-CONTAS-RECORRENTES-DUPLICACAO-FUTURO.md`.

## 9. Transparência fiscal das comissões — Migration 130

A migration `130_comissoes_transparencia_fiscal_vinculo_previsoes.sql` formaliza o vínculo entre a previsão do participante e a previsão da franquia que lhe deu origem. Vínculos antigos presentes apenas em `snapshot_regra` são recuperados somente quando empresa e venda coincidem; novos vínculos são protegidos por FK e trigger tenant-aware.

O extrato `Minhas comissões` passa a chamar o valor do participante de líquido e, quando `participante_exibe_detalhes_fiscais` estiver habilitado, mostra bruto proporcional, imposto abatido e líquido dentro do mesmo card e no detalhamento mensal. Todos os valores vêm dos snapshots gravados em `comissao_previsoes_franquia`; nenhuma alteração fiscal atual recalcula fatos históricos.

Build e testes específicos aprovados. Em 26/08/2026, a migration 130 foi aplicada no Supabase Production; FK, trigger tenant-aware e zero vínculos divergentes foram confirmados no pós-check. Relatório: `docs/relatorios-fases/FASE-130-COMISSOES-TRANSPARENCIA-FISCAL.md`.

## 10. Governança da atualização do catálogo — Fase 131

A ação visual anteriormente apresentada como “sincronização” apenas invalidava o cache das páginas. A Fase 131 corrige o contrato operacional: o comando agora se chama “Atualizar visualização”, declara que recarrega somente registros já persistidos no catálogo SaaS e informa explicitamente que nenhuma API de administradora foi consultada.

A atualização pode ser executada por superadmin da plataforma ou por usuário do tenant com `gerenciar_grupos`; a vinculação de grupos legados fica restrita ao superadmin da plataforma. A autoridade permanece baseada em `is_platform_superadmin()` e no vínculo N:N canônico, sem `usuarios.perfil` como fonte de autorização.

Integrações futuras com administradoras deverão usar pipeline separado, auditável, idempotente e com histórico de execução. Relatório: `docs/relatorios-fases/FASE-131-GOVERNANCA-ATUALIZACAO-CATALOGO.md`.

## 11. Check-up e hardening dos menus do ERP — Fase 132

Todos os menus base e operacionais do ERP foram confrontados com suas rotas, subrotas, ações e regras de acesso. Rotas físicas passaram a possuir guards server-side próprios, impedindo acesso por URL direta quando o módulo estiver ausente de `empresa_usuarios.erp_modulos_visiveis`. Ações específicas também revalidam o módulo, em vez de confiar na ocultação da interface.

Operações críticas de Vendas usam `formalizar_vendas`, `papeis.codigo = admin_empresa` e `is_platform_superadmin()`, sem autoridade baseada em `usuarios.perfil` ou texto do nome do papel. Propostas gravam empresa explicitamente; documentos de contratação só recebem URL assinada depois da confirmação do tenant; Grupos e seletores de comissão respeitam as administradoras concedidas à franquia. Fallbacks operacionais para o UUID fixo da Gauchinho foram removidos das páginas reutilizadas pelo ERP.

O build de 146 rotas, a suíte completa e os testes contratuais foram aprovados. As fases 128–132 foram promovidas pela `main` no commit `db47ef2`; o deployment Production `dpl_6mzUBfbzzDpDU3jzax7RrVdg2jtV` ficou `Ready` e os smokes públicos dos hosts principal, ERP e Platform foram aprovados. A próxima etapa de escala é a paginação e agregação server-side de Contas a Pagar. Relatório: `docs/relatorios-fases/FASE-132-CHECKUP-MENUS-ERP-AUTORIZACAO.md`.

## 12. Paginação e agregados financeiros server-side — Fase 133 / Migration 131

A tela de Contas a Pagar deixa de baixar milhares de fatos para filtrar, paginar e totalizar no navegador. A RPC `rpc_consultar_contas_pagar` recebe filtros defensivos, limita despesas e logs a 100 itens por página e calcula saldo de caixa, cards mensais, despesas da empresa, pagamentos dos sócios, contas abertas e auditoria diretamente sobre o conjunto integral do tenant.

A empresa nunca vem do formulário: é resolvida pelo contexto ativo e revalidada pela função com `can_read_tenant_internal`. A UI usa sessão autenticada, não service role, e continua exigindo o módulo ERP correspondente. A opção “Todas” foi removida para impedir respostas sem limite. Relatório: `docs/relatorios-fases/FASE-133-CONTAS-PAGAR-PAGINACAO-AGREGADOS-SERVIDOR.md`.

Em 26/08/2026, a migration 131 foi compilada sob rollback, exercitada com uma sessão tenant real e aplicada no Supabase Production. O pós-check confirmou quatro índices, função registrada, acesso exclusivo de `authenticated` e retorno paginado com agregados completos. Nenhum fato financeiro foi modificado.

A implementação foi promovida pela `main` em `ef49086`; o deployment Production `dpl_91iYrPAuZhUgYfD28nNTwHD64Qqj` ficou `Ready`. Os smokes do domínio público, ERP protegido e Platform protegida foram aprovados.

## 13. Reconciliação do baseline 092–127 — Fase 135 / Migration 133

O metadata do Supabase Production possuía uma lacuna histórica entre `092–127`,
embora parte relevante do schema tivesse sido aplicada manualmente. A fase 135
substituiu suposições por uma auditoria read-only e reproduzível de tabelas,
colunas, constraints, triggers, buckets, funções e privilégios.

A migration `133_reconciliacao_historico_092_127_objetos_ausentes.sql` restaurou
somente os contratos comprovadamente ausentes das fases `092–096`, `098/106` e
`117`. Objetos já presentes não foram reaplicados. A função canônica de troca de
modelo da fase 134 permaneceu vinculada a `empresa_site_modelos`, sem regressão
para o legado em `empresa_branding`.

As RPCs restauradas exigem JWT e checagem interna, não concedem execução a
`PUBLIC`, `anon` ou `service_role` e usam `search_path=pg_catalog`. O bucket de
comprovantes de lances passou a validar tenant no path e permissão
`gerenciar_lances`.

O dry-run transacional, o pós-check e a sentinela de segurança 133 foram
aprovados. O histórico local/remoto passou a estar contínuo de `001` a `133`. A
colisão dos dois arquivos `101` foi resolvida mantendo Contas a Pagar como versão
ativa; o conversor antigo permanece no histórico Git e foi supersedido pelas
migrations `126–127`.

Relatório: `docs/relatorios-fases/FASE-135-RECONCILIACAO-MIGRATIONS-092-127.md`.

## 14. Quadro societário e fechamento imutável — Fase 136 / Migrations 134–135

O cadastro de sócios é configuração tenant-scoped da empresa no SaaS. A tabela
`empresa_socios` liga empresa, usuário, percentual e vigência; dados bancários e
Pix ficam em `empresa_socio_contas`, protegidos por RLS de escrita financeira.
O quadro vigente deve somar exatamente 100% e todo sócio precisa possuir vínculo
ativo em `empresa_usuarios` na mesma empresa.

O fechamento do ERP usa `rpc_fechar_socios` e congela cabeçalho, itens e
instruções nas tabelas `financeiro_fechamentos_socios`,
`financeiro_fechamento_socios_itens` e
`financeiro_fechamento_socios_instrucoes`. Nome, percentual, total pago,
responsabilidade e conta de destino viram snapshots. Triggers impedem `UPDATE`
e `DELETE`; correções futuras exigem um novo período, preservando a auditoria.
A migration 135 serializa o fechamento por empresa e rejeita qualquer período
sobreposto, impedindo dupla contabilização inclusive sob concorrência.

A equalização não presume dois sócios nem divisão 50/50. O algoritmo distribui
responsabilidades pelos percentuais vigentes, combina múltiplos devedores e
credores e explica tanto a transferência direta quanto o valor alternativo de
próximas contas. Os vínculos legados da Gauchinho foram migrados inicialmente
sem apagar fatos, e podem ser confirmados na aba **Sociedade** antes do primeiro
fechamento formal.

Pós-check de Production: cinco tabelas com RLS, três triggers de imutabilidade,
dois sócios ativos, nenhum quadro inválido, nenhum fechamento automático e RPCs
sem execução para `anon`/`service_role`. Histórico contínuo `001–135`.

Relatório: `docs/relatorios-fases/FASE-136-QUADRO-SOCIETARIO-FECHAMENTO-IMUTAVEL.md`.

## 15. Homologação autenticada do ERP e matriz de papéis — Fase 137

O acesso ao ERP é a interseção de três limites, nunca a união: módulos
contratados na empresa, módulos selecionados no vínculo e autoridade canônica
do papel/permissões. `erp_modulos_visiveis = null` continua significando herdar
o catálogo da empresa somente para papéis próprios do ERP; não transforma
parceiros em usuários internos.

Papéis `parceiro_comercial` e `parceiro_imobiliaria` ficam fora do ERP, mesmo
quando um vínculo legado possui a lista de módulos nula. `super_admin` e
`admin_empresa` acessam os módulos atribuídos. `gestor`, `consultor` e
`visualizador` passam ainda pela permissão exigida por cada rota. Menus
financeiros, comissões globais, usuários e regras não podem ser liberados apenas
marcando um checkbox incompatível com o papel.

Os mesmos critérios são usados pela barra lateral, pelo layout, por URL direta
e por Server Actions sensíveis. Em especial, Contas a Pagar revalida
`gerenciar_financeiro` e o guard do menu antes de consultar ou alterar dados. A
gestão de Consultores exige `gerenciar_participantes`, exatamente como a tela
reutilizada, evitando menu que termina em redirecionamento inesperado.

A matriz autenticada foi executada no domínio Production com sessões reais:

- `admin_empresa`: 20/20 rotas aprovadas;
- `super_admin`: 20/20 rotas aprovadas;
- `consultor`: 11 rotas operacionais aprovadas e 9 rotas gerenciais bloqueadas
  com 404;
- `gestor`: 18 rotas aprovadas; Consultores e Usuários bloqueados com 404;
- `visualizador`: somente Painel, Relatórios e Metas;
- papéis de parceiro: redirecionados para a área autorizada, sem entrada no ERP.

A simulação de gestor e visualizador reutilizou uma identidade técnica de
homologação; o vínculo original foi armazenado e restaurado no bloco `finally`,
com pós-check positivo. Nenhuma senha, token ou dado pessoal foi incluído no
repositório ou nos relatórios. Não houve migration nesta fase.

Código final `main@6fe2a46`; deployment Production
`dpl_3jzKGMWXjXYmJvuLk2JkfamfQL9T` em estado `READY`. Suíte: 185 arquivos e
1.028 testes aprovados, 9 arquivos e 37 testes ignorados; build de 146 rotas
aprovado. Relatório:
`docs/relatorios-fases/FASE-137-HOMOLOGACAO-AUTENTICADA-ERP-PAPEIS-PERMISSOES.md`.

## 16. Qualidade regressiva e decisões de integrações futuras — Fase 138

O lint foi convertido em barreira operacional: os 173 erros encontrados foram
eliminados ou reclassificados como dívida histórica explícita quando a correção
exige refatoração funcional. O baseline atual é de zero erros e 353 avisos, com
teto fixado no script `npm run lint`; qualquer aviso adicional passa a falhar o
comando. `npm run lint:errors` fornece uma verificação silenciosa de erros e
`npm run test:regression` executa a suíte completa com relatório detalhado.

Foram corrigidos problemas reais de renderização/qualidade na Home, carregamento
da Auditoria, componentes do formulário de financiamento e geração determinística
do identificador do QR. A configuração Vitest passou a ESM nativo, eliminando o
aviso de compatibilidade futura do Vite. Resultado: 185 arquivos e 1.028 testes
aprovados, 9 arquivos/37 testes live intencionalmente desativados e build de 146
rotas aprovado. Não houve migration; o banco permanece em `001–135`.

### Decisão aprovada para carteira legada

A importação será orientada por lote. Na tela, o operador selecionará um modelo
de comissão já cadastrado para a Racon e informará a data histórica da
contratação. O cronograma do modelo será projetado a partir dessa data: uma
venda com doze meses transcorridos e comissão prevista na parcela 18 produzirá
somente a etapa restante, seis meses à frente. Etapas vencidas não serão
recriadas nem recalculadas. O valor contratado será preservado em snapshot,
mesmo quando o grupo/cota atual já possuir valores diferentes.

O importador deverá comparar a parcela temporal calculada com eventual número
de parcela informado na planilha. Divergência bloqueia a linha para conferência,
em vez de inventar competência. Clientes contemplados usarão um fluxo/lote
separado com bloqueio explícito de geração de comissão. A implementação continua
aguardando uma amostra real da planilha para fechar cabeçalhos e validações.

### Decisão aprovada para API Racon

O primeiro contrato será exclusivo da Racon. O payload não receberá campo de
identificação da administradora: credencial e endpoint já definem a integração.
Cada futura administradora terá contrato/conector independente. A recepção Racon
deverá suportar grupo, cotas, vagas disponíveis e totais, taxas, seguro, fundo de
reserva, prazo, assembleias realizadas, primeira assembleia, características de
contemplação, média de lance livre e contemplados do mês.

A tela de auditoria da integração nascerá desativada, mas pronta para
homologação. Ela deverá mostrar lote, estado, possíveis erros por registro,
última tentativa, perda de conexão e ação clara de reprocessar. Recebimentos
serão idempotentes para que uma repetição após queda de conexão não duplique
grupo, estatística ou contemplação.

Conciliação bancária e projeção de caixa foram adiadas por decisão do produto.
Próxima entrega externa: documento do contrato da API Racon. A importação da
carteira legada foi implementada na Fase 139 após validação da planilha real.

Relatório: `docs/relatorios-fases/FASE-138-QUALIDADE-REGRESSIVA-E-DECISOES-FUTURAS.md`.

## 17. Importação auditável da carteira legada Racon — Fase 139

A rota autenticada `/erp/clientes/importar` lê planilhas `.xlsx`, exige prévia
e permite selecionar regra histórica Racon e beneficiário direto, ou importar
explicitamente sem comissão. Documento e telefone ausentes geram tags de
pendência. Erros estruturais, duplicidade ou grupo sem correspondência canônica
bloqueiam a linha.

As migrations 136–137 criam lotes e itens tenant-aware, idempotência por arquivo
e configuração e resolução do código numérico da planilha contra o catálogo.
A venda/cota histórica continua disponível para lances e contemplações, com o
valor contratado congelado. `afeta_faturamento=false` a exclui de faturamento,
metas e indicadores. Não é criada receita da franqueadora: apenas previsões
futuras diretas ao participante/sócio, líquidas do imposto vigente na data.

O contrato é a parcela 1. Até o dia 10, a parcela 2 vence no dia 10 do mês
seguinte; após o dia 10, no segundo mês seguinte. Etapas vencidas não são
recriadas. A planilha validada possui 157 linhas e nenhum dado foi importado
automaticamente. Quatorze dos 27 grupos distintos estão prontos; os demais
devem ser cadastrados/concedidos antes da confirmação.

Relatório:
`docs/relatorios-fases/FASE-139-IMPORTACAO-CARTEIRA-LEGADA-RACON.md`.

## 18. Contrato da API Racon v1 — Fase 140

O contrato candidato `1.0.0` define uma entrada exclusiva da Racon, sem UUID,
administradora, empresa ou franquia no payload. Credencial e endpoint resolvem a
origem global; todas as franquias com concessão Racon ativa e seus sites
autorizados herdam o catálogo, enquanto overrides locais permanecem separados.

O contrato cobre grupos, produtos/cotas comerciais, modalidades e parcelas
independentes, vagas, taxas, seguro, prazos, assembleias, lances, estatísticas
mensais e contemplações individuais opcionais sem dados pessoais. HMAC-SHA256,
proteção contra replay, idempotência, ordenação por versão, retry, consulta de
lote e auditoria/reprocessamento foram especificados. Nenhuma mensagem pode
alterar vendas, contratos, faturamento, caixa ou comissões.

Esta fase é exclusivamente documental: endpoints, filas, credenciais e tela de
auditoria continuam desativados até aprovação técnica da matriz e congelamento
do contrato. Artefatos:

- `docs/integracoes/racon/CONTRATO-API-RACON-V1.md`;
- `docs/integracoes/racon/openapi-racon-v1.yaml`;
- `docs/integracoes/racon/MENSAGEM-ENVIO-MATRIZ.md`;
- `docs/relatorios-fases/FASE-140-CONTRATO-API-RACON-V1.md`.

## 19. Auditoria do catálogo SaaS, ERP e sites — Fase 141

A auditoria confirmou uma única base física, mas editores divergentes e uma
governança incompleta. O ERP grava grupo `LOCAL/PENDENTE_PLATFORM` diretamente
na tabela canônica, o painel antigo do site possui outro conjunto de campos e a
Platform promove a mesma linha sem merge/deduplicação. A leitura pública não
exige status global, permitindo que legado ou proposta local do próprio tenant
seja elegível antes da homologação.

Em Produção há 19 grupos Racon e 176 produtos ativos: somente um grupo está
`GLOBAL/GLOBAL`; 18 estão `LEGADO/CONFIGURACAO_PENDENTE`, mas os 19 são
publicáveis pela regra atual. Dezessete ainda não possuem valores relevantes na
estrutura N:N de parcelas por modalidade. O número 5388 colide entre os tipos
Veículo e Moto, exigindo identidade composta até confirmação da matriz.

O estado-alvo aprovado para implementação futura separa propostas de catálogo
do catálogo global. ERP e painel do site reutilizarão formulário, validação e
server action únicos; a Platform poderá criar, fundir ou vincular a um grupo
existente. Somente catálogo homologado será consumido por sites, ERP, propostas
e contratações. A reconciliação dos grupos Gauchinho preservará UUIDs e operação
antes do corte do filtro público.

Relatório:
`docs/relatorios-fases/FASE-141-AUDITORIA-CATALOGO-GRUPOS-SAAS-ERP-SITES.md`.

Verificação posterior confirmou que o botão atual “Atualizar visualização” é
somente uma invalidação segura de cache (`revalidatePath`): ele atualiza a
leitura dos dados já cadastrados, mas não sincroniza, homologa nem publica novos
grupos. O catálogo público permaneceu operacional e os 38 testes direcionados
continuaram aprovados.

## 20. Comparação dos dados reais do site com SaaS/ERP — Fase 142

A página pública usa os mesmos UUIDs de `grupos_consorcio` e `grupos_cotas` do
SaaS/ERP. Os 19 grupos Racon do catálogo aparecem em Produção e a taxa/fundo do
grupo são usados diretamente nos cálculos. Não há uma tabela financeira paralela
do site.

A regra de negócio foi refinada: Integral, Reduzida e Personalizada são opções
do mesmo conceito “modalidade da parcela”. O SaaS distribui disponibilidade e
parâmetros, enquanto um motor único calcula o valor final para site, ERP,
proposta e contratação. A nomenclatura de comissão/lance não deve representar
modalidade da parcela. Também foram encontrados um produto sem parcela-base no
1463, produtos de mesmo crédito duplicados no 5488, seis grupos com zero vagas
ainda publicados e uma inconsistência manual de prazo no 5388 Moto.

O modelo-alvo mantém uma versão global homologada e permite à franquia criar uma
versão candidata. Alterações operacionais de baixo risco podem ser provisórias e
locais, com expiração e alerta; dados financeiros/estruturais exigem homologação
antes da publicação global. A transição deve preservar UUIDs e operação atual.

Relatório:
`docs/relatorios-fases/FASE-142-AUDITORIA-GRUPOS-SITE-SAAS-ERP.md`.

A tela de vinculações foi confirmada como exclusiva para correção histórica. O
seletor de empresa não filtra o catálogo exibido nem o contador de publicação:
uma empresa sem concessão ainda aparece com 19 grupos “publicados”. Em escala,
o catálogo deve ser editado uma única vez por administradora e propagado por
versão/tag de cache a todas as concessões ativas, sem atualização individual.

## 21. Fluxo da contratação e permissões — Fase 143

O requisito confirmado estabelece que o site calcula e gera a contratação; o
ERP confere a integridade, associa a cota real e participantes, formaliza a venda
e gera comissões. A auditoria encontrou que o site preserva seu cálculo no
snapshot, mas o servidor ainda não recalcula integralmente o payload na criação
da proposta e a RPC de formalização substitui a parcela por um valor de
`grupo_cota_modalidade_valores`. Esse comportamento será corrigido para um
snapshot servidor imutável, versionado e com hash.

O Admin do site da franquia ficará restrito à apresentação local: visibilidade,
destaque, ordem, textos e subconjunto das modalidades oficiais. Taxas, fórmula,
créditos e regras globais permanecem na Platform; correções locais geram pedido
de homologação. O editor de cotas hoje visível para não-Superadmin, embora
bloqueado pelas actions, deve ser removido da interface.

As permissões serão separadas por capacidade para catálogo, apresentação,
solicitação, homologação, proposta, conferência, cota real, participantes e
formalização. Menu, rota, server action, RPC e RLS devem aplicar a mesma decisão
tenant-aware e negar por padrão.

Relatório:
`docs/relatorios-fases/FASE-143-FLUXO-CONTRATACAO-CATALOGO-E-PERMISSOES.md`.

## 22. Snapshot comercial imutável do site e formalização ERP — Fase 144

O site permanece como origem do cálculo completo de crédito, parcela, seguro,
lances e pós-contemplação. A criação da proposta passou a repetir o cálculo no
servidor com o mesmo motor TypeScript e o catálogo autorizado, descartando
resultados financeiros enviados pelo navegador. O snapshot persistido recebe
versão, data, origem, imutabilidade e hash SHA-256.

O ERP confere a assinatura, preserva crédito/parcela aceitos e bloqueia a troca
de grupo/produto nas propostas novas. Modalidade, perfil e cronograma no ERP são
exclusivamente referências para o motor de comissão. A migration 138 removeu a
tabela N:N de parcelas por modalidade como fonte da venda e impediu que uma
venda altere o catálogo global compartilhado.

O editor estrutural antigo de produtos foi ocultado para não-Superadmin. A
franquia mantém somente configuração de apresentação local e essa escrita exige
`gerenciar_grupos`, usando obrigatoriamente o tenant ativo da sessão. O Supabase
principal está alinhado em `001–138`.

Relatório:
`docs/relatorios-fases/FASE-144-SNAPSHOT-COMERCIAL-SITE-ERP-E-PERMISSOES.md`.

## 23. Catálogo de créditos, autonomia local e projeção de caixa — Fase 145

`grupos_consorcio` permanece canônico por administradora e `grupos_cotas`
representa somente valores de crédito, não parcelas. As categorias N:N permitem
que o mesmo UUID de grupo seja publicado em múltiplos segmentos. O site calcula
Integral, Reduzida e Personalizada a partir das regras do grupo; o ERP conserva
o snapshot aceito pelo cliente.

A franquia pode ocultar grupo/modalidade e usar uma alteração estrutural
candidata enquanto aguarda homologação. Somente a Platform promove a alteração
para toda a rede. Zero vagas mantém o grupo publicado com o estado “Aguardando
novas vagas”. A importação histórica pode criar grupo/crédito básico inativo,
sem afetar faturamento ou disponibilizar venda.

O financeiro exibe projeção mensal baseada no saldo contábil append-only,
comissões líquidas previstas e contas abertas da empresa. Conciliação e
sincronização bancária não fazem parte desta fase. O schema de Produção foi
saneado até `144` e o lint remoto não apresenta erros.

Relatório:
`docs/relatorios-fases/FASE-145-CATALOGO-CREDITOS-GOVERNANCA-E-PROJECAO-CAIXA.md`.

## 24. Identidade e convite do responsável da franquia — Fase 146

O cadastro da Platform cria uma identidade-base neutra em `usuarios` e mantém
papel, permissões, módulos e condição de responsável exclusivamente no vínculo
N:N `empresa_usuarios`. O campo legado `usuarios.perfil` não representa mais o
papel tenant e recebe `visualizador`, valor aceito pela constraint histórica.

Um vínculo de empresa aceita somente papel `COMPANY`: papéis `PLATFORM` são
rejeitados por trigger, e papéis customizados precisam pertencer à mesma
empresa. Assim, marcar “Responsável Principal” não promove o usuário a
Superadmin da plataforma.

O convite é emitido pelo Supabase Auth. O UUID de autenticação é persistido em
`usuarios.auth_user_id`; o usuário define a própria senha em `/definir-senha` e
`rpc_ativar_meus_convites()` ativa apenas seus vínculos pendentes. Falhas de
entrega preservam o vínculo como `CONVIDADO` para reenvio auditável.

Relatório:
`docs/relatorios-fases/FASE-146-HOTFIX-USUARIO-PRINCIPAL-FRANQUIA.md`.

## 25. Domínios tenant e DNS automático — Fase 147

`empresa_dominios` mantém estados independentes para registro no projeto
Vercel, propagação DNS e HTTPS/SSL. O cadastro da Platform tenta registrar o
host no projeto `guachinho-site`, obtém os registros recomendados e apresenta ao
operador apenas o apontamento necessário no provedor do domínio.

A ativação não é manual: DNS público e HTTPS precisam fornecer evidência real.
Pendências são reprocessadas pelo cron `/api/cron/dominios` a cada dez minutos,
protegido por `CRON_SECRET`. Alterar o host invalida a verificação anterior e
reinicia o ciclo. A integração usa `VERCEL_API_TOKEN` exclusivamente no servidor.

Relatório:
`docs/relatorios-fases/FASE-147-DOMINIOS-DNS-VERCEL-AUTOMATICO.md`.

## 26. Tipo canônico, categorias N:N e reajuste anual no SaaS — Fase 148

O tipo estrutural do grupo é `tipo_administradora_id` (UUID). O campo textual
`modalidade` existe somente por compatibilidade e é sincronizado por trigger,
eliminando divergências como um UUID Imóvel ainda descrito como Moto.

Categorias de publicação são independentes e N:N. Um único grupo pode aparecer
simultaneamente nas abas Imóvel, Automóvel e Moto sem duplicar grupo, taxas ou
créditos. Modalidades de parcela continuam sendo Integral, Reduzida e
Personalizada e não devem ser confundidas com tipo ou categoria.

Empresas, administradoras e grupos permanecem visíveis no admin do site somente
para consulta. A Plataforma SaaS é o único local de mutação global. O reajuste
anual altera exclusivamente os valores de crédito, de forma transacional e
auditada; o site mantém seu motor de cálculo de parcelas e o ERP conserva o
snapshot comercial aceito pelo cliente.

Relatório:
`docs/relatorios-fases/FASE-148-GRUPOS-TIPO-CANONICO-REAJUSTE-SAAS-E-LEITURA-SITE.md`.

## 27. Isolamento tenant nas consultas SaaS do admin — Fase 149

O namespace `/admin` sempre opera no tenant resolvido pelo host, sessão e
vínculo ativo, inclusive quando o operador também é Platform Superadmin. A
consulta de empresa mostra somente `empresaAtiva`; a consulta de
administradoras mostra apenas concessões ativas de `empresa_administradoras`
para esse mesmo UUID.

Rotas de detalhe validam o UUID solicitado contra o tenant ou concessão antes
da leitura. A visão global de todas as franquias, administradoras e vínculos
existe apenas em `/platform`. Assim, privilégios globais não provocam exposição
acidental de outros tenants dentro do site de uma franquia.

Relatório:
`docs/relatorios-fases/FASE-149-ESCOPO-TENANT-CONSULTAS-SAAS-NO-SITE.md`.

## 28. DNS Registro.br, domínio raiz e delegação Vercel — Fase 150

`empresa_dominios.tipo` é a única fonte para distinguir domínio próprio de
subdomínio. A quantidade de pontos não pode ser usada, pois domínios brasileiros
como `.com.br` seriam classificados incorretamente.

Para domínio próprio, o fluxo preferencial delega o DNS completo à Vercel por
`ns1.vercel-dns.com` e `ns2.vercel-dns.com`, somente depois de o host estar no
projeto `guachinho-site`. Se houver e-mail, MX/TXT devem ser preservados antes da
troca. Para subdomínio, mantém-se o provedor do domínio pai e usa-se CNAME.

O diagnóstico aceita a delegação NS da Vercel, o IP atual recomendado pelo
projeto e o IP legado ainda suportado. Presença de variáveis de ambiente indica
apenas credenciais configuradas, não conexão validada. Falhas de token, conflito
de projeto, DNS e SSL permanecem estados independentes e auditáveis; a
confirmação manual de presença na Vercel é um fallback explícito.

Relatório:
`docs/relatorios-fases/FASE-150-DNS-REGISTROBR-VERCEL.md`.

## 29. Cadastro completo e bootstrap do responsável — Fase 151

O cadastro da Master Franquia mantém CNPJ, telefone, WhatsApp e CEP
normalizados no banco, enquanto a interface aplica máscaras brasileiras. O
endereço da sede é estruturado em `cep`, `endereco`, `numero`, `complemento`,
`bairro`, `cidade` e `estado`. A consulta ViaCEP é apenas uma assistência de
preenchimento: o operador pode corrigir os dados manualmente e o servidor
valida CNPJ, DDD/número, CEP e UF antes da persistência.

O primeiro responsável é cadastrado ainda durante `em_treinamento`. Esse fluxo
é exclusivo do Platform Superadmin, conserva papel `COMPANY`, quota, módulos,
unicidade do responsável, vínculo N:N em `empresa_usuarios` e auditoria. A
empresa não precisa estar ativa para receber o primeiro convite porque esse
vínculo é justamente um requisito para sua ativação; acesso operacional do
tenant continua condicionado aos gates normais de empresa e vínculo.

Relatório:
`docs/relatorios-fases/FASE-151-CADASTRO-MASTER-ENDERECO-E-BOOTSTRAP-RESPONSAVEL.md`.

## 30. Detalhes operacionais, tabela canônica e múltiplos lances — Fase 152

O UUID de `grupos_consorcio` continua sendo a identidade canônica consumida por
SaaS, Site e ERP. As visualizações tenant exibem assembleias realizadas/prazo,
prazo restante, capacidade de participantes, taxas, seguro, vagas, observações
operacionais e os tipos de lance registrados no catálogo global.

`grupos_modalidades_lance` é a coleção canônica N:1 de estratégias por grupo.
Ela admite vários tipos de lance, recurso próprio mínimo e a modalidade de
parcela que o motor do site já interpreta. O cadastro é feito no SaaS por RPC
transacional; os campos escalares legados do grupo guardam somente o primeiro
lance válido para compatibilidade, sem substituir a coleção.

`grupos_tabelas` guarda exatamente um documento comercial atual por UUID do
grupo. O bucket `grupos-tabelas` é privado e não possui leitura direta por
usuários autenticados: upload e URL assinada passam por Server Actions que
validam vínculo N:N, permissão `gerenciar_grupos` para escrita e concessão da
administradora. Upload pelo Site ou ERP substitui o arquivo anterior e atualiza
ambos os portais; `grupos_tabelas_historico` preserva metadados imutáveis de
cada substituição, incluindo empresa, usuário, origem e horário.

Relatório:
`docs/relatorios-fases/FASE-152-GRUPOS-DETALHES-TABELA-CANONICA-E-LANCES.md`.

## 31. Cadastro e exibição do responsável da Master — Fase 153

`empresa_usuarios` possui duas relações com `usuarios`: a identidade vinculada
em `usuario_id` e o eventual autor em `convidado_por`. Todo embedding PostgREST
partindo de `empresa_usuarios` deve declarar explicitamente
`usuarios!empresa_usuarios_usuario_id_fkey`; relações implícitas são proibidas
porque se tornam ambíguas e podem ocultar toda a equipe.

O cadastro resolve o vínculo por UUID e consulta a identidade por `usuario_id`
em uma segunda operação administrativa. Essa separação mantém o fluxo
idempotente, reaproveita identidades globais sem duplicá-las e preserva a
relação N:N entre usuário e empresas. O mecanismo histórico por convite foi
substituído pelo cadastro direto descrito na seção 36.

Ao iniciar o cadastro na ficha da Master, o UUID da empresa é carregado no
formulário global, o primeiro usuário é marcado como responsável e o operador
pode retornar à mesma ficha. A empresa pode permanecer `em_treinamento`: o
responsável é pré-requisito para ativação, não consequência dela.

Relatório:
`docs/relatorios-fases/FASE-153-HOTFIX-CONVITE-RESPONSAVEL-MASTER.md`.

## 32. Data civil sem deslocamento de fuso — Hotfix

Campos SQL `date`, como `contratacoes_online.data_nascimento`, representam uma
data civil e não um instante. A apresentação de strings `AAAA-MM-DD` deve ser
feita sem conversão UTC/local, evitando que fusos negativos exibam o dia
anterior. Timestamps e objetos `Date` continuam sujeitos à formatação temporal
normal.

O hotfix não altera nem recalcula registros: ele corrige somente a apresentação
do valor já persistido e mantém o formulário de edição no formato ISO civil.
Relatório:
`docs/relatorios-fases/HOTFIX-DATA-NASCIMENTO-SEM-DESLOCAMENTO-FUSO.md`.

## 33. Parcelas consolidadas pela quantidade de cotas — Hotfix

O cálculo de linha mantém valores unitários para permitir a escolha comercial
de cada cota, mas todo resumo de proposta ou contratação apresenta valores
consolidados. `parcelaIntegralTotal` e `parcelaReduzidaTotal` somam a parcela de
cada linha multiplicada por `quantidadeCotas`, assim como crédito, primeira
parcela e demais totais já faziam.

A leitura prioriza a recomposição pelas linhas persistidas para corrigir também
snapshots anteriores que gravaram totais unitários. Quando todas as linhas
compartilham a mesma razão reduzida/integral, a interface explicita o percentual
aplicado, como “Parcela reduzida (60%)”. Não há alteração de fatos ou migration.
Relatório:
`docs/relatorios-fases/HOTFIX-PARCELAS-CONSOLIDADAS-POR-COTAS.md`.

## 34. Parcela total por linha e padrão visual pós-contemplação — Hotfix

Na tabela pública de grupos, “Parcela” representa o desembolso total da linha:
parcela unitária da modalidade selecionada, com a opção de seguro aplicável,
multiplicada por `quantidadeCotas`. Assim, linha e rodapé usam o mesmo valor
consolidado.

A parcela pós-contemplação mantém a fórmula comercial vigente e passa a usar o
destaque amarelo dos valores comerciais principais em desktop, mobile e telas
de ajustes. Não há alteração de dados ou migration. Relatório:
`docs/relatorios-fases/HOTFIX-GRUPOS-PARCELA-TOTAL-LINHA-COR-POS-CONTEMPLACAO.md`.

## 35. Parcela reduzida da proposta preserva a simulação — Hotfix

Quando a modalidade selecionada é reduzida ou personalizada, os campos
“Parcela inicial estimada” e “Parcela reduzida” da proposta representam o mesmo
desembolso inicial aceito pelo cliente. Ambos usam `primeiraParcela` do snapshot
e, portanto, incluem o seguro somente quando ele foi selecionado na tela de
grupos.

O percentual exibido continua descrevendo a razão comercial entre as parcelas
base reduzida e integral, sem transformar seguro em redução. A leitura recompõe
também propostas anteriores que preservam modalidade e primeira parcela, sem
alterar fatos no banco. Relatório:
`docs/relatorios-fases/HOTFIX-PROPOSTA-PARCELA-REDUZIDA-IGUAL-SIMULADA.md`.

## 36. Cadastro direto com senha inicial e troca obrigatória — Hotfix

O Platform Superadmin cadastra o usuário sem envio de convite ou recuperação
de senha por e-mail. O servidor cria e confirma a identidade no Supabase Auth,
gera uma senha inicial criptograficamente aleatória e ativa o vínculo N:N em
`empresa_usuarios`. A senha é devolvida somente na resposta imediata da ação
para cópia pelo operador; ela não é gravada em tabelas, auditoria ou logs.

A listagem global usa o cliente administrativo somente após validar
`PLATFORM_SUPERADMIN`, pois a RLS tenant não deve ocultar vínculos da governança
global. Erros de leitura são exibidos, nunca convertidos silenciosamente em
“0 usuários”. Quando o cadastro cria o primeiro responsável, o fluxo executa
`rpc_platform_ativar_empresa`; com os demais gates satisfeitos, empresa e
assinatura são ativadas imediatamente.

A ficha da Master usa a mesma leitura administrativa após autorização e deve
contabilizar vínculos ativos ainda durante `em_treinamento`. O gate de usuário
não pode depender de a empresa já estar ativa, pois o primeiro responsável é
justamente um pré-requisito para essa ativação.

A identidade recebe `app_metadata.exige_troca_senha = true`. Login e proxy
direcionam essa sessão exclusivamente para `/definir-senha`; após a alteração,
o servidor marca o requisito como concluído e libera a navegação. Identidades
que já estejam ativas em outra empresa são apenas vinculadas à nova franquia e
mantêm sua senha atual, evitando redefinir uma credencial global por causa de
um novo vínculo tenant. Convites históricos continuam compatíveis com
`rpc_ativar_meus_convites()`, sem novos e-mails.

Não há migration, backfill ou alteração de dados históricos neste hotfix.
Relatório:
`docs/relatorios-fases/HOTFIX-USUARIO-SENHA-INICIAL-TROCA-OBRIGATORIA.md`.

## 37. Regras comerciais informativas no cadastro de grupos — Fase 155

`grupos_modalidades_lance` permanece como a única coleção de modalidades de
lance consumida por Site, ERP e Platform. A migration 153 acrescenta a base de
referência (`SALDO_DEVEDOR` ou `CREDITO`) sem criar tabela paralela. Máximo
embutido e recurso próprio mínimo são apresentados separadamente e não escolhem
nem alteram a modalidade da parcela.

O percentual efetivo da parcela reduzida é configurado no grupo e não exige a
seleção manual de modalidade de comissão. As três faixas canônicas de comissão
continuam inalteradas. Para novos grupos, a vigência informativa pode ser até a
contemplação ou até a assembleia X; nesse último caso a integral começa em X+1,
com data projetada a partir da primeira assembleia. Configurações ausentes em
grupos legados permanecem nulas e não produzem texto novo nas propostas.

O ERP cria o candidato local com UUID definitivo e o disponibiliza para
continuidade do cadastro no próprio tenant. A homologação da Platform promove o
mesmo registro para `GLOBAL`; não duplica grupo nem altera snapshots históricos.

Relatório:
`docs/relatorios-fases/FASE-155-GRUPOS-LANCES-E-VIGENCIA-PARCELA-REDUZIDA.md`.

## 37. Cadastro completo e opções fixas de parcela reduzida — Fase 156

O cadastro compartilhado entre ERP e Platform passou a expor os campos já
canônicos de fundo de reserva, seguro prestamista em fator decimal e observações.
A tabela comercial continua no Storage privado e nas tabelas canônicas da Fase
152; seu envio pode ocorrer no mesmo formulário depois da criação do UUID
definitivo do grupo.

`grupos_consorcio.percentuais_parcela_reduzida` guarda uma coleção ordenada de
opções fixas, como 60% e 70%. A primeira mantém compatibilidade com o campo
singular legado. Grupos antigos sem a coleção continuam inalterados. O site
permite selecionar uma das opções e o servidor valida e congela essa escolha no
snapshot comercial. As faixas de comissão permanecem independentes.

O ERP pode escrever diretamente a coleção somente em grupo local originado pelo
próprio tenant; catálogo global continua sob autoridade exclusiva da Platform.
O fluxo de cadastro oferece salvar e continuar ou salvar e retornar à lista,
onde o novo grupo aparece com seu estado de homologação.

Relatório:
`docs/relatorios-fases/FASE-156-CADASTRO-COMPLETO-GRUPOS-OPCOES-REDUZIDAS.md`.

## 38. Seguro prestamista global dos grupos — Fase 157

Seguro prestamista deixa de ser uma capacidade opcional do grupo. Todo grupo
mantém apenas sua taxa decimal; a adesão antes da contemplação pertence à venda
e o seguro é obrigatório após a contemplação. ERP, Platform e o cadastro
administrativo legado não exibem mais checkbox de habilitação.

As colunas `seguro_habilitado` e `seguro_pos_contemplacao` permanecem somente
para compatibilidade com o runtime existente. A migration 155 normaliza grupos
existentes e define `true` como padrão futuro, sem remover dados nem alterar
snapshots históricos.

No site, `grupos_consorcio.seguro_percentual` é a fonte canônica tanto para a
disponibilidade das opções `Com`/`Sem` quanto para o valor calculado. A opção
`Com` soma o seguro calculado com o fator do grupo; a opção `Sem` mantém a
primeira parcela sem esse acréscimo. Os booleanos legados não substituem a taxa.

Relatório:
`docs/relatorios-fases/FASE-157-SEGURO-PRESTAMISTA-GLOBAL-GRUPOS.md`.

## 39. Créditos comerciais no cadastro de grupos — Fase 158

ERP e Platform gerenciam os créditos comerciais na tabela canônica
`grupos_cotas`. O formulário de grupo permite preparar e incluir múltiplos
créditos; a tabela de detalhes oferece edição e exclusão. Grupos locais podem
ser gerenciados imediatamente pelo tenant de origem, enquanto grupos globais
permanecem sob autoridade da Platform.

Edição ou exclusão nunca reescreve fatos históricos: produto utilizado é
inativado e, em caso de mudança de valor, substituído por uma nova opção. A
parcela não é persistida nesse cadastro; continua calculada pelo site e
congelada no snapshot da proposta.

Relatório:
`docs/relatorios-fases/FASE-158-CREDITOS-GRUPO-INCLUIR-EDITAR-EXCLUIR.md`.

## 40. Status canônico da Master Franquia — Fase 159

As transições operacionais da Master Franquia usam os valores canônicos da
tabela `empresas`: `ativo`, `suspenso`, `cancelado` e `em_treinamento`. O campo
booleano `ativo` permanece coerente e protegido pela constraint
`empresas_status_ativo_coerente`; a correção não flexibiliza essa integridade.

As RPCs de ativação, suspensão e reativação gravam o mesmo vocabulário no
registro e na auditoria. O hub e a listagem da Platform reconhecem os estados
canônicos e apresentam os rótulos femininos apenas na interface.

Relatório:
`docs/relatorios-fases/FASE-159-ATIVACAO-MASTER-STATUS-CANONICO.md`.

## 41. Publicação atômica do site na ativação — Fase 160

Ativar uma Master Franquia publica, na mesma transação, a empresa, a assinatura,
o branding institucional e o vínculo do modelo de site. A transição exige domínio
principal ativo e verificado; identidade e modelo também são obrigatórios.

O resolver público continua falhando fechado. A ativação não cria fallback por
slug nem ignora verificação de domínio. Registros ativados antes desta regra são
reconciliados somente quando todo o conjunto publicável já está configurado.

Relatório:
`docs/relatorios-fases/FASE-160-PUBLICACAO-SITE-ATIVACAO-MASTER.md`.

## 42. Runtime orientado pelo modelo e menus do tenant — Fase 161

`empresa_site_modelos` é a fonte canônica da apresentação efetiva do tenant. O
runtime combina o catálogo do `site_modelos` com `menus_habilitados`, carrega
identidade, seções e footer do modelo e aplica apenas overrides não nulos do
branding da empresa.

Templates que fornecem chrome próprio, como `racon_inspired`, substituem o
header/footer global em todas as páginas públicas. Nenhum CTA é criado fora do
catálogo habilitado. A seleção publicada de menus operacionais também funciona
como entitlement explícito das rotas correspondentes; ausência de aprovação
mantém a falha fechada.

Relatório:
`docs/relatorios-fases/FASE-161-MENUS-MODELO-RUNTIME-TENANT.md`.

## 43. Rotas canônicas do catálogo Racon — Hotfix

Os menus e CTAs do modelo `racon_inspired` apontam exclusivamente para rotas
públicas existentes: imóvel com parcela reduzida, carro sem entrada e caminhão
para autônomo. A migration 161 reconcilia catálogo, banners e links auxiliares
sem modificar a seleção de menus de qualquer empresa.

O chrome do modelo apresenta todos os menus configurados também no desktop e
as âncoras institucionais `sobre` e `contato` pertencem ao próprio template,
mantendo a identidade visual Racon em toda a navegação.

Relatório:
`docs/relatorios-fases/HOTFIX-ROTAS-MENUS-MODELO-RACON.md`.

## 44. Formalização ERP com múltiplas cotas — Fase 170

A concessão de administradoras no ERP usa o estado canônico
`empresa_administradoras.status = 'ATIVA'`. Erros dessa consulta não podem ser
convertidos em catálogo vazio, pois isso oculta grupos válidos e induz o
operador a acreditar que o produto não foi cadastrado.

Uma contratação continua gerando exatamente uma venda, pelo crédito e parcela
totais aceitos. `quantidade_cotas` congela a quantidade comercial e a venda
passa a possuir uma ou mais `cotas_definitivas`, ordenadas e únicas por
`(venda_id, ordem_cota)`. Crédito e parcela unitários reconciliam exatamente com
o total da venda; comissão e previsões permanecem únicas por venda e usam o
snapshot total, sem multiplicação posterior.

Snapshots assinados pelo site são imutáveis também quanto à quantidade. A RPC
multicotas reutiliza o conversor canônico dentro da mesma transação, exige
`formalizar_vendas`, valida tenant, concessão, grupo, produto e total contratado
e não altera o catálogo global. Registros históricos permanecem com quantidade
e ordem 1.

Relatório:
`docs/relatorios-fases/FASE-170-ERP-FORMALIZACAO-MULTIPLAS-COTAS.md`.

## 44. Identidade independente por tenant — Fase 162

O branding efetivo de todas as superfícies é resolvido pelo domínio e composto a
partir de `empresa_branding` e `empresa_site_modelos`. Site público, login,
Admin, ERP e Área do Parceiro recebem o mesmo contexto de nome, logomarca e
paleta, sem importar identidade de outra empresa.

O modelo `racon_inspired` usa tema claro branco/azul e não renderiza mascote,
textos, metadata ou assistente próprios do Gauchinho. As funcionalidades
operacionais continuam compartilhadas; somente a apresentação é isolada. O
tenant original preserva seu tema legado em seu próprio domínio.

Relatório:
`docs/relatorios-fases/FASE-162-IDENTIDADE-INDEPENDENTE-TENANT-RACON.md`.

## 45. Aparência por página e bloco — Fase 163

O modelo Racon reutiliza `site_modelos.identidade_visual.paginas_blocos` para
armazenar overrides por caminho de página e identificador semântico de bloco.
Fundo, títulos, textos, destaques, botões e imagens são editáveis separadamente.
A precedência é padrão do modelo, página e bloco. Configurações ausentes
preservam os padrões e as imagens legadas de `imagens_banners`.

As cores aceitam hexadecimal validado e as imagens caminhos locais ou HTTPS;
não é permitido CSS arbitrário nesta configuração. O upload reutiliza a
biblioteca de mídia existente. A logo padrão usa `logo_padrao_url`, com o
arquivo oficial Racon como fallback exclusivo deste modelo.

`catalogo_menus[].ativo=false` oculta o menu no modelo; `ativo_padrao`
continua sendo apenas o padrão de onboarding. As seleções da empresa continuam
em `empresa_site_modelos.menus_habilitados`. Visibilidade não concede nem
revoga permissões de rotas. Não há migration, alteração de cálculos ou dados
comerciais. O salvamento permanece protegido pela RPC de Platform Superadmin.

Relatório: `docs/relatorios-fases/FASE-163-APARENCIA-PAGINAS-BLOCOS-RACON.md`.

## 46. Redefinição de senha do responsável — Fase 164

O Platform Superadmin pode gerar senha temporária para o responsável principal
ativo via listagem de usuários ou HUB da empresa. A ação valida o vínculo
`empresa_usuarios` na empresa informada e resolve `usuarios.auth_user_id`;
não presume igualdade entre identidade comercial e Auth.

A operação exige confirmação, substitui a senha global da identidade e
preserva papéis, vínculos e status. `app_metadata.exige_troca_senha=true`
reutiliza o fluxo obrigatório de definição da senha no login.
Os metadados registram autor e data, nunca a senha. A credencial é retornada
apenas para a resposta da ação e descartada da interface ao fechar o modal.
Nenhuma senha real é alterada como parte de testes ou implantação.

Relatório: `docs/relatorios-fases/FASE-164-NOVA-SENHA-RESPONSAVEL-PRINCIPAL.md`.

## 47. Isolamento do modelo e contraste de Grupos — Fase 165

Uma home institucional não é fallback visual Racon: o renderer Racon exige
`codigo=racon_inspired`. Entitlements continuam explícitos e fechados por padrão.
O vínculo legado Gauchinho com menus vazios foi reconciliado explicitamente com
seu próprio catálogo, sem trocar modelo ou alterar dados operacionais. O script
de reparação é idempotente, restrito e executado somente por operador autorizado.

Estilos de seleção e controles de Grupos são isolados pelo modelo Racon. A geração
de links resumidos/detalhados reutiliza o fluxo existente e verifica empresa ativa
e permissão canônica tanto na página quanto na API; visibilidade do botão não
concede acesso. Relatório:
`docs/relatorios-fases/FASE-165-RESTAURACAO-GAUCHINHO-CONTRASTE-GRUPOS.md`.

## 48. Modelos independentes, marca própria e contatos — Fase 166

Modelos derivados preservam a família de renderização pela relação canônica
`site_modelos.modelo_origem_id`, nunca por nome, slug ou prefixo. A resolução é
limitada e falha fechada diante de ciclo/origem ausente. Conteúdo, status,
publicação e vínculo da cópia continuam independentes.

Contatos públicos possuem precedência: `empresa_branding` da empresa, padrão
opcional em `site_modelos.identidade_visual.contatos`, ou ausência. Números de
exemplo não são fallback. Cópias destinadas a marca própria removem identidade
e campanhas da origem na própria edição antes do salvamento; o original é
imutável nessa operação.

Relatório: `docs/relatorios-fases/FASE-166-MODELOS-MARCA-PROPRIA-E-CONTATOS.md`.

## 49. Cadastro idempotente de Grupo no ERP — Fase 167

Novo grupo local é identificado por empresa, administradora, tipo e código
normalizado. O cliente bloqueia reenvio enquanto a operação está pendente; a
ação usa chave determinística, detecta registro anterior e sempre navega para o
resultado. A proteção definitiva no banco serializa a chave natural com
advisory transaction lock antes do insert, preservando o modelo N:N de tenant.

Relatório: `docs/relatorios-fases/FASE-167-IDEMPOTENCIA-CADASTRO-GRUPO-ERP.md`.

## 50. Aprovação resiliente e consolidação de grupos — Fase 168

A aprovação de grupo local pode reaplicar seus campos cadastrais antes da
promoção global. O gatilho de unicidade lógica valida apenas inserts ou mudança
real da chave natural `(empresa, administradora, código normalizado)`; atribuição
idempotente não constitui novo cadastro. Novas duplicidades continuam bloqueadas
com lock transacional.

Reparos de dados repetidos exigem lote previamente auditado, igualdade de
payload e ausência de qualquer uso comercial. A limpeza é transacional,
idempotente e preserva o registro mais antigo. A decisão de aprovação permanece
uma ação explícita do Platform Superadmin e a interface bloqueia reenvios.

Relatório: `docs/relatorios-fases/FASE-168-APROVACAO-E-CONSOLIDACAO-GRUPOS.md`.

## 51. Listagens dinâmicas e sem repetição — Fase 169

As páginas de catálogo e aprovação de grupos da Platform são sempre dinâmicas.
Como proteção de apresentação, o catálogo renderiza uma linha por chave natural
`(administradora, código normalizado)` e prefere a versão global; solicitações
renderizam uma linha por grupo, sem combinar empresas ou administradoras.

Essa camada não substitui a unicidade transacional do banco e não apaga dados.
Ela impede que estado de navegação anterior ou respostas expandidas exibam uma
entidade repetidamente após uma consolidação operacional.

Relatório: `docs/relatorios-fases/FASE-169-LISTAGEM-GRUPOS-SEM-REPETICAO.md`.

## 52. Programa de comissão exclusivo para importação histórica — Fase 170

Programas usados para recompor carteira antiga podem ser marcados em
`comissao_programas.uso_exclusivo_importacao_legado`. Nesse estado eles ficam
inativos e não homologados no motor canônico de novas vendas, mas continuam
disponíveis no importador histórico. A separação permite representar condições
contratuais antigas que se sobrepõem temporalmente a outro programa sem criar
ambiguidade para vendas novas.

A Platform Superadmin controla essa finalidade por RPC auditada. Um gatilho
impede a ativação acidental do programa exclusivo. O importador identifica e
prioriza essas regras e valida a data de cada contrato contra a vigência
selecionada antes de confirmar o lote. A importação preserva seus snapshots e
continua sem afetar o faturamento da empresa.

Relatório:
`docs/relatorios-fases/FASE-170-PROGRAMA-COMISSAO-IMPORTACAO-HISTORICA.md`.

## 53. Portais de parceiros com ERP compartilhado — Fase 171

Novos parceiros utilizam `parceiro_sites` e `parceiro_site_dominios` como
portais comerciais subordinados à empresa/franquia. O host resolve no servidor
`empresa_id`, `parceiro_site_id` e `organizacao_parceira_id`; o navegador não
informa esses identificadores como autoridade.

O portal parceiro não cria um segundo ERP nem duplica empresa: leads e
indicações públicos entram no ERP da franquia, com origem do site e organização
gravadas nas colunas canônicas já existentes. A área do parceiro continua
restringindo a consulta à própria organização. Sites e dados anteriores não
são migrados nem reinterpretados.

Quando houver ERP próprio, a unidade deve ser cadastrada como nova Master
Franquia, com empresa, usuários N:N, domínio e publicação próprios; um site de
parceiro permanece necessariamente no modo compartilhado.

Relatório:
`docs/relatorios-fases/FASE-171-PORTAIS-PARCEIROS-ERP-COMPARTILHADO.md`.

## 54. Agenda comercial tenant-aware e operação da equipe — Fase 172

Compromissos, disponibilidade e bloqueios da Agenda carregam `empresa_id`
obrigatório. O backfill deriva o tenant pelo lead ou por vínculo único ativo,
sem fallback fixo para a Gauchinho, e falha fechado diante de qualquer origem
ambígua. Lead e responsável são validados contra a mesma empresa.

A visão da equipe depende de `empresa_usuarios.agenda_acesso_todos` ou papel de
gestão. Consultores sem essa autorização operam somente compromissos próprios.
A conclusão usa RPC transacional com lock, atualiza lead e compromisso na mesma
transação e registra auditoria central. A interface oferece filtros por
responsável e status, seleção legível de lead, conflito de horários e registro
de não comparecimento.

As migrations 162–164 foram aplicadas no Supabase principal em 31/08/2026; os
24 compromissos existentes, cinco disponibilidades, três metadados e quatro
bloqueios foram preservados com tenant definido. Laura recebeu visão da equipe
no vínculo da Gauchinho. As pontes 163/164 mantêm compatibilidade durante a
troca da aplicação.

Relatório:
`docs/relatorios-fases/FASE-172-AGENDA-COMERCIAL-TENANT-UX-PERMISSOES.md`.

## 55. Vendas mensais e imposto em lote — Fase 173

Minhas comissões apresenta dois indicadores adicionais de produção no mês:
crédito total vendido e quantidade de cotas. Os fatos vêm de `vendas` e
`venda_participantes`, com tenant/participante resolvidos no servidor, paginação
e deduplicação por venda. Somente vendas confirmadas que afetam faturamento
participam; crédito já totalizado não é multiplicado novamente pelas cotas.

A aplicação fiscal em lote é uma operação administrativa explícita com prévia
e confirmação. A migration 170 instala a RPC sem alterar registros existentes.
Ela aplica a alíquota cadastrada selecionada às previsões sem movimentação,
incluindo importações históricas, preservando integralmente vendas que já
possuam movimentos financeiros ou origem fiscal não identificável. Registra
bruto original e líquido em snapshot e auditoria, sem desconto cumulativo,
sem alterar regras comerciais, caixa, pagamentos ou recebimentos.

O extrato lê também os snapshots fiscais próprios das importações e do lote,
sem depender exclusivamente do vínculo com uma previsão da franquia. A
operação exige sessão autenticada e administração da empresa; tenant e acesso
à rota são novamente validados na Server Action.

Relatório:
`docs/relatorios-fases/FASE-173-MINHAS-COMISSOES-VENDAS-E-IMPOSTO-LOTE.md`.

## 56. Cronograma próprio nas regras de comissão por perfil — Fase 174

Regras de participante podem optar explicitamente por não seguir o cronograma
da franqueadora. Nesse caso, o ERP persiste `etapas_cronograma` com meses
positivos e distintos e distribuição que fecha exatamente 100% do percentual
ou o valor fixo total. O formulário preserva as etapas ao editar e oferece
distribuição uniforme sem substituir silenciosamente a configuração por parcela
única.

A migration 171 mantém regras anteriores no caminho compatível e só reconstrói
previsões de perfil quando a nova escolha de cronograma próprio ou base fiscal
bruta for explícita. O cálculo congela base, imposto, regra e etapas no snapshot,
preserva o resíduo monetário na última parcela e não recalcula fatos históricos.
Previsões já elegíveis ou pagas não podem ser substituídas.

Relatório:
`docs/relatorios-fases/ERP-PERFIS-CRONOGRAMA-PROPRIO-CADASTRO.md`.

## 57. Agenda coletiva, dia todo e Google bidirecional — Fase 175

Compromissos podem ser individuais ou registrar, atomicamente, o snapshot de
todos os membros ativos com acesso à Agenda. Participantes leem o evento
coletivo; somente o responsável ou operadores autorizados a ver a equipe podem
alterá-lo. Conflitos incluem todos os participantes e são serializados no banco.

Data e hora civil são convertidas explicitamente no fuso `America/Cuiaba`, sem
depender do fuso do processo da aplicação. A interface oferece Dia todo e
duração separada em horas/minutos. Eventos sem lead possuem conclusão simples e
auditada; atendimentos preservam o fechamento comercial existente.

A integração Google usa um evento por participante, retry idempotente e vínculo
com a conta conectada. A importação Google → sistema é opt-in, tenant-aware e
preserva a origem: evento criado no Google é editado no Google; evento criado no
sistema é editado no sistema. Eventos privados não transferem detalhes. O job
usa paginação, `syncToken`, consentimento revalidado e segredo próprio.

Nenhum compromisso histórico é recalculado ou removido. Relatório:
`docs/relatorios-fases/FASE-175-AGENDA-EQUIPE-DIA-TODO-GOOGLE-BIDIRECIONAL.md`.









