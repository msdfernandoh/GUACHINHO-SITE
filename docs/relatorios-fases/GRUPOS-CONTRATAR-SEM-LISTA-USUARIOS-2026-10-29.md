# Grupos: contratar sem lista de usuários — 29/10/2026

## Problema e comportamento resultante

A página Grupos buscava automaticamente /api/public/consultores, mostrava usuários em um seletor para visitantes e exigia responsável no início e no salvamento da proposta. A consulta de empresa_usuarios podia repetir um usuário com vários papéis. Um participante comercial inativo também não era retirado da lista apenas por existir um vínculo de usuário ativo.

O modal público agora oferece Entrar ou Continuar sem vendedor, sem consultar ou renderizar usuários. O usuário autenticado segue diretamente; a atribuição depende da identidade validada no servidor, da empresa ativa, da permissão gerenciar_propostas e do vínculo comercial elegível. IDs/nomes enviados no payload inicial não escolhem o responsável. O Simulador, consumidor do mesmo fluxo, recebeu a mesma remoção de lista pública.

O modo cliente_site aceita rascunho/proposta sem vendedor. Nome e telefone continuam obrigatórios para persistir a proposta; geração de link comercial continua autenticada e exige responsável válido. Ao atualizar proposta existente sem novo responsável, preservam-se nome/e-mail e ID do responsável anterior. Os links comerciais já existentes continuam resolvendo e validando seus responsáveis pelo tenant.

/api/public/consultores exige sessão e permissão na empresa do domínio, responde 401 para visitantes e 403 para acesso indevido, e entrega sucesso com Cache-Control private, no-store. O caminho foi mantido por compatibilidade.

## Lista interna

Listagem consolida múltiplos papéis por usuario_id/identidade Auth comprovada e exige usuario.ativo=true e vínculo ativo/elegível na empresa. Participantes comerciais exclusivamente inativos são excluídos. Preferência por consultores marcados é aplicada após esses filtros. Resolução individual aceita vários papéis sem maybeSingle ambíguo e também recusa participante comercial inativo.

Cadastros distintos com o mesmo nome não são fundidos apenas pelo nome. Nenhum usuário, participante, papel, vínculo ou fato comercial foi apagado/mesclado no banco.

## Validação

- 92 testes em 26 arquivos aprovados: responsáveis, início anônimo, bloqueio de lista, tentativa de forjar responsável no início, sessão de outra empresa, materialização sem vendedor e preservação do responsável existente, além das regressões de propostas/contratação.
- TypeScript, lint direcionado e build de produção aprovados.
- Smoke em Chrome com build local no host configurado gauchinhoconsorcios.com.br: selecionou cota/quantidade no 5388; modal sem select, link de login e botão Continuar sem vendedor; zero consultas automáticas à lista; POST iniciar 200; rascunho em sessionStorage sem consultor_id; navegação até /proposta/rascunho; consulta explícita à lista recebeu 401 sem usuários; zero erros JavaScript.
- Evidência visual: tmp/contratar-sem-vendedor/gauchinhoconsorcios.com.br-modal.png. Script reproduzível: scripts/smoke-grupos-sem-vendedor.mjs (usa servidor local na porta 3101).
- Testes de materialização usam banco simulado. O smoke não enviou dados pessoais nem criou proposta/contratação real. O rate limiter canônico do ingresso público pode registrar o acesso.

Os hosts parceiros raconsinop.com.br e raconsorriso.com.br não resolveram no ambiente local usado no smoke (404). A validação local foi feita no componente compartilhado pelo host oficial. Não foram alteradas configurações de domínio ou flags em produção.

## Publicação

Correção enviada à main no commit de9ec9e208558d9e0eb3545a7836d0b7c16c7288. Deployment automático de produção dpl_7Y8rcdkwpjPKa9LHsUfTu35yQAbF confirmado READY, com o mesmo SHA. Consulta pública aos dois domínios confirmou 401 sem retorno de consultores.

Smoke público concluído em raconsinop.com.br e raconsorriso.com.br: selecionou cota/quantidade, abriu modal sem select nem consulta automática de usuários, confirmou Entrar e Continuar sem vendedor, recebeu POST iniciar 200 com rascunho sem consultor_id, navegou até /proposta/rascunho e confirmou lista protegida por 401. Zero erros JavaScript nos dois testes. Nenhum formulário de dados pessoais foi enviado. Capturas em tmp/contratar-sem-vendedor/raconsinop.com.br-modal.png e raconsorriso.com.br-modal.png.

O script aceita SMOKE_PUBLIC=1 para testar diretamente os sites publicados. A espera usa DOM pronto e elementos específicos, porque aguardar networkidle pode não terminar com conexões de terceiros. O campo de quantidade é identificado pela primeira entrada da linha, compatível com inputMode numeric. As falhas iniciais do harness foram de espera/seletor e foram resolvidas antes da homologação.
