# Usuários ativos, acesso ao app e consolidação de Fernando — 15/11/2026

## Autorização e senha
O titular pediu acesso por CPF e senha inicial de seis dígitos, depois confirmou preservar senhas existentes e completar CPFs em Consultores. Nenhuma senha foi redefinida. Novos acessos sem senha definida continuam usando a rotina já existente de últimos seis dígitos do CPF. Acrescentado Mudar senha no cabeçalho do app, reutilizando o fluxo autenticado de definição de senha e retornando ao app. A tela diferencia alteração voluntária de recuperação. O login explica a preservação da senha atual do sistema.

## Operação em produção
Ativos e conferidos: Fernando, Eroni Bolfe, Igor, Tayna Pires, Enos e Mateus Felipe Saraiva. Os seis já tinham usuário ativo; apenas o participante de Tayna estava INATIVO e foi reativado com auditoria. Os demais registros ativos não citados pelo titular foram preservados. Senhas e permissões dos outros usuários não foram alteradas.

Conferidas 132 referências a usuários e participantes nas migrations contra a base real, sem erros de consulta. A identidade original msdfernando@gmail.com (usuarios.id 31617f5c-42c7-4f08-ba5a-38323eacbffd), documentada na recuperação de 18/10/2026, concentra a autoridade Superadmin e o histórico financeiro. Ela foi preservada com o mesmo Auth e senha. Não se transferiu nem se rebaixou a autoridade PLATFORM.

Os vínculos N:N de Racon Sinop, Sorriso e da empresa de teste já existente foram disponibilizados à conta principal. A empresa de teste permanece inativa; não houve ativação de empresa ou assinatura. A responsabilidade principal das três empresas foi consolidada depois de criar os vínculos, respeitando a unicidade do responsável ativo. A primeira tentativa de cópia encontrou essa unicidade e encerrou sem alterar dados; a operação seguinte criou o vínculo sem duplicar a marcação e depois a transferiu.

Arquivados os logins duplicados fernando@msdeducacao.com.br, hugo@msdeducacao.com.br e fernandohugomsd@gmail.com. Seus vínculos foram inativados, participantes marcados DESLIGADO e logins bloqueados. Não houve DELETE físico, pois existem referências históricas que devem permanecer. Autoria de leads, contratos, auditorias, pagamentos e registros de eventos não foi reescrita. Agora há somente um usuário ativo com nome Fernando, com quatro vínculos de empresa; um deles aponta para empresa inativa e não libera operação.

CPF continua pendente para Fernando, Eroni, Igor, Tayna e Enos nos participantes vinculados ao login; o titular preencherá em Consultores. Mateus já possui CPF. Participantes homônimos sem usuário não foram vinculados por suposição de nome.

## Preservação
Hashes SHA-256 de conteúdo e contagens antes/depois foram idênticos nas tabelas abaixo. Evidência: docs/relatorios-fases/evidencias/usuarios-fernando-2026-11-15.json.

| Tabela | Linhas | Conteúdo antes/depois |
|---|---:|---|
| leads | 249 | Idêntico |
| propostas | 189 | Idêntico |
| vendas | 125 | Idêntico |
| cotas_definitivas | 146 | Idêntico |
| comissao_previsoes_participantes | 365 | Idêntico |
| financeiro_pagamentos | 7 | Idêntico |
| clientes | 69 | Idêntico |
| contratacoes_online | 18 | Idêntico |
| empresa_socios | 2 | Idêntico |

## Validação e limitações
TypeScript aprovado, seis testes de login e senha inicial aprovados, lint sem erros e build Webpack aprovado. Conferência de produção confirmou os seis usuários e seus participantes ativos, vínculos ATIVO, autoridade Superadmin preservada e três duplicados inativos.

A revisão automática rejeitou uma operação adicional que copiaria telefones, ajustaria status complementares e arquivaria indicadores: entendeu que excedia a autorização e poderia afetar acessos. Essa operação não foi aplicada nem contornada. Os campos faltantes serão completados pelo titular em Consultores. A consolidação autorizada anterior e a ativação dos seis usuários já estavam concluídas e foram verificadas por leitura posterior.
