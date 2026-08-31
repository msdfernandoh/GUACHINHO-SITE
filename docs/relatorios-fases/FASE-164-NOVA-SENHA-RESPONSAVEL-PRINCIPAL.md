# Fase 164 — Nova senha do responsável principal

## Escopo

Botão Gerar nova senha no Platform → Usuários / Responsáveis e no HUB da Master
Franquia → Usuários. Visível para responsável principal ativo.

## Segurança e comportamento

- Autorização de Platform Superadmin revalidada no servidor.
- Confirmação explícita; aviso de que a identidade compartilha a senha entre franquias.
- Vínculo N:N validado pelo ID e empresa. Alvo precisa estar principal e ativo.
- Auth resolvido por auth_user_id com conferência de e-mail.
- Senha temporária aleatória criptográfica de 16 caracteres, incluindo quatro classes.
- Não confirma e-mail, não ativa conta, não muda papéis ou vínculos.
- Preserva metadados; exige troca no próximo login e registra autor/data.
- Modal mostra credencial apenas no resultado da ação, oferece cópia e descarta
  estado ao fechar. Falhas não retornam a senha. Não há persistência em localStorage.

## Validação

Testes mockados: falta de permissão/confirmação, vínculo inexistente ou inativo,
usuário não principal, identidade divergente, erro do Auth, geração segura,
preservação de metadados e uso correto de auth_user_id.
Não foram redefinidas senhas reais para validar a funcionalidade.

TypeScript, build de produção e lint dos arquivos envolvidos aprovados.
Suíte completa: 1.120 testes aprovados, 37 ignorados pelas condições existentes.
