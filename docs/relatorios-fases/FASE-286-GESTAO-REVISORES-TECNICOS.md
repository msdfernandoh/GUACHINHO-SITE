# Fase 286 — Gestão de revisores técnicos

Data: 30/09/2026.

## Entrega

A rota global `/platform/acessos-cadastro`, exclusiva do superadmin, agora exibe todos os registros de `plataforma_revisores_tecnicos`, com nome, e-mail, situação e data de expiração.

Para cada revisor é possível gerar uma nova senha temporária com troca obrigatória no próximo login, inativar ou reativar a autorização e prorrogar a validade em 30 dias. A senha é retornada apenas na resposta da ação e não é persistida.

## Segurança e escopo

Cada ação revalida o superadmin e confere que o usuário alvo está cadastrado como revisor técnico antes de acessar a identidade Auth ou alterar `plataforma_revisores_tecnicos`. Nenhuma ação cria, altera ou remove vínculo em `empresa_usuarios`; logo, o revisor continua sem acesso a tenant. Inativar atualiza o mesmo campo `ativo` usado por `is_platform_technical_reviewer()`, bloqueando o acesso de leitura imediatamente.
