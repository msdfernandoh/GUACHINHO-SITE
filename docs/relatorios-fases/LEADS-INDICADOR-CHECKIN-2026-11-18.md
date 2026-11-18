# Quem indicou o lead no check-in · 18/11/2026

- O CRM administrativo e o ERP exibem “Indicado por” na lista e no detalhe. O quadro do ERP mostra o nome no cartão.
- Para indicações existentes do sorteio, o CRM consulta o nome do participante pelo vínculo gravado com o lead. No SPL, lê o nome registrado nos dados de origem. O nome de quem convidou o participante continua sendo tratado como convite.
- O check-in padrão grava o nome do indicador nos dados da indicação enviados ao CRM em novos cadastros.
- A recuperação usa a sessão autenticada e os vínculos existentes. A implementação dispensa migração e edição dos cadastros históricos.
- Os 15 testes direcionados passaram. A verificação de tipos completa encontrou erros preexistentes em `scratch-spl-dashboard`. A conferência com dados em produção está pendente.
