# Hotfix 290 — Contraste da landing de parceiros Racon

Data: 24/09/2026.

## Escopo

Verificação visual das páginas públicas do programa de indicação nos hosts `www.raconsinop.com.br` e `raconsorriso.com.br`, preservando o layout padrão branco e azul.

## Achado e correção

Login do app, recuperação por CPF e cadastro público apresentaram superfícies claras e ações azuis nos dois hosts. Na landing `/parceiros`, o título principal herdava azul escuro sobre o gradiente azul, prejudicando a leitura. O bloco “Network de Negócios” usava a mesma combinação de fundo azul com texto herdado escuro. Os dois blocos agora definem texto branco explicitamente; os cards brancos internos mantêm texto azul escuro. A alteração está restrita ao componente público de parceiros quando o modelo é Racon.

## Validação

- `/parceiros`, `/parceiros/cadastro`, `/app-indicador/login` e `/app-indicador/recuperar-senha` abertos nos dois hosts; navegação e identidade Racon confirmadas.
- Após a implantação, o título principal branco sobre o hero azul foi confirmado visualmente em ambos os hosts. Os links da landing continuam apontando para o respectivo host.
- `/grupos` conferido visualmente após a implantação em ambos os hosts: fundo e tabela brancos, cabeçalho e barra de totais azuis.
- TypeScript e ESLint do componente sem erros; build de produção Vercel concluído. Implantação `guachinho-site-20cna6zqe`.

Sem alteração de autenticação, dados, regras comerciais ou isolamento multiempresa.
