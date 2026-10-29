# Evento externo: WhatsApp da equipe por evento — 29/10/2026

## Entrega

O botão final “Falar com nossa equipe no WhatsApp” tinha número fixo no componente do check-in. Foi criado o campo opcional **WhatsApp da equipe neste evento**, no topo do cadastro/edição de evento externo, acima das demais informações. Entrada type=tel com máscara brasileira, DDD e validação no servidor; aceita colar o prefixo +55. Telefone incompleto não é salvo.

O número pertence a public.eventos.whatsapp_equipe. O QR permanente /qr/externo mantém seu endereço e resolução do evento ativo. A view pública passa o telefone do evento resolvido ao formulário. Tanto o QR único quanto /eventos/[slug]/sorteio usam esse contato. Eventos sem configuração mantêm o número anteriormente fixo: (66) 99912-6120. Campo vazio restaura esse padrão.

O formulário de palestra não mostra o campo e não o apaga ao salvar outros dados. Após salvar/refrescar o evento, o estado do campo é alinhado ao valor persistido. O salvamento não ignora silenciosamente erro de coluna ausente. Nenhum contato de evento foi escolhido em nome do titular.

## Banco e preservação

Migration aditiva gerada pela CLI: 20261029211116_eventos_whatsapp_equipe_por_evento.sql. Executada somente essa migration no projeto vinculado eaeuoynprurmmulzhydt por db query --linked --file, acrescentando coluna text nullable e comentário; sem backfill, DELETE ou reescrita de eventos. O schema cache recebeu reload. Versão registrada como aplicada no histórico por migration repair após conferir a execução.

SELECT antes/depois confirmou 13 eventos preservados e zero contatos personalizados, mantendo o comportamento padrão até o administrador preencher um número. Clientes, participantes, leads, prêmios, inscrições e o cadastro dos QR Codes não foram modificados.

## Validação

- 155 testes em 28 arquivos aprovados, incluindo cadastro renderizado com telefone mascarado no topo; ausência do campo em palestra; normalização e rejeição de telefone parcial; mapeamento público do contato atualizado; botão final real renderizado com dois números distintos e fallback; mesmo QR selecionando o telefone de outra edição ativa.
- TypeScript integrado ao build, build de produção e lint direcionado aprovados.
- Testes de renderização/leitura usam fixtures. Nenhum participante real foi cadastrado e nenhum telefone real de evento foi alterado para teste.

Uso: abrir Eventos → editar/criar evento → escolher Evento externo → preencher o WhatsApp da equipe no topo → salvar. O botão final passa a usar esse número quando o QR abrir aquele evento. Não é preciso gerar ou reimprimir o QR.

Publicação e conferência do deployment devem ser registradas pelo resultado efetivo; esta versão documenta implementação e banco aplicados.
