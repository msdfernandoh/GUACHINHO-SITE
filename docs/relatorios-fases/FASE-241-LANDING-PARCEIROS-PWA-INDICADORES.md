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

## Complemento — módulo institucional nas homes

- O bloco **Seja um Franqueado** do template Racon Sinop passou a direcionar seu botão **Saiba mais** para `/parceiros`.
- A home do modelo próprio Gauchinho passou a exibir um módulo visual de Programa de Parceiros, com benefícios institucionais e CTA para a mesma landing.
- Na home Gauchinho, o módulo é ordenado na última faixa institucional, depois do CTA comercial e antes da faixa final de parceiros/rodapé.

## Correção de cadastro e jornadas por modalidade

- Cada card da landing passou a abrir uma página própria de vantagens e condições antes do cadastro.
- O cadastro aplica máscaras de WhatsApp e CPF e oferece escolha por toque da chave PIX (celular, e-mail, CPF ou aleatória), com a orientação de recebimento automático de comissões.
- A migration 232 cria o perfil legado explícito `parceiro`, sem permissões de equipe. A autorização efetiva continua limitada pelo vínculo N:N e pelo único módulo visível `minhas-comissoes`.
