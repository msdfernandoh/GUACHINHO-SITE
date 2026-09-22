# Fase 266 — Evento no painel e acompanhante

## Objetivo

Dar visibilidade imediata ao evento ativo no app do indicador e contabilizar
corretamente a vaga de acompanhante nos convites realizados pelo aplicativo.

## Entregas

- O painel principal exibe, antes de **Meus indicados**, o evento ativo com nome,
  dia, horário e quantidade de vagas disponíveis.
- O card possui atalho direto para convidar uma pessoa para essa edição.
- O formulário pergunta se o convidado levará acompanhante e, em caso positivo,
  solicita o primeiro nome.
- Uma inscrição sem acompanhante consome uma vaga; com acompanhante, duas vagas.
- A ocupação é materializada em `eventos_participantes`, fonte oficial usada
  pelo site e pela administração para calcular vagas.
- Quando o limite não comporta a quantidade solicitada, a participação fica em
  `lista_espera` e não reduz as vagas restantes.
- Reenvios para o mesmo evento e lead atualizam a participação existente, sem
  duplicar o consumo de vagas.
- Convites recebidos sem evento ativo preservam os dados do acompanhante na
  fila pendente e contabilizam as vagas quando forem vinculados posteriormente.

## Banco de dados

A migration 250 acrescenta `tem_acompanhante`, `nome_acompanhante` e
`quantidade_vagas` às filas de convite e aos itens das listas. A migration foi
aplicada no banco vinculado e registrada no histórico.

## Validação

- TypeScript e ESLint sem erros;
- testes contratuais das fases 264, 265 e 266;
- build de produção;
- conferência do evento ativo e de sua capacidade no banco vinculado.
