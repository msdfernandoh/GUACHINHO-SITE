# Planejamento do tour guiado — 26/09/2026

Documento de execução criado e revisado em `docs/projetos/TOUR-GUIADO-SAAS-ERP.md`. O plano define piloto interno na master Sorriso e entrega externa em tenant de demonstração separado, com logins individuais, expiração e papel somente leitura a validar no servidor e no banco. O percurso comercial de 11 paradas apresenta evento, convite/QR, check-in, sorteio promocional simulado, lead, grupo de consórcio, proposta, venda, comissão, caixa e rede de parceiros, sempre com benefício e evidência. Há trilhas de treinamento por função e cobertura contextual dos menus do portal, ERP e Plataforma. Nenhum código do tour, migration, acesso demo ou dado operacional foi criado nesta fase.

Inventário fundamentado em `admin/sidebar.tsx`, `admin-menus.ts`, `erp/erp-modulos.ts`, `erp/erp-operational.ts`, `erp/erp-acesso.ts`, `platform/platform-sidebar.tsx`, rotas de eventos/check-in/sorteio e páginas de grupos e propostas. A amostra da Sorriso é a documentada no hotfix de 25/09/2026; evento, check-in e sorteio da demo ainda precisam ser preparados e verificados antes de entrar em material comercial.

## Complemento — programa “Seja Parceiro”

O roteiro passa a ter 11 paradas e inclui a rede de parceiros. O cadastro público salva o modelo de interesse e inicia no perfil de comissão “Gerador de Oportunidades”; a gestão de pessoas e do modelo escolhido está em `/erp/consultores` (mesma tela de `/admin/participantes`), enquanto a troca manual do perfil vigente ocorre em `/erp/regras-comissao`, aba “Participantes & Perfis”. A primeira indicação coloca a solicitação em análise. “Concluir revisão” altera o status, não o perfil. O app do indicador exibe o interesse como “Meu negócio”, uma ambiguidade que deve ser corrigida antes da demonstração externa.

Não existe painel dedicado de aquisição de parceiros nas telas inspecionadas. O projeto exige métricas separadas de tráfego da página, cadastros únicos da landing, modelos solicitados, primeira indicação, propostas e vendas atribuídas, todas filtradas por master e período. O total genérico de participantes não representa o alcance do programa. Nenhum código, migration, usuário ou dado operacional foi modificado neste complemento.

## Revisão — login demo único e implantação por perfil

O modelo comercial passa a usar uma credencial demo compartilhada em tenant isolado, somente leitura e com dados fictícios. O progresso dessa credencial é separado por sessão/navegador, pois visitantes simultâneos não podem compartilhar a mesma posição do tour. A apresentação tem percurso executivo de 11 paradas e biblioteca “Explorar por área”, que descreve benefício, controle e modo de uso de cada módulo disponível; páginas privilegiadas da Plataforma recebem apenas explicação.

Após o contrato, a master recebe o guia como camada adicional. O dono faz primeiro a trilha de direção; gestor, consultor, financeiro, parceiro e indicador recebem trilhas filtradas por vínculo, papel, plano e permissões existentes. O progresso real é por usuário e empresa, e uma visão de conclusão da equipe para o dono é entrega nova, sem ampliar acesso operacional. Nenhuma regra de negócio, permissão, menu, dado ou fluxo atual foi alterado nesta revisão de projeto.
