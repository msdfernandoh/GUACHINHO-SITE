# ARQUITETURA MASTER SAAS MULTIEMPRESA — GAUCHINHO SITE

> **Versão da Arquitetura:** 5.7.0 (ERP Clientes em Preview)
> **Data de Atualização:** 11/08/2026
> **Status Geral do Projeto:** **PRODUÇÃO RECONCILIADA ATÉ A MIGRATION 069; PLATFORM HOST, ERP OPERACIONAL, FLUXO PROPOSTA → CONTRATAÇÃO E ASSEMBLEIAS/PEDRAS ATIVOS. A MIGRATION 070 EXISTE SOMENTE NO SUPABASE ISOLADO E NO PREVIEW DA BRANCH PLATFORM.**
> **Macroblocos A–F e evoluções 057–069:** implantados em Produção. As migrations `060–063` preservam o motor canônico financeiro; `064–066` concluíram retenção, storage e auditoria; `067–069` entregaram ERP configurável, fluxo final de contratação e Assembleias/Pedras.
> **Infraestrutura em Produção:**  
> - **Vercel Production atual:** deployment `dpl_9rwcRpVjKyhg7K4Si1FBRrcGHSvM`, estado `READY`, associado a `gauchinhoconsorcios.com.br`, `www.gauchinhoconsorcios.com.br` e `admin.gauchinhoconsorcios.com.br` na reconciliação de 11/08/2026.
> - **Supabase principal:** projeto `eaeuoynprurmmulzhydt`, com estado de Produção documentado até `069`. A reconciliação runtime confirmou as estruturas de `068` e `069` e confirmou que a tabela inicial de `070` não existe no banco principal. O `migration list --linked` e o `db push --linked --dry-run` foram tentados novamente, mas a senha de banco vinculada nesta estação foi rejeitada pelo pooler; nenhuma migration foi aplicada.
> - **Branch Platform:** `codex/plataforma-saas-master-ux-governanca` em `88764f5`, quatro commits à frente de `origin/main` (`52e0655`). A migration `070` permanece somente no Supabase isolado associado ao Preview.
> - **Suíte reproduzida na branch Platform:** `701 PASS / 37 SKIP`; TypeScript, build de 122 rotas, lint Platform e `npm audit --omit=dev` aprovados.
> - **Segurança & Multi-Tenant:** RLS ativo em 27 tabelas críticas, Empresa B com 0 dados/concessões, Host Resolution e RBAC formalizado em `SAAS-PERMISSIONS-MATRIX.md`.  
> - **Platform Host:** `admin.gauchinhoconsorcios.com.br` está ativo no deployment Production atual, resolve contexto `PLATFORM` antes de qualquer tenant e exige `is_platform_superadmin()`. O smoke anônimo retornou `307` para o login Platform e `/login` retornou `200`.

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

### Plataforma SaaS Master (Migration 070 — Preview)
- o contexto global passa a usar shell próprio em `/platform`, sem herdar menu,
  identidade ou operação tenant da Gauchinho;
- o host Platform autoriza somente login e `/platform`, sempre pelo RPC
  `is_platform_superadmin()`;
- a migration 070 modela templates, catálogo ERP, planos, assinaturas,
  entitlements/overrides, configurações e auditoria Platform, sem preços
  presumidos, billing real ou integração com o runtime tenant;
- detalhes e homologação: `docs/relatorios-fases/PLATAFORMA-SAAS-MASTER-UX-GOVERNANCA.md`.
- estado operacional: aplicada somente no Supabase isolado do Preview
  `dpl_E9ZJZQW5a6SzzGPA8QbmCQYc6SnA`; não aplicada em Produção e não mesclada
  em `main`. A homologação visual autenticada permanece pendente porque o
  navegador disponível não possuía sessão legítima da Vercel/Plataforma.

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
| Plataforma SaaS Master | `codex/plataforma-saas-master-ux-governanca` | 070 | PREVIEW; VISUAL AUTENTICADO PENDENTE | Supabase isolado + `dpl_E9ZJZQW5a6SzzGPA8QbmCQYc6SnA` |

---

### ERP Clientes operacional (Migration 071 — Preview)
- `clientes` é a identidade cadastral atual, tenant-aware e distinta de lead, proposta, contratação, venda e cota;
- a criação automática ocorre somente quando `contratacoes_online.contrato_assinado = true`; CPF/CNPJ normalizado é a identidade idempotente por empresa, sem deduplicar pessoas por nome ou telefone;
- documentos permanecem em `contratacoes_documentos` e no bucket privado existente; as cotas reais são sempre lidas de `cotas_definitivas` por meio de venda;
- o botão Nova Cota apenas inicia o fluxo comercial canônico, sem criar venda ou cota diretamente e sem alterar 060–063;
- `071_erp_clientes_operacional.sql` é forward-only, tem RLS explícita e não executa backfill histórico. O backfill dependerá de relatório e autorização expressa.
- relatório: `docs/relatorios-fases/ERP-CLIENTES-OPERACIONAL.md`.

## 5. Declaração Final de Segurança e Riscos

* O P0 das APIs, o hardening `057–059`, o motor canônico `060–063` e o fechamento técnico `064–066` estão implantados no Supabase principal.
* O estado funcional de Produção inclui ERP configurável (`067`), fluxo Proposta → Contratação (`068`) e ERP operacional com Assembleias/Pedras (`069`). Sorteios promocionais continuam independentes e preservados.
* `admin.gauchinhoconsorcios.com.br` está ativo, verificado e associado ao deployment Production atual `dpl_9rwcRpVjKyhg7K4Si1FBRrcGHSvM`; ele não é tenant e não possui fallback para Gauchinho.
* A migration `070` não está em Produção. O endpoint REST da tabela inicial `site_modelos` retornou `404` no Supabase principal, enquanto as estruturas de `068` e `069` responderam `200`.
* A Gauchinho permanece com ERP habilitado e a Empresa B permanece sem concessão de administradora. Nenhum tenant Sorriso foi criado.
* A única homologação aberta nesta rodada é a revisão visual autenticada da Plataforma SaaS Master no Preview. Sem sessão legítima disponível, nenhum PASS visual foi presumido.
* Evidências consolidadas: `docs/relatorios-fases/HOTFIX-CODEX-POS-AUDITORIA.md`, `docs/relatorios-fases/HARDENING-RLS-CODEX-POS-HOTFIX.md`, `docs/relatorios-fases/CODEX-COMISSOES-FINANCEIRO-TRANSACIONAL.md`, `docs/relatorios-fases/ERP-OPERACIONAL-LEGADO-SUPERADO.md`, `docs/relatorios-fases/CORRECAO-FLUXO-PROPOSTA-CONTRATACAO.md` e `docs/relatorios-fases/PLATAFORMA-SAAS-MASTER-UX-GOVERNANCA.md`.
