# Fase 241 — Landing de Parceiros e PWA de Indicadores

## Escopo

- Landing pública `/parceiros` para Microfranqueado, Gerador de Negócios e Gerador de Possibilidades.
- Cadastro conversacional com conta por CPF e senha; todos entram com o perfil comercial canônico `INDICADOR`, apresentado como Gerador de Possibilidades (Nível 1).
- Escolhas de Microfranqueado ou Gerador de Negócios criam solicitação `EM_ANALISE`, exclusiva para decisão administrativa da Gauchinho.
- PWA `/app-indicador` com acesso autenticado, resumo de comissões e acompanhamento de indicados.

## Segurança e dados

O acesso autenticado é criado com identidade `usuarios`, vínculo N:N em `empresa_usuarios` e associação a `participantes_comerciais.usuario_id`; não depende de CPF em consulta pública. O perfil comercial e a regra de comissão continuam canônicos e não recebem percentual fixo pela landing. A migration 231 é forward-only e preserva cadastros e previsões existentes.

O indicador vê a evolução registrada no CRM, crédito desejado e crédito contratado. Valores de comissão e confirmação de recebimento permanecem no módulo autenticado `Minhas comissões`; a confirmação usa a RPC existente e fica auditada por usuário/data.

## Validação

- `npx tsc --noEmit`: aprovado.
- `npm run lint:errors`: aprovado.
