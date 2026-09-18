# Fase 248 — Recuperação e Redefinição de Senha do Indicador

## Recuperação pelo próprio indicador

- O login do app ganhou o link **Esqueci minha senha** para `/app-indicador/recuperar-senha`.
- O parceiro informa o e-mail cadastrado e recebe o fluxo de recuperação do Supabase, com link de uso único.
- Após criar a nova senha, o redirecionamento retorna ao painel `/app-indicador`.
- Contas de parceiros criadas no formato legado de e-mail técnico são atualizadas para o e-mail de contato antes do disparo de recuperação. O login continua sendo realizado por CPF e senha.

## Redefinição administrativa

- Em **Administração → Participantes**, indicadores com login ativo exibem a ação de chave **Redefinir senha do indicador**.
- A ação exige senha de ao menos oito caracteres, valida que o participante é `INDICADOR`, confirma vínculo com a empresa ativa e atualiza somente o usuário de Auth já vinculado.
- Cada redefinição registra um evento `REDEFINIR_SENHA_INDICADOR` em `participante_auditoria`; a senha não é registrada no banco nem exibida em logs.

## Segurança

Não houve alteração de perfis, permissões, módulos ou escopos. A recuperação responde de forma genérica para e-mails inexistentes, e a redefinição administrativa permanece condicionada à autorização de gerenciamento de participantes do tenant.
