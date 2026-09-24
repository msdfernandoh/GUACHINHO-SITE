# Hotfix 288 — Acesso ao app de indicação com credencial técnica

Data: 24/09/2026.

## Diagnóstico

O login do app anunciava CPF ou e-mail, mas o cadastro de parceiros conservava no Supabase Auth um e-mail técnico `cpf-...@parceiro.gauchinho.local`. O e-mail de contato ficava em `usuarios.email`. O fluxo por e-mail tentava autenticar diretamente o contato e retornava senha inválida mesmo para uma conta ativa. A consulta de produção, sem leitura ou alteração de senhas, confirmou esse arranjo em uma conta da Cleusa com indicador ativo e vínculo `empresa_usuarios` ativo no tenant.

Havia também consultas independentes de participante nas telas de comissões, que podiam falhar com múltiplos participantes ligados ao mesmo usuário, contrariando o resolvedor canônico do app.

## Correção

- O login resolve o usuário pelo CPF ou e-mail de contato, exige vínculo ativo com a empresa do domínio e participante comercial ativo, consulta o e-mail efetivo da identidade Auth vinculada e autentica com a senha informada. Não altera e-mail, senha, usuário, participante nem histórico comercial.
- A tela apresenta CPF como forma principal de entrada, conforme a preferência operacional; e-mail continua aceito para compatibilidade sem ser exigido no acesso.
- A recuperação no app também recebe o CPF. O servidor resolve o indicador, o participante, o usuário e o vínculo ativo no tenant antes de enviar o link ao e-mail de contato cadastrado. A resposta não revela se o CPF existe, e a titular define a nova senha pelo link.
- Depois da autenticação, o app valida o indicador pelo resolvedor canônico, que preserva a recomposição idempotente de vínculos legados. Se o indicador estiver inativo ou ausente, encerra a sessão e mostra mensagem de acesso inativo.
- Painel, indicação, comissões e lista de convidados exigem participante e indicador ativos. Comissões passam a usar o mesmo participante selecionado pelo resolvedor central, preservando nome de exibição e escopo da empresa.

## Verificação

- Testes automatizados: e-mail de contato com Auth técnico, CPF formatado, ausência de vínculo com o tenant, indicador inativo e recuperação por CPF.
- Testes de contrato da sessão do indicador e checagem TypeScript.
- Consulta somente leitura da conta em produção confirmou Auth técnico, usuário, vínculo tenant e indicador ativos. A senha real não estava disponível e não foi testada nem redefinida.
- Uma tentativa controlada com a regra de senha inicial (últimos seis dígitos do CPF do indicador ativo) retornou `invalid_credentials`; portanto, essa senha inicial não funciona para essa conta. O acesso com uma eventual senha pessoal alterada depende da própria titular.
- Publicado em produção na Vercel (`dpl_2pbxKG5vF2ZbAbu7onHXWTp4xiJ2`). As rotas públicas `/app-indicador/login` e `/app-indicador/recuperar-senha` responderam HTTP 200 no domínio Gauchinho após a publicação.
