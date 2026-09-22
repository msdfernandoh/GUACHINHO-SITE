# Fase 261 — App do indicador, cadastro idempotente e convite Network

## Objetivo

Concluir a jornada pública e autenticada do programa de indicação, garantindo
que o indicador veja seus links no app, que novas indicações sejam atribuídas
ao usuário autenticado e que o cadastro de parceiro possa ser repetido sem
criar participantes comerciais duplicados.

## Entrega

- O painel `/app-indicador` apresenta o modelo de negócio vigente do indicador:
  Microfranqueado, Gerador de Negócios ou Gerador de Possibilidades.
- O painel exibe links curtos, copiáveis e tenant-aware para o formulário de
  intenção (`/i/{codigo}`) e para o convite do Network de Negócios
  (`/network/{codigo}`).
- A resolução da sessão do app usa o vínculo autenticado
  `usuarios → participantes_comerciais → programa_indicadores`, restrito à
  empresa ativa, e carrega o código curto e o modelo comercial do titular.
- O cadastro público de parceiro reaproveita o participante comercial criado
  pelo sincronismo de `empresa_usuarios`, evitando violação da restrição única
  de participante ativo. Falhas posteriores fazem limpeza apenas dos registros
  recém-criados pela própria requisição e retornam mensagem amigável.
- O formulário Network registra nome, telefone, atividade profissional e
  intenção de participação. O contato é consolidado em `leads`, com histórico
  da origem, e atribuído ao indicador do link sem sobrescrever uma indicação
  pertencente a outro participante.

## Banco de dados

A migration `245_convite_network_indicador.sql` cria
`programa_convites_network`, com isolamento por `empresa_id`, referência ao
indicador e ao lead, unicidade por empresa/evento/telefone e políticas RLS
compatíveis com o tenant ativo. As migrations 243, 244 e 245 foram aplicadas
em sequência no projeto Supabase vinculado.

## Segurança e preservação

- O identificador do indicador nunca é aceito do formulário: ele é resolvido
  exclusivamente pelo código curto público ou pela sessão autenticada.
- Telefones já atribuídos a outro indicador não têm sua origem sobrescrita.
- A implementação preserva cadastros existentes e não remove leads,
  participantes ou vínculos comerciais preexistentes.

## Verificação

- `npx tsc --noEmit`
- `npm run lint:errors`
- Teste contratual do fluxo de indicação pública: 7 cenários aprovados.
- `supabase db push --dry-run` antes da aplicação das migrations.
- `supabase db push` concluído com as migrations 243, 244 e 245.
