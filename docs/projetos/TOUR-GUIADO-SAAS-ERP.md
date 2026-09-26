# Projeto — Demonstração comercial e treinamento guiado do SaaS e ERP

**Estado:** especificação para implementação

**Piloto interno:** Racon Sorriso (`sorriso`). **Entrega externa:** ambiente de demonstração próprio, ainda a provisionar.

**Data:** 26/09/2026

## 1. Objetivo comercial e educacional

Apresentar a uma nova franqueadora uma **operação integrada, do primeiro contato com o cliente ao controle financeiro**, e demonstrar como essa integração pode ajudar a organizar a gestão da unidade, reduzir oportunidades sem acompanhamento, padronizar a venda e dar visibilidade a receitas, comissões e despesas. O produto oferecido inclui **sistema + treinamento guiado para a equipe**, com conteúdo atualizado junto às telas.

O projeto tem duas experiências com o mesmo catálogo de conteúdo, mas públicos e objetivos diferentes:

1. **Antes do contrato — login demo único:** apresenta ao futuro dono da franquia a visão integrada do negócio. Um percurso executivo curto conta a história da prospecção à gestão; uma biblioteca de módulos permite explorar **tudo o que está realmente disponível na amostra**, com “o que entrega”, “o que controla”, “como usar” e “qual ganho operacional observar”. Itens restritos à Plataforma SaaS aparecem em apresentação explicativa, sem abrir a governança real.
2. **Depois do contrato — implantação guiada por perfil:** o dono da nova franquia faz primeiro a trilha de direção na própria master. Cada usuário da unidade recebe automaticamente a trilha correspondente ao seu papel e aos módulos efetivamente liberados: gestor, consultor, financeiro, parceiro ou indicador. Inclui microlições, ajuda por página e retomada individual do progresso.

O roteiro não deve prometer crescimento de vendas, redução de custos ou retorno financeiro em percentual sem medição. Na Racon Sorriso, os registros já usados no piloto são marcados `[DEMO]`; seus valores ilustram o fluxo e não representam resultados obtidos por uma unidade real. O ambiente de acesso externo terá somente dados fictícios próprios.

**Aceite comercial:** ao final, o futuro franqueado consegue explicar pelo menos três ganhos práticos da plataforma, reconhecer o caminho evento → check-in → lead → grupo → proposta → venda → comissão → caixa, localizar a gestão de parceiros, identificar como acompanha a unidade e saber que o treinamento da equipe faz parte da implantação. **Aceite de implantação:** o dono conclui a trilha executiva; cada função encontra apenas as lições de suas telas autorizadas e conclui tarefas seguras sem assistência.

## 2. Público e alcance

| Público | Valor que precisa enxergar | Experiência prevista |
| --- | --- | --- |
| Dono da franquia / decisor | Visibilidade da operação, padrão da unidade, indicadores, vendas e controle | Login demo único antes do contrato; depois, trilha executiva na própria master |
| Gestor da unidade | Distribuição de oportunidades, rotina da equipe e previsibilidade | Demonstração; depois, treinamento de gestão |
| Consultor comercial | Próxima ação clara, carteira, propostas e acompanhamento | Treinamento comercial conforme seu acesso |
| Responsável financeiro | Despesas, caixa, comissões e conciliação sem confundir previsão com pagamento | Treinamento financeiro conforme seu acesso |
| Superadministrador SaaS | Governança de masters, planos, módulos e concessões | Trilha própria em `/platform` |
| Revisor técnico | Arquitetura e leitura do sistema sem ações de edição | Orientação própria em `/platform/revisao` |
| Parceiro e indicador | Seu papel no fluxo de indicação e acompanhamento | Trilhas próprias nas respectivas áreas |

**Lançamento:** validar narrativa e conteúdo com a equipe na master Sorriso; entregar **um login demo compartilhado** somente depois de provisionar um tenant exclusivo de demonstração e provar que ele é incapaz de gravar ou consultar dados de outras masters. Após cada contrato, habilitar o guia na master da nova franquia de acordo com o plano, papel e permissões existentes. O componente e o catálogo serão reutilizáveis, sem nomes, IDs ou cores fixos da Sorriso.

### Acesso de demonstração para interessados

- Criar um **tenant de demonstração separado** das masters Gauchinho e Racon Sorriso, com domínio próprio, identidade demonstrativa e base exclusivamente fictícia. A Racon Sorriso continua como piloto interno; ser independente não a torna uma conta pública de demonstração. Nenhum dado da Gauchinho ou de parceiros pode ser copiado para a demo.
- Usar **uma única credencial demo compartilhável**, exclusiva deste tenant, divulgada pela equipe comercial. Ela pode ser trocada ou revogada sem afetar usuários reais; não é o login do Fernando nem de qualquer franqueado. Cada sessão começa com o tour disponível, sem mostrar o progresso de outra pessoa. O uso compartilhado impede atribuir comportamento a um interessado específico: o convite para conversa comercial deve pedir identificação voluntária em canal separado.
- Criar papel **visitante_demo**, limitado à leitura das telas e registros autorizados. Esconder botões de escrita ajuda a experiência, mas a proibição deve ser aplicada nas actions, APIs e RLS; bloquear criação, edição, exclusão, exportação, download sensível, mensagens, contratação e qualquer operação financeira. O tour não pode ampliar esse papel.
- Para demonstrar check-in e sorteio sem gravar dados ou enviar mensagens, usar **replay guiado com registros fictícios**. Se houver exercício interativo futuro, executá-lo somente em sandbox isolado, com reset e sem disparos externos. Resultado de sorteio na demo é simulado e não entrega prêmio real.
- Exibir selo persistente **Ambiente de demonstração — dados fictícios**. O progresso do login demo é **por sessão/navegador**, sem gravar avanço na linha compartilhada do usuário; uma pessoa não desloca o tour da outra. Bloquear também troca de senha e dados cadastrais pela credencial demo. Medir uso agregado sem atribuir ações a um interessado específico. A credencial pode ser renovada periodicamente ou revogada se for divulgada indevidamente.

### Dois níveis de apresentação, sem alterar o trabalho atual

| Nível | Para quem | Duração e conteúdo | Ação permitida |
| --- | --- | --- | --- |
| **Visão executiva** | Futuro dono usando o login demo | Percurso objetivo pelas 11 paradas; de evento e “Seja Parceiro” até CRM, grupos, propostas, vendas, comissões, caixa e indicadores. Cada parada mostra benefício, controle e prova fictícia. | Navegar, avançar, pular e abrir explicações. |
| **Explorar por área** | Mesmo futuro dono, após a visão executiva | Catálogo das áreas Comercial, Eventos, Parceiros, ERP, Financeiro, Gestão e Site; para cada tela: **para que serve → como fazer → que informação controla → que decisão apoia**. Links levam apenas a páginas autorizadas do tenant demo; ações de escrita aparecem por replay/explicação. | Visitar a amostra em ordem livre; nenhuma gravação operacional. |
| **Implantação da unidade** | Dono e equipe da master contratada | Trilha executiva inicial do dono e microlições por perfil nas páginas reais da própria unidade. O usuário pode voltar depois a “Ajuda desta página” e continuar a trilha. | Ações normais do sistema continuam condicionadas às permissões já concedidas ao usuário. |

O guia é uma **camada adicional de orientação**. Não altera cadastros, regras de comissão, dados, menus, planos, permissões ou fluxos de trabalho existentes. Apenas ancora explicações nas telas e registra progresso próprio. Onde o produto ainda não tem painel ou ligação comprovada, o catálogo informa isso claramente e explica a rotina atual.

### Implantação após o contrato

1. A equipe SaaS ativa o guia para a nova master junto ao plano e aos módulos contratados. A trilha do dono é sugerida no primeiro acesso do responsável principal; ele pode iniciar depois, pular e reiniciar.
2. O dono percorre **Direção e Gestão**: oportunidades, equipe, produção, propostas, vendas, comissões, caixa, relatórios e responsabilidades. Ao final recebe um mapa das rotinas de cada função e dos indicadores que deve acompanhar; não recebe permissão de superadministrador da Plataforma.
3. Quando usuários da unidade já possuem papéis e módulos, o guia apresenta a cada um sua trilha adequada: gestor (equipe e funil), consultor (lead e proposta), financeiro (contas e comissões), parceiro/indicador (indicação e acompanhamento). Perfil sozinho não libera tela; o guia confere vínculo, plano e permissão efetiva antes de mostrar cada passo.
4. O dono pode consultar **Progresso do treinamento da equipe** por função e conclusão, se tiver permissão de gestão. Esse painel acompanha aprendizado, sem revelar dados de clientes nem permitir mudar papéis; sua implementação pertence ao guia e ainda não existe no sistema atual.
5. Mudanças de função, plano ou acesso recalculam as lições visíveis. O histórico de conclusão permanece por usuário e master; não vira autorização para entrar em módulo negado.

## 3. História comercial da demonstração

**Mensagem central:** “Da oportunidade ao resultado, a franqueadora acompanha a operação em um só lugar e treina a equipe dentro do próprio sistema.” A ordem segue o trabalho real da unidade, não a ordem dos menus. Cada parada responde: **qual dificuldade existe? → o que a plataforma faz? → qual benefício isso permite acompanhar?**

| Parada | Tela real | Benefício explicado | Evidência na demonstração |
| --- | --- | --- | --- |
| 1. Cenário da unidade | `/admin` | O franqueado enxerga a operação sem juntar planilhas. | Painel e selo de dados fictícios |
| 2. Evento que gera oportunidades | Página publicada do evento e `/admin/eventos` | Evento e convite dão origem rastreável à prospecção local. | Evento fictício, convite/QR e origem configurada, sem inscrição real |
| 3. Check-in e engajamento | Formulário de check-in do evento e área de sorteio | Presença, respostas e participação em sorteio de prêmio criam uma experiência de captação; consentimento e regras do evento ficam visíveis. | Replay de check-in e sorteio fictícios; mostrar o código de participação e resultado simulado, sem prêmio real |
| 4. Lead e acompanhamento | `/admin/crm/pipeline` | O registro captado entra no funil com origem do evento, responsável, etapa e próxima ação. | Seguir o mesmo lead fictício; mostrar filtro por evento e pendências |
| 5. Cliente e grupos | `/erp/clientes` e `/erp/grupos` | A equipe conhece o perfil do cliente e consulta grupos, crédito, vagas e assembleia para selecionar alternativas. | Cliente e grupos fictícios; distinguir grupo de consórcio do sorteio promocional |
| 6. Proposta e negociação | `/erp/propostas` | Alternativas, valores e status de proposta ficam registrados para retomar e formalizar a negociação. | Proposta ligada ao cliente da história, sem envio nem contratação |
| 7. Venda e comissão | `/erp/vendas` e `/erp/comissoes` | A gestão diferencia proposta, venda, comissão prevista, recebida e paga. | Venda e comissão fictícias, fora de faturamento real |
| 8. Controle financeiro | `/erp/contas-pagar` e `/erp/financeiro` | Despesas e caixa mostram obrigações e pagamentos da unidade. | Contas fictícias pagas, saldo simulado explicado |
| 9. Rede de parceiros | `/parceiros`, `/erp/consultores` e `/erp/regras-comissao` | O programa permite captar pessoas que indicam negócios; o gestor vê o modelo solicitado, acompanha o cadastro e define o perfil de comissão efetivo. | Cadastro e participante fictícios; tour demonstra a revisão sem gravar mudança |
| 10. Gestão da rede | Painel ERP, relatórios e explicação da Plataforma | A direção acompanha oportunidades, produção, dinheiro e padrão de acesso por unidade. | Indicadores da demo; prospect não navega em governança privilegiada |
| 11. Treinamento e próximo passo | Encerramento e microlição de exemplo | Além do sistema, cada função recebe treinamento no contexto do trabalho. | “Explorar trilhas” e “Solicitar conversa comercial” somente por ação voluntária |

**Indicadores que podem ser mostrados quando disponíveis:** convidados, check-ins, leads por evento, participantes do sorteio, cadastros pelo “Seja Parceiro”, modelos solicitados, parceiros com primeira indicação, indicações, propostas e vendas atribuídas, tempo até o primeiro contato, leads sem próxima ação, avanço entre etapas do funil, propostas em andamento, vendas formalizadas, comissão prevista versus recebida e despesas abertas versus pagas. Não inventar gráficos ou percentuais: se o dado ainda não existir na tela, explicar o benefício como possibilidade de gestão e registrar a métrica como evolução do produto.

**Demonstração de rede:** a Racon Sorriso é uma master independente. O tour precisa evidenciar que os registros da Sorriso pertencem apenas a ela; Racon Sinop é parceira vinculada à Gauchinho, portanto não deve ser apresentada como outra unidade da Sorriso. O tenant de demonstração será uma terceira fronteira de dados.

O roteiro comercial é **narrado e demonstrativo**: destaca elementos reais, mas não clica em salvar, baixar, contratar, enviar PDF, estornar ou repassar. Se uma etapa não for autorizada ou sua âncora não existir, substitui a parada por explicação de benefício sem revelar dados nem rota restrita. A etapa inicial e o encerramento sempre permanecem acessíveis.

**Exemplo de fala do guia:** “Neste evento, o convidado faz check-in com consentimento e recebe um código para participar do sorteio promocional. A equipe vê de qual evento veio a oportunidade, organiza o próximo contato, consulta grupos adequados e registra uma proposta. Se a negociação evoluir, venda, comissão e compromissos financeiros ficam visíveis para a gestão. Aqui você está vendo dados fictícios; no seu negócio, cada pessoa acessará somente sua unidade e sua função.” Cada trecho dessa fala só entra no produto depois de o fluxo correspondente ser verificado de ponta a ponta.

**Preparação da amostra:** o piloto Sorriso já documenta clientes, leads, propostas, uma venda, comissão prevista e contas pagas fictícias. Ainda é necessário criar, no futuro tenant demo, um evento fictício com convite/QR, participantes de check-in, respostas de qualificação, consentimento, códigos e sorteio simulado, além de vínculos rastreáveis entre esse evento, um lead, cliente, grupo, proposta e venda. A ficha de cada parada marcará “verificado em produção”, “verificado na demo” ou “pendente de implementação”; etapas pendentes não serão anunciadas como recurso pronto.

### Programa “Seja Parceiro”: percurso e telas confirmadas

| Pergunta do franqueado | Tela e estado atual | Explicação no tour |
| --- | --- | --- |
| Onde a pessoa entra e escolhe o modelo? | Página pública `/parceiros`, páginas dos modelos e `/parceiros/cadastro`. O formulário aceita Microfranqueado, Gerador de Negócios, Gerador de Possibilidades ou “conversar com a equipe”. | O cadastro registra **modelo de interesse**, origem da página e parâmetros UTM. Interesse não é aprovação de comissão. |
| Onde vejo quem se cadastrou e o que escolheu? | ERP **Consultores** (`/erp/consultores`, que carrega a mesma gestão de `/admin/participantes`). A linha mostra “Modelo escolhido” e “Comissão atual” quando existe cadastro `LANDING_PARCEIROS`. | Localizar a pessoa e comparar escolha com perfil efetivo. O total no título inclui todos os participantes comerciais; não equivale ao total de parceiros captados. |
| Por que começa no modelo menor? | O cadastro cria vínculo de comissão com o perfil ativo **Gerador de Oportunidades**, de 12,5% na configuração homologada da Gauchinho, e marca `APROVADO_NIVEL_1`. O modelo escolhido permanece registrado separadamente. | Explicar que a escolha é uma solicitação; a remuneração inicial é a do perfil atribuído, sujeita às regras vigentes da master. Não anunciar 25% ou 50% como aprovado ao concluir o formulário. |
| Quando o gestor analisa? | Após a **primeira indicação**, o gatilho de banco marca `EM_ANALISE` e cria solicitação para o modelo desejado. Consultores mostra o aviso e link “Alterar perfil manualmente”. | Orientar a revisar elegibilidade e condições antes de mudar o perfil. Um cadastro sem primeira indicação ainda não entra nessa fila automática. |
| Em qual tela troco a remuneração? | ERP **Regras de Comissão** (`/erp/regras-comissao`) → aba **Participantes & Perfis**. Localizar o vínculo do participante com função `INDICADOR` e atribuir o perfil homologado correspondente; conferir regra, vigência e status. Depois voltar a **Consultores** para comparar o perfil atual com o solicitado. | A mudança é manual e vale para novas comissões conforme vigência. O botão “Concluir revisão” em Consultores apenas muda o status da solicitação; **não** altera o perfil sozinho. |
| Onde acompanho as pessoas? | Consultores/Participantes reúne nome, tipos, contato, status e acesso. Regras de Comissão mostra vínculos e perfis. O app do indicador mostra indicações e comissões do próprio participante. | Gestão do cadastro e da remuneração ficam em telas diferentes; o tour faz a ponte entre elas. |
| Como mensuro alcance e conversão? | O banco registra `origem_cadastro = LANDING_PARCEIROS`, `modelo_interesse`, data, `pagina_origem` e UTM; as telas atuais **não oferecem um painel específico de aquisição de parceiros**. | Propor painel por master e período: visitantes da página (exige medição de tráfego), cadastros únicos, modelo solicitado, primeira indicação, parceiros ativos, indicações, propostas, vendas e comissão gerada. Separar alcance, cadastro e resultado; não usar o total genérico de consultores como indicador de captação. |

**Ponto de atenção editorial:** o app do indicador chama `modelo_interesse` de “Meu negócio”, mesmo antes de o perfil de comissão ser promovido. O tour precisa chamar esse campo de **modelo solicitado** e mostrar separadamente o perfil vigente; a interface do app deve ser ajustada antes de usá-la como prova de que o modelo superior foi aprovado. O cadastro de CPF já existente atualiza o interesse, mas não troca automaticamente o perfil nem inicia nova análise; a trilha de gestão deve contemplar essa revisão manual.

**Condições para publicar em outras masters:** o cadastro depende de um perfil ativo chamado “Gerador de Oportunidades” no tenant. A regra de 12,5% foi confirmada na migração da Gauchinho; cada nova master precisa ter perfil e regras homologados antes de abrir o programa. O fluxo atual cria senha inicial baseada nos últimos seis dígitos do CPF; substituir esse mecanismo por convite ou definição segura de senha antes de divulgar o cadastro como exemplo pronto para interessados externos.

**Amostra necessária:** parceiro fictício que pediu Gerador de Negócios, entrou no nível inicial, realizou uma indicação fictícia, ficou `EM_ANALISE` e tem um vínculo de perfil de demonstração. Preparar outra ficha com Microfranqueado para mostrar a distribuição de interesse. O tour externo observa um replay; nenhum visitante pode aprovar solicitação ou mudar comissão.

### Mapa de valor que a demonstração precisa provar

| Necessidade da franqueadora | Recurso a mostrar | Ganho operacional a explicar | Evidência ou limite |
| --- | --- | --- | --- |
| Prospectar na praça | Eventos, convites, QR e formulário de check-in | Transformar participação presencial em oportunidade identificável, com origem e consentimento | Replay do evento fictício; conferir regras de coleta e vínculo real ao CRM |
| Engajar convidados | Código de participação, sorteio promocional, NPS e indicação quando habilitados | Motivar participação e obter retorno para ações posteriores | Sorteio de prêmio simulado; não confundir com sorteio de grupo de consórcio nem prometer conversão |
| Não perder oportunidades | CRM, funil, responsáveis, agenda e próximas ações | Equipe sabe quem atender e gestor identifica pendências | Mostrar filtros e etapas; medir tempo de resposta somente se disponível |
| Vender com padrão | Grupos de consórcio, simulação, propostas e contratação | Comparar alternativas de crédito e manter a negociação documentada | Mostrar grupo e proposta fictícios; não afirmar taxa de conversão |
| Ampliar a rede comercial | “Seja Parceiro”, app do indicador, Consultores e Regras de Comissão | Captar parceiros, conhecer o modelo solicitado e controlar remuneração com revisão humana | Mostrar escolha versus perfil vigente; painel de aquisição ainda é entrega futura |
| Conhecer a carteira | Clientes, histórico e vínculo com vendas | Continuidade do atendimento quando a equipe muda | Mostrar cliente `[DEMO]`; não expor dados de outra master |
| Dar previsibilidade à gestão | Painéis, relatórios, metas e tarefas | Decisões baseadas no andamento visível da unidade | Usar indicadores publicados; metas e valores de amostra não são resultados reais |
| Controlar dinheiro | Comissões, repasses, contas a pagar e caixa | Diferenciar expectativa de recebimento, despesa paga e saldo | Mostrar previsão e baixa fictícias; explicar saldo negativo da amostra |
| Escalar a operação | Plano, módulos, permissões, identidade da master e parceiros | Implantar unidades com papéis e acesso definidos | A Plataforma só é navegada por superadministrador; para prospect, usar explicação sem dados internos |
| Treinar e manter padrão | Trilhas por função e ajuda contextual | Novo colaborador encontra orientação no momento da tarefa | Mostrar uma microlição completa e a retomada do progresso |

Cada benefício precisa de uma **prova de tela ou de fluxo** antes de entrar na narrativa comercial. A ficha editorial registra fonte, rota, condição de acesso e data de revisão; se o recurso mudar, a afirmação é revisada junto com a etapa. Assim a apresentação vende o que o sistema efetivamente entrega.

## 4. Cobertura integral por catálogo contextual

O catálogo é indexado por **ID estável do menu**, rota, público, permissão, função, **benefício para a unidade**, indicador relacionado, exemplo, tarefa de treinamento e alerta quando houver impacto financeiro ou envio externo. A matriz abaixo é o checklist de conteúdo: cada item visível precisa de uma ficha curta e cada ficha deve apontar para uma rota real. Menus ocultos por plano ou papel nunca aparecem no tour.

| Área | Menus a cobrir com ajuda contextual |
| --- | --- |
| Portal administrativo — comercial | Dashboard; CRM — Vendas; Pipeline Funil; Lista de Leads; Meus contatos; Performance CRM; Materiais & Scripts; Agenda; Disponibilidade; Eventos; Dashboard NPS; Listas convidados; Relatórios; Propostas; Contratações |
| Portal administrativo — catálogo e gestão | Catálogo de grupos; Cartas Contempladas; Imobiliárias; Seguradoras; Imóveis; Conteúdo; Usuários; Índices financeiros; Configurações; QR Codes únicos; atalhos SaaS de empresa e administradoras quando exibidos |
| ERP — módulos base | Painel; Leads / CRM; Propostas; Contratações; Vendas e Cotas; Grupos; Comissões; Financeiro e Caixa; Relatórios; Metas; Tarefas; Usuários |
| ERP — operação | Clientes e carteira; Consultores; Lances e estratégias; Assembleias / Pedras; Regras de comissão; Repasse da franquia; Minhas comissões; Contas a pagar; Conta-corrente sócios |
| Plataforma SaaS | Dashboard; Master Franquias; Revisão técnica; Acesso de revisão; Usuários / Responsáveis; Domínios; Administradoras; Grupos e créditos; Sites / Portais; Modelos de Site; Catálogo de módulos; Liberações e overrides; Planos; Assinaturas SaaS; Auditoria; Configurações |
| Área do parceiro | Painel; Leads; Propostas, quando liberados para o parceiro |
| App do indicador | Painel; Indicar; Comissões; Lista de convidados do evento, conforme acesso |
| Site público | Home, grupos, simulador, conteúdo, parceiros e contratação, somente quando presentes no modelo e nos menus publicados do tenant |

As fichas de **Plataforma**, **Parceiro**, **Indicador** e **Site público** serão publicadas em trilhas próprias após o piloto da master, sem copiar textos do tour administrativo. O catálogo deve sinalizar itens sem página utilizável ou indisponíveis por configuração, para não induzir navegação quebrada.

## 5. Experiência de uso

- No login demo, entrada com **Conhecer o sistema em 11 passos** e **Explorar por área**. Na master contratada, entrada com **Minha trilha de implantação** e **Ajuda desta página**; o dono vê também o mapa das trilhas da equipe. Convite opcional no primeiro acesso, sem bloquear trabalho.
- Cartão curto com **problema → recurso → benefício**, indicador quando houver, contador de etapas, **Voltar**, **Próximo**, **Pular** e **Encerrar**. Sem setas piscando nem animações obrigatórias.
- **Ajuda desta página** abre a ficha do menu atual; busca por assunto oferece acesso às demais fichas autorizadas. **Reiniciar tour** permanece disponível.
- O treinamento tem trilhas por função: direção (painéis, metas e relatórios), comercial (lead, contato, agenda e proposta), gestão (funil, equipe e acompanhamento) e financeiro (contas, comissões e caixa). Cada microlição termina com uma tarefa prática em ambiente demonstrativo ou uma verificação de entendimento; progresso independente por trilha.
- Um resumo final conecta os ganhos apresentados: mais visibilidade sobre oportunidades, rotina comercial padronizada, menos informação dispersa e controle de obrigações financeiras. A ação comercial abre um canal de contato explícito; o tour nunca envia solicitação automaticamente.
- Âncora visual no elemento real. Em celular, o menu é aberto antes de posicionar a âncora; se o elemento não existir, usar destaque na página e texto de fallback.
- Pausa ao sair da rota; ao voltar, oferecer **Continuar de onde parou**. Nunca reabrir automaticamente após o usuário encerrar.
- Antes de mostrar dados de exemplo, selo visível **Demonstração — dados fictícios**. O saldo negativo da amostra financeira deve ser explicado como três saídas simuladas sem entrada simulada.
- Conteúdo em português claro, sem prometer uma função que a página ou o perfil não oferece. Identidade visual vem do tenant ativo.

## 6. Desenho técnico e limites de acesso

1. Montar o percurso no servidor a partir de `empresa_id` do host, vínculo ativo em `empresa_usuarios`, papel, permissões canônicas, plano e `allowedAccess` do ERP. A lista enviada ao navegador contém apenas etapas já autorizadas. O parâmetro de URL ou estado local não pode escolher outro tenant. O papel `visitante_demo` requer concessões mínimas e validação de leitura no servidor e no banco, inclusive nas rotas fora do tour.
2. Manter fichas versionadas em código por `tourId`/`stepId` e `menuId`; adicionar `data-tour-id` estável a âncoras dos sidebars e blocos principais. Não depender de texto da interface, posição DOM ou classes CSS.
3. Para a **demo compartilhada**, guardar avanço por sessão/navegador e versão do tour, sem usar um registro único do usuário demo; expirar esse estado e permitir reinício imediato. Para **unidades contratadas**, persistir progresso por **usuário + empresa + tour + versão** no banco, com RLS de leitura e escrita do próprio usuário. A visão de conclusão da equipe pelo dono exige autorização separada e expõe apenas estado de treinamento. A trilha global da Plataforma tem escopo próprio. Concluir, pular e reiniciar são estados distintos.
4. Revalidar a autorização a cada navegação. Se plano, papel, vínculo ou menu mudar, reconstruir o roteiro; nunca exibir conteúdo de outra empresa nem deixar um link de tour contornar `requireErpRouteAccess` ou guardas equivalentes.
5. Os IDs de registros `[DEMO]` são apenas exemplos opcionais. Se forem removidos, a etapa mostra a explicação genérica. O roteiro externo usa só o tenant demo; nunca busca clientes reais da Sorriso ou da Gauchinho para completar uma etapa.
6. Telemetria mínima: abertura, avanço, pulo, conclusão, falha de âncora e versão; somente IDs técnicos de etapa e tenant. Na demo, contar sessões e conclusões agregadas, sem tratar login compartilhado como identificação de interessado. Sem nome, e-mail, telefone, CPF, texto de proposta ou valores de clientes.
7. Separar `tourId` comercial de `tourId` de treinamento. O primeiro mede entendimento e interesse; as trilhas medem lições concluídas. Uma mudança editorial versiona o conteúdo sem apagar o histórico anterior.
8. Os exercícios nunca usam dados de clientes reais. A primeira versão usa modo de observação, replay do check-in/sorteio e perguntas de compreensão; tarefas que precisem gravar registros exigem sandbox isolado com reset documentado. Manter separado o sorteio promocional de eventos e o sorteio/assembleia de grupos de consórcio.

## 7. Entregas e ordem de execução

| Fase | Entrega verificável | Condição para avançar |
| --- | --- | --- |
| 0. Narrativa e inventário | Proposta de valor, história evento → caixa + parceiro → indicação, catálogo de menus/rotas e matriz de papel, plano e tenant | Cada benefício tem demonstração fiel; nenhum menu visível sem ficha |
| 1. Ambiente e acessos | Tenant demo isolado, registros inteiramente fictícios, evento com check-in/sorteio simulado, parceiro e indicação fictícios, papel `visitante_demo` e uma credencial compartilhável | Auditoria de leitura/escrita e RLS confirma isolamento; duas sessões simultâneas não compartilham progresso; nenhum disparo externo |
| 2. Base do guia | Componente acessível, âncoras estáveis, progresso por sessão demo e por usuário real, autorização no servidor | Retomar, pular, reiniciar, duas sessões demo simultâneas e troca de tenant testados |
| 3. Demonstração comercial | 11 paradas de valor e biblioteca “Explorar por área”, com percursos evento → caixa e parceiro → indicação | Decisor entende benefícios, localiza “como fazer” nos módulos e distingue demonstração de operação real |
| 3a. Gestão de parceiros | Ficha de Consultores, ficha de Regras de Comissão e painel de aquisição por master/período com fontes auditáveis | Gestor identifica cadastros da landing, modelos solicitados, primeira indicação e perfil vigente; painel separa visitantes, cadastros e resultados |
| 4. Implantação por perfil | Trilha inicial do dono, mapa da equipe, trilhas de gestão, comercial, financeiro, parceiro e indicador, microlições e progresso individual | Dono conclui sua visão; cada usuário recebe só lições autorizadas por papel, plano e acesso; dono acompanha conclusão quando autorizado |
| 5. Cobertura SaaS | Trilhas separadas de Plataforma, revisor, parceiro, indicador e site público | Cada público vê apenas suas páginas e benefícios correspondentes |
| 6. Operação | Métricas de uso, revisão editorial e rotina para atualizar fichas quando surgirem menus | Checklist incorporado ao processo de release |

## 8. Critérios de aceite e testes necessários

- **Cobertura:** comparação automatizada entre IDs dos menus renderizáveis e catálogo; falha de CI se surgir menu sem ficha ou ficha órfã. A cobertura é por menu autorizado, não por todas as páginas internas.
- **Permissões:** testar `admin_empresa`, gestor, consultor, visualizador, revisor técnico e parceiro; plano completo, plano parcial, módulo desligado e lista explícita vazia. Uma etapa nunca deve revelar nem abrir menu negado.
- **Isolamento:** alternar Gauchinho e Sorriso com o mesmo usuário; progresso e exemplos permanecem separados por `empresa_id`. A Sorriso não pode mostrar clientes ou valores da Gauchinho.
- **Acesso externo:** visitante demo não consulta Sorriso/Gauchinho nem por URL direta, API, exportação ou ID adivinhado; rotação/revogação da credencial encerra o acesso. Testar também POST/PATCH/DELETE diretamente contra actions e endpoints, não apenas botões ocultos. Duas pessoas com o mesmo login não veem o progresso uma da outra.
- **Fluxo de prospecção:** um registro fictício mostra, na mesma história, evento, convite/QR, check-in com consentimento, código de sorteio promocional, origem do lead, etapa no CRM, grupo, proposta, venda e indicadores. Se uma ligação ainda não existir no produto, a parada fica pendente e não é anunciada como pronta.
- **Programa de parceiros:** validar cadastro de cada modelo, vínculo inicial de 12,5% onde a regra homologada existir, primeira indicação e entrada em revisão; confirmar que “Concluir revisão” sem troca de perfil não é apresentado como promoção. Verificar vínculos novos e comissões futuras após mudança, sem recalcular histórico.
- **Medição da rede:** contar cadastros distintos por `empresa_id`, período e `origem_cadastro`, distribuir por modelo solicitado e acompanhar primeira indicação, propostas e vendas atribuídas. “Visitantes alcançados” só aparece quando houver fonte de tráfego definida e deduplicação; não equiparar visitas a cadastros nem contabilizar consultores preexistentes duas vezes.
- **Fluxo:** iniciar, voltar, avançar, pular, encerrar, retomar após recarga, reiniciar após conclusão e alterar versão do tour.
- **Resiliência:** âncora ausente, página lenta, erro de carregamento, janela estreita, menu recolhido e remoção dos dados `[DEMO]` não travam a navegação.
- **Acessibilidade:** teclado, foco visível, Escape, leitor de tela, contraste, zoom de 200% e preferência por movimento reduzido. A rolagem até a âncora não deve roubar o foco sem aviso.
- **Segurança de operação:** durante o tour, nenhum e-mail, WhatsApp, PDF, contrato, baixa, repasse ou estorno é disparado. O tour não amplia permissões.
- **Homologação comercial:** entrevistas rápidas com um decisor de franqueadora e um gestor sem treinamento prévio. Ambos devem relatar três benefícios concretos, identificar o fluxo evento → lead → grupo → proposta → caixa e compreender que o treinamento acompanha o sistema, sem confundir valores fictícios com resultado comprovado.
- **Homologação do treinamento:** uma pessoa de cada função encontra sua trilha, conclui a microlição e sabe executar ou explicar sua tarefa; a conclusão não depende de permissão que seu papel não possui.
- **Implantação:** o responsável principal da nova master recebe a trilha executiva sem acesso à Plataforma SaaS; gestor, consultor, financeiro, parceiro e indicador recebem somente lições de módulos concedidos. Acompanhamento de conclusão pelo dono não concede acesso a dados ou telas adicionais.
- **Medição pós-lançamento:** acompanhar início e conclusão da demonstração, abandono por etapa, abertura de trilhas, conclusão de lições e cliques voluntários no próximo passo comercial. Revisar pontos com abandono elevado; não usar esses eventos como prova de aumento de vendas da franqueadora.
- **Homologação editorial:** cada texto descreve a página publicada e responde em linguagem simples “que problema resolve?”, “como ajuda minha unidade?” e “o que faço depois?”.

## 9. Fora do projeto de implementação inicial

Vídeo obrigatório, assistente que executa ações pelo usuário, criação automática de dados em produção, alterações em contratos e mensagens externas. O guia pode futuramente apontar para vídeos ou documentação, mas a experiência principal funciona sem eles.
