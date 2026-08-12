# Plataforma SaaS Master — UX e Governança

## Escopo

Primeira rodada executada exclusivamente na branch
`codex/plataforma-saas-master-ux-governanca`, Supabase isolado e Preview. Nenhuma
migration desta rodada foi aplicada no projeto principal e não houve merge em
`main` nem deploy Production.

## Arquitetura Platform

- `admin.gauchinhoconsorcios.com.br` continua sendo `PLATFORM_HOST`, sem
  `empresa_id` e sem registro em `empresa_dominios`;
- o host aceita somente login e rotas `/platform`; rotas operacionais `/admin`
  são indisponíveis mesmo para Superadmin nesse contexto;
- todo layout `/platform` revalida `is_platform_superadmin()` no servidor;
- `admin_empresa`, gestor, consultor e visualizador permanecem bloqueados;
- o shell é neutro, separado do Portal e do ERP Gauchinho, com sidebar própria,
  header, conteúdo responsivo e claro/escuro persistido localmente.

## Navegação

Dashboard; Master Franquias; Usuários/Responsáveis; Domínios; Administradoras;
Grupos; Cotas/Produtos; Sites/Portais; Modelos; Catálogo ERP; Liberações e
overrides; Planos; Assinaturas; Auditoria; Configurações.

## Reuso canônico

- empresas, empresa_usuarios e empresa_dominios;
- administradoras e empresa_administradoras;
- grupos_consorcio e grupos_cotas (produto global), sem confundir com
  cotas_definitivas (operação tenant);
- empresa_branding e configuração ERP em empresas.configuracoes;
- RPC `is_platform_superadmin()` e autenticação atual.

## Migration 070

Acrescenta somente governança não existente: modelos de site e atribuição à
empresa, catálogo global ERP, planos, relação plano/módulo, assinaturas SaaS,
overrides explícitos, configurações e auditoria Platform. As tabelas são
Platform-only por RLS. Preços ficam NULL; PLANO 1–3 nascem como RASCUNHO. Apenas
`gauchinho_default` é registrado e associado à Gauchinho como representação do
runtime atual; nenhum template Racon ou tenant Sorriso é criado.

O modelo não é consumido pelo runtime tenant nesta rodada, evitando alteração
visual da Gauchinho. Também não há billing, cobrança, publicação externa,
impersonação ou atualização de software por banco.

## Onboarding

Nova Master Franquia cria somente empresa inativa `em_treinamento`. Usuários,
plano, taxa/mensalidade, administradoras, template, domínio, recursos, ERP e
publicação permanecem gates explícitos e auditáveis.

## Validação

- testes: 700 PASS / 37 SKIP;
- TypeScript: PASS;
- build: PASS, 122 rotas;
- npm audit `--omit=dev`: zero vulnerabilidades;
- lint do escopo Platform: PASS, zero warnings;
- migration 070: aplicada somente no Supabase isolado
  `dtgzujsktggllybnpbpj`;
- teste SQL transacional: planos sem preços, Empresa B sem concessões, nenhum
  template Racon, catálogo ERP sem Administradoras, RLS e auditoria: PASS;
- ROLLBACK: zero fixture residual;
- Preview: `dpl_E9ZJZQW5a6SzzGPA8QbmCQYc6SnA`, READY;
- alias Preview: `guachinho-site-git-codex-plataforma-6b8dae-hugo-8097s-projects.vercel.app`;
- anônimo em `/platform`: redirecionado ao login Platform;
- login Platform neutro: confirmado;
- `/admin/empresas` no host Platform: não expõe o painel tenant e exige a
  fronteira de autenticação;
- homologação visual interna autenticada: pendente porque a proteção Vercel
  exige sessão da equipe e não havia sessão legítima disponível. Nenhum PASS
  autenticado foi presumido.

## Estado de promoção

Branch publicada em `origin/codex/plataforma-saas-master-ux-governanca`.
`main`, Supabase principal e Vercel Production permaneceram inalterados.

## Reconciliação operacional e tentativa de homologação autenticada

Reconciliação executada em 11/08/2026 antes de retomar a revisão visual:

- `git fetch` confirmou `origin/main` em `52e0655` e a branch Platform em
  `88764f5`, quatro commits à frente;
- o deployment Production atualmente associado aos três domínios canônicos é
  `dpl_9rwcRpVjKyhg7K4Si1FBRrcGHSvM`, estado `READY`;
- `admin.gauchinhoconsorcios.com.br` respondeu `307` para o login Platform e
  `/login` respondeu `200`; o site tenant respondeu `200`, `/erp` redirecionou
  o anônimo ao login e a API pública de sorteios respondeu `200`;
- no Supabase principal, `propostas_documentos` (`068`) e
  `erp_assembleias_grupo` (`069`) responderam `200`, enquanto `site_modelos`
  (`070`) respondeu `404`, confirmando que a migration de governança Platform
  não foi aplicada em Produção;
- a Gauchinho segue com ERP habilitado e a Empresa B segue com zero concessões
  de administradora;
- `supabase migration list --linked` e `supabase db push --linked --dry-run`
  foram executados, mas a senha vinculada nesta estação foi rejeitada pelo
  pooler. Os comandos pararam na autenticação e nenhuma migration foi aplicada.

O navegador interno abriu o Preview e foi redirecionado pela proteção Vercel
para `Log in to Vercel`. Não havia sessão legítima disponível. Nenhuma
credencial foi inserida e nenhum PASS autenticado foi presumido. Permanecem
pendentes para revisão do proprietário: Dashboard, claro/escuro e persistência,
sidebar Platform, todas as seções de governança e a visão central da Gauchinho.

Esta tentativa não alterou `main`, Supabase principal, aliases ou deployment
Production. A migration `070` permanece somente no ambiente isolado do Preview.

## Homologação visual autenticada — 12/08/2026

Uma sessão legítima de `PLATFORM_SUPERADMIN` foi usada no Preview da branch
`codex/plataforma-saas-master-ux-governanca` (`88764f5`). A fronteira Platform
foi confirmada: o usuário autenticado abriu `/platform`, o cabeçalho exibiu
`Contexto global / PLATFORM` e a sidebar não expôs módulos operacionais do
tenant (Leads, Agenda, Propostas, Contratações, Financeiro ERP ou Sorteios).

### Aprovado visualmente

- Shell visual próprio, neutro e separado do Portal/ERP Gauchinho, com sidebar,
  header e cards de governança;
- Dashboard com números reais de empresas, ERP, administradoras, sites, planos
  e assinaturas, sem métricas inventadas;
- alternância claro/escuro confirmada visualmente e por recarga: o estado
  `dark` foi removido ao alternar para claro e permaneceu removido após reload;
- Master Franquias listou Gauchinho e Empresa B; a visão da Gauchinho confirmou
  status ativo, domínio principal, uma administradora concedida, site publicado,
  ERP ativo, módulos concedidos, zero overrides e ausência de assinatura;
- Administradoras, Grupos e Produtos deixam explícito que o catálogo é global e
  que `grupos_cotas` representa opções comerciais, nunca cotas definitivas;
- Sites/Portais, Modelos, catálogo ERP, overrides, Planos, Assinaturas,
  Auditoria e Configurações foram abertos pela navegação Platform;
- Empresa B permaneceu em treinamento e com zero concessões de administradora.

### Achado bloqueador para promoção

O Preview autenticado está consultando o banco sem a migration `070`: as telas
de Produtos, Modelos, Catálogo ERP, Liberações/Overrides, Planos, Assinaturas,
Auditoria e Configurações exibiram `Estrutura disponível após migration 070 no
ambiente isolado` e `Nenhum registro real disponível`. Isto contradiz a
expectativa de Preview conectado ao Supabase isolado que recebeu `070` e impede
a validação funcional dos dados de governança (incluindo PLANO 1–3, catálogo ERP
e template `gauchinho_default`). Nenhuma correção foi aplicada nesta rodada.

### Melhorias de UX registradas

- Master Franquias, Usuários, Domínios, Grupos e Sites exibem UUIDs, JSON bruto
  e campos técnicos como colunas principais; a central precisa de colunas de
  negócio, badges e detalhes progressivos;
- a tabela Master Franquias tem overflow horizontal perceptível no viewport de
  homologação; recomenda-se resumo por card ou ocultação responsiva de IDs;
- os nomes `Cotas / Produtos` e `Assinaturas / Contratações` funcionam, mas
  podem ser refinados para `Produtos comerciais` e `Assinaturas SaaS` para evitar
  qualquer associação com cota definitiva ou contratação do tenant.

Não houve migration em Produção, merge, deploy Production, criação de Sorriso
ou alteração de Portal/ERP Gauchinho.

## Correção de Preview e refinamento UX — pendência de credencial isolada

Foi auditado o runtime e a configuração Vercel da branch Platform. O aplicativo
consome exatamente `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
e `SUPABASE_SERVICE_ROLE_KEY`; `SUPABASE_URL` não é consumida pelo runtime
Platform atual. A Vercel possui override Preview para `PLATFORM_HOST`, mas não
possui os três overrides Supabase para
`codex/plataforma-saas-master-ux-governanca`. Por herança, o Preview recebe as
variáveis Preview globais do projeto principal e consulta Produção.

O endpoint do ref isolado `dtgzujsktggllybnpbpj` respondeu à rede, mas rejeitou
em `401` tanto a anon key quanto a service role do projeto principal. Portanto,
as chaves do isolado são distintas e não foram inferidas/reutilizadas. O ref
também não apareceu na lista de projetos ativos da organização Supabase; ele
precisa ser recuperado pela integração/branch Supabase que o criou ou por suas
credenciais próprias antes de configurar a Vercel. Nenhuma variável foi criada,
alterada ou removida.

Refinamentos implementados apenas na branch local, ainda sem novo Preview:

- sidebar e headings renomeados para `Produtos comerciais` e `Assinaturas SaaS`;
- consultas de listagem preparadas para usar empresa, administradora, grupo,
  plano e usuário por seus nomes de negócio, sem IDs como colunas principais;
- UUIDs e chaves de relacionamento foram removidos do resumo principal;
- configuração ERP JSON passa a ser resumida como estado e quantidade de
  módulos, em vez de dump técnico;
- a tabela principal recebeu limitação de largura por célula e colunas de
  negócio para reduzir o overflow horizontal.

Gates após os refinamentos: `npm test` **701 PASS / 37 SKIP**,
`npx tsc --noEmit` PASS, build PASS (122 rotas), lint Platform PASS e
`npm audit --omit=dev` com zero vulnerabilidades.

### Próxima ação necessária

Disponibilizar as três credenciais do projeto isolado ou reconectar o ref
`dtgzujsktggllybnpbpj` pela integração Supabase. Com isso, criar exclusivamente
os overrides Preview da branch Platform, gerar um novo deployment Preview e
reexecutar a homologação autenticada. Production continua sem `070`.

## Tentativa de recuperação oficial do Supabase isolado

A sessão autenticada percorreu a integração Supabase da equipe Vercel e a
organização Supabase vinculada. A integração lista somente o recurso
`Gauchinho-Site` de ref `eaeuoynprurmmulzhydt`; a organização exibe quatro
projetos ativos e não lista `dtgzujsktggllybnpbpj`. A página de branches do
projeto principal não disponibilizou a branch isolada para operação nesta
conexão.

O endpoint REST do ref isolado existe na rede, mas seus endpoints protegidos
rejeitam (`401`) as duas chaves do principal. Isso confirma que o isolado exige
credenciais próprias. Como a integração atual não fornece esse recurso nem
permite sincronizá-lo, a Vercel não recebeu overrides e não houve deployment
novo. Recuperar/reanexar a branch Supabase original é o único próximo passo
seguro; não foram criados banco, branch, variável ou credencial substituta.

Em 12/08/2026, com sessão Supabase autenticada, o ref isolado foi aberto
diretamente no Dashboard. Ele existe, mas apresenta `Compute: Unknown` e deixa
desabilitados Table Editor, SQL Editor, Database, Authentication, Storage,
API Keys, JWT Keys e Branching. Logo, não é possível ler/gerar suas três
credenciais nem validar as tabelas 070 a partir desse Dashboard. O bloqueador
não é de permissão da Vercel: é a indisponibilidade operacional da branch
Supabase isolada, que deve ser reativada/restaurada pelo provedor antes de
qualquer override Preview.

Com autorização explícita do proprietário, foi acionado `Restart branch` na
branch Preview `codex-erp-assembleias-069` (ref
`dtgzujsktggllybnpbpj`). Após a confirmação e duas verificações de recuperação,
o Dashboard permaneceu em `STATUS: Checking...` e `COMPUTE: Unknown`, com os
serviços de dados indisponíveis. Nenhuma credencial pôde ser recuperada e a
Vercel não recebeu alterações. O restart não impactou o projeto principal nem
Production; a continuidade depende de o Supabase concluir a recuperação ou de
intervenção do suporte da plataforma.

Em 12/08/2026, foi aberto e confirmado um chamado oficial ao suporte do
Supabase para o projeto `Gauchinho-Site`. O relato informa o ref isolado, o
estado `Checking...` / `Compute: Unknown`, a tentativa de `Restart branch` e
solicita restauração/reprovisionamento **sem afetar** o principal
`eaeuoynprurmmulzhydt`. Nenhum segredo foi incluído. A confirmação de envio
informa que o ticket foi registrado e será respondido em
`hugo@msdeducacao.com.br`.

## Alternativas descartáveis sem custo adicional (12/08/2026)

Antes de criar um projeto Micro adicional, foram verificadas as alternativas
sem custo e sem alteração do projeto Production:

- O projeto principal mantém Preview branches disponíveis para operação. A
  branch `codex-fluxo-proposta-068-data-v2`, ref
  `lakuvxsfxriltcyghupu`, está **Healthy**, com compute `micro` já alocado e
  histórico visível de migrations `001` a `068`.
- A mesma lista de branches também preserva os ambientes descartáveis
  `codex-fechamento-tecnico-064` e `codex-comissoes-financeiro-060-v2`; não
  há necessidade de criar uma branch ou projeto adicional para iniciar a
  homologação da Plataforma.
- A organização Free `leandro2026-7254's projects` não permite criar projeto:
  o painel informa falta de permissão de criação e mantém o botão desabilitado.
- Esta estação não possui Docker instalado e o wrapper npm atual do Supabase
  CLI não encontra binário `win32-x64`. Mesmo que o stack local fosse iniciado,
  ele não atenderia diretamente um Preview hospedado na Vercel sem túnel ou
  infraestrutura pública adicional.

Conclusão: o caminho correto sem custo é reutilizar exclusivamente a Preview
`lakuvxsfxriltcyghupu`, aplicar nela as migrations locais `069` e `070` com
histórico rastreável e então criar apenas os overrides Preview da branch
Platform. Nenhuma migration foi executada durante esta verificação e o
projeto principal permanece inalterado.

## Promoção autorizada — migration 070 no principal (12/08/2026)

Com autorização expressa do proprietário, a migration canônica
`070_plataforma_saas_master_governanca.sql` foi executada manualmente no
Supabase principal `eaeuoynprurmmulzhydt`. A leitura posterior confirmou as
nove estruturas Platform, `gauchinho_default` publicado e associado à
Gauchinho, 12 módulos canônicos de catálogo ERP e os três planos em
`RASCUNHO`, com mensalidade e taxa de implantação nulas. Empresa B permaneceu
sem concessão de administradora.

As tabelas Platform recusaram acesso anônimo (`401`), evidenciando a fronteira
de RLS. A auditoria posterior de ausência de Sorriso, modelo Racon e módulo
Administradoras foi reconciliada: os alertas iniciais resultaram de URLs REST
montadas incorretamente. Consultas corretas retornaram ausência de tenant
`sorriso`, ausência de qualquer modelo Racon e o catálogo ERP canônico sem
módulo Administradoras. Nenhum desses registros existiu ou foi alterado em
Production.
