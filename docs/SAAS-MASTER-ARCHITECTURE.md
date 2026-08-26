# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> [!IMPORTANT]
> **ESTADO-ALVO E CORREÇÕES OBRIGATÓRIAS**
> Antes de alterar tenancy, usuários, catálogo, sites, comissões, financeiro, Storage, RPCs ou migrations, leia também integralmente [`SAAS-ARQUITETURA-ALVO-E-PLANO-DE-CORRECAO.md`](./SAAS-ARQUITETURA-ALVO-E-PLANO-DE-CORRECAO.md). O documento descreve o estado-alvo e o plano de remediação; seus itens não devem ser interpretados como já implantados sem evidência no banco e no código.

> **Versão da Arquitetura:** 6.0.0
> **Data de Atualização:** 26/08/2026
> **Production code:** `main@c3ba7ae53d86ba30fa5d547e94595aeac9409d6b`; Supabase principal `eaeuoynprurmmulzhydt` com as migrations `126–127` de hardening e formalização canônica promovidas.
> **Preview/isolado desta fase:** a branch `bwwgbmiwtrglbtxsdooi` permanece preservada como evidência de homologação da 083 até autorização separada de exclusão.
> **Fase atual:** consolidação multi-tenant e formalização canônica de vendas/comissões concluída pelas migrations `126–127`, sem perda nem recálculo dos registros financeiros existentes.
> **Vercel Production:** deployment `7zVp4KAh1MNtCDqd81QktSWzBxF4` está `READY`, associado à `main` e aos domínios oficiais.
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

* O estado funcional do Supabase Production inclui migrations `001–101`.
* `admin.gauchinhoconsorcios.com.br` está ativo, verificado e associado ao deployment Production da `main`; ele não é tenant e não possui fallback para Gauchinho.
* As migrations `070–101` estão versionadas e aplicadas em Produção; correções futuras permanecem obrigatoriamente forward-only.
* Evidências consolidadas: `docs/relatorios-fases/PLATFORM-GRUPOS-CATALOGO-085.md`, `docs/relatorios-fases/PLATFORM-GRUPOS-TEMPORAL-HERANCA-086.md`, `docs/relatorios-fases/PLATFORM-PROGRAMAS-REGRAS-EDITOR-087.md`, `docs/relatorios-fases/fase-088-platform-templates-dominios-onboarding.md`, `docs/relatorios-fases/fase-089-platform-planos-assinaturas-limits.md`, `docs/relatorios-fases/fase-091-platform-template-racon-inspired-v2.md`, `docs/relatorios-fases/fase-092-platform-planos-quotas-overrides.md`, `docs/relatorios-fases/fase-093-platform-master-franquias-hub.md`, `docs/relatorios-fases/fase-094-platform-usuarios-governanca.md`, `docs/relatorios-fases/fase-095-platform-overrides-gestao-operacional.md` e `docs/relatorios-fases/ERP-FINANCEIRO-GOVERNANCA-CONTAS.md`.

## 6. Consolidação para escala — Migrations 126–127

Em 26/08/2026 foi concluído o hardening necessário para expansão multiempresa. O contrato comercial da formalização separa definitivamente `grupo_id`, `grupo_cota_id`, `administradora_modalidade_id`, valor da parcela da modalidade e prazo restante na data da venda. Vendas e cotas definitivas congelam os UUIDs e o snapshot temporal; grupos em andamento não reutilizam o prazo original como saldo restante.

O tenant operacional é resolvido pelo domínio e pelo vínculo N:N exato. O acesso público operacional depende de `empresas.configuracoes.site_publico.operacional_habilitado`, sem exceção de autorização por slug ou UUID. Imobiliárias, imóveis, simulações, eventos de analytics e integrações passam a carregar empresa; usuários imobiliários recebem vínculo por empresa em `empresa_usuarios.imobiliaria_id`.

As migrations locais que antes usavam os números `102–105` foram supersedidas para evitar colisão com a linha oficial da `main`, já avançada até a `125`. A sequência final é `126_hardening_multitenant_escala_franquias.sql` seguida de `127_formalizacao_canonica_e_comissoes_estritas.sql`.

O diagnóstico de Production confirmou o conversor antigo usando `grupos_cotas.valor_parcela`. A `127` elimina essa fonte, exige valor em `grupo_cota_modalidade_valores` e remove defaults implícitos de comissão. As duas migrations compilaram conjuntamente no Supabase Production dentro de transação encerrada por `ROLLBACK` e, depois, foram aplicadas em ordem e verificadas. O pós-check confirmou zero fatos sem empresa, RPCs estritas, acesso anônimo negado e preservação de 4 vendas, 23 previsões da franquia e 23 previsões de participantes. Relatório: `docs/relatorios-fases/FASE-126-127-CONSOLIDACAO-PRODUCAO-FORMALIZACAO-COMISSOES.md`.









