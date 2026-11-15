# Microfranquia: equipe e importação de indicações — 15/11/2026

## Estrutura e acesso
Reutiliza participantes_comerciais.gestor_participante_id para a hierarquia direta, sempre junto ao empresa_id. Não altera a arquitetura N:N empresa_usuarios. Acesso ao painel de equipe exige participante ativo com tipo MICROFRANQUIA, perfil comercial ativo de MICROFRANQUIA ou modelo MICROFRANQUEADO aprovado. Solicitação em análise não concede gestão. O app e a simulação reconhecem microfranquias legadas pelo perfil ativo.

## Cadastro e convite
Minha equipe permite criar colaborador com nome, CPF válido, telefone, e-mail/usuário, senha, perfil e PIX. Os perfis são Gerador de Negócios e Gerador de Oportunidades; este último mantém o código legado GERADOR_POSSIBILIDADES no app. A vinculação financeira utiliza o perfil ativo e único da própria empresa com o nome correspondente; ausência/ambiguidade bloqueia o cadastro sem inventar regras. Usuário de acesso é CPF ou e-mail.

Cadastro cria Auth, usuário, participante, vínculo N:N, tipos comerciais, indicador e perfil. Permissões de ERP vazias por padrão. CPF/e-mail existentes não são adotados nem têm senha alterada. Falhas acionam compensação somente das identidades desta tentativa. O convite público /parceiros/equipe/[codigo] reutiliza o código aleatório existente do titular e revalida microfranquia ativa/aprovada no tenant confiável do host, com rate limit. A API autenticada ignora IDs de microfranquia/empresa enviados pelo cliente. Nenhuma mensagem é enviada automaticamente.

## Resultados
Painel paginado carrega somente colaboradores diretos do gestor e da empresa ativa. Mostra perfil, contato, PIX, status, quantidade de indicações e vendas, crédito vendido, comissões previstas e valores pagos. Vendas canceladas não entram no volume vendido; previsões canceladas não entram nas comissões. Sem alteração de comissão histórica nem distribuição financeira automática entre gestor e colaborador.

## Importação
Nova indicação > Importar planilha aceita XLS e XLSX, com modelos reais para download em public/modelos. Cinco colunas: nome do cliente, telefone, email, valor do imóvel e nome do imóvel. E-mail opcional; os demais dados obrigatórios. Leitura da primeira aba, limite de 2 MB/500 contatos, rejeição de fórmulas e de excesso de linhas sem truncamento silencioso. Prévia indica erros e duplicidades do arquivo; confirmação envia lotes de até 25 linhas, revalidados no servidor. Telefone já existente no CRM do tenant é preservado e informado no resultado. Novos leads passam pelo upsert canônico e recebem o indicador autenticado, sem aceitar identidade de titular do navegador. Falhas por linha são exibidas; vínculo incompleto é informado para revisão. Nome e valor do imóvel ficam no snapshot dados_simulacao e nas observações, sem inventar crédito desejado ou capacidade mensal.

SheetJS CE 0.20.3 fixado pelo tarball oficial e lockfile para compatibilidade XLS binário e XLSX. Modelos construídos com runtime de planilhas, conferidos visualmente e lidos de volta nos dois formatos. /modelos preservado no roteamento de domínios parceiros. Sem migration.

## Validação
56 testes direcionados aprovados, incluindo XLS/XLSX reais, fórmulas, limites, telefone repetido, autoridade da microfranquia, tenant do convite, permissões de cadastro, perfis ausentes e preservação de contato existente. TypeScript aprovado, lint direcionado sem erros. Build de produção Webpack aprovado (185 páginas). Formulário conferido no Chromium em 390 px e 1280 px, sem corte horizontal e com cores legíveis. Aviso preexistente de unpdf não bloqueou a compilação. Nenhum colaborador, senha ou indicação operacional foi criado para teste. Homologação autenticada do cadastro real depende dos dados do titular; não foram inseridos registros fictícios em produção.
