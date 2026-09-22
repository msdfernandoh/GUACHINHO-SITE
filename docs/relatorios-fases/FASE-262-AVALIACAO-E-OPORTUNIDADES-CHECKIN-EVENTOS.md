# Fase 262 — Avaliação e oportunidades no check-in de eventos

## Objetivo

Acrescentar ao final do check-in conversacional dos eventos duas perguntas
comerciais: avaliação do conteúdo apresentado e momento atual do participante.
Quando a avaliação indicar que o encontro pode melhorar, o comentário passa a
ser obrigatório.

## Implementação

- o fluxo conversacional passou de três para cinco perguntas de qualificação;
- a barra visual agora acompanha sete telas, incluindo identificação e WhatsApp;
- as novas respostas são validadas novamente no servidor, inclusive o texto
  condicional de melhoria;
- os valores são armazenados no JSON `qualificacao_respostas`, preservando a
  separação do domínio de NPS e sem migration destrutiva;
- o histórico do lead registra a avaliação, a sugestão de melhoria e o próximo
  passo escolhido;
- a tela de detalhes do lead e a exportação XLSX de participantes exibem os
  novos dados;
- o componente compartilhado atende tanto `/eventos/[slug]/sorteio` quanto os
  QR codes permanentes vinculados a eventos com check-in interativo.

## Validação

- `npx tsc --noEmit --pretty false`;
- `npx vitest run src/lib/eventos-sorteio/checkin-conversacional.test.ts src/lib/comercial-eventos/participantes-enriquecidos.test.ts` — 20 testes aprovados;
- `npm run build` — compilação de produção concluída com sucesso.

## Preservação e multiempresa

Nenhum dado histórico foi removido ou transformado. As respostas adicionais
são opcionais para registros anteriores e obrigatórias somente nas novas
submissões do formulário atualizado. O evento e o lead continuam sendo
resolvidos no tenant já definido pelo fluxo existente.
