# QR Codes fixos de ações externas e palestras — 21/10/2026

## Pedido e diagnóstico

Usar um único endereço impresso por modalidade em todos os eventos, sem gerar
QR específico por edição. O modal oferecia três alternativas e calculava URLs
com `window` durante a renderização inicial. No domínio parceiro Racon, `/qr`
não constava entre as rotas operacionais preservadas pelo proxy: o acesso podia
ser reescrito para a home institucional.

Consulta somente leitura ao Supabase configurado na aplicação confirmou os
QRs ativos `externo` e `network`, este último já cadastrado como Network de
Negocios. A ação externa ativa consultada foi Novo Horizonte - Sorteios.
Nenhum registro foi criado, atualizado ou excluído.

## Implementação local

- QR de ação externa usa sempre `/qr/externo`.
- QR de palestra/evento presencial reutiliza sempre `/qr/network`.
- Ambos mantêm o domínio atual; cópia, abertura, PNG e SVG usam o mesmo valor.
- Removidas as abas de QR por edição e de totem do modal de check-in. Os
  cadastros/vínculos históricos de totens continuam preservados.
- URLs são calculadas ao abrir o modal, permitindo renderização no servidor.
- PNG permanece em 1200px com fundo/margem branca; SVG também recebe zona
  branca de impressão. Nomes dos arquivos não dependem do slug do evento.
- `/qr` foi incluído na lista operacional de sites parceiros, conservando o
  contexto e os gates existentes do proxy.
- `externo` resolve apenas ações externas ativas, pela atualização mais recente.
- `network` resolve apenas eventos presenciais ativos, pela data mais recente,
  com desempate por ID. Isso evita selecionar eventos históricos antigos que
  continuam marcados ativos. Disponibilidade/horário da palestra permanece
  sob o resolvedor existente; externo conserva o fluxo sempre disponível.
- Leitura do resolvedor de QR usa `noStore` para consultar o destino atual.
- Sem evento ativo correspondente, retorna indisponibilidade, sem selecionar
  outra modalidade. Outros slugs continuam no fluxo legado de vínculos.

## Preservação e limites

Sem migration, escrita remota, alteração de participantes, leads, prêmios,
presenças, recorrências, políticas ou permissões. O schema consultado de eventos
e QR Codes ainda não possui `empresa_id`; esta correção mantém o módulo legado
e os gates operacionais existentes, sem alegar que sua tenantização foi feita.
O host parceiro segue resolvido para sua empresa proprietária pelo proxy.

O critério interno é data mais recente entre eventos ativos: se houver várias
palestras futuras ativas, a de maior data será o destino. A tela informa esse
critério. Não foram inativadas palestras históricas automaticamente.

## Validação

- 15 testes direcionados aprovados: estabilidade dos endereços, separação de
  modalidades, troca da ação externa, seleção de palestra, ausência de evento,
  QR inativo, sorteio indisponível, SSR sem `window` e contrato do proxy.
  Dois testes executam o proxy com NextRequest no domínio Racon, confirmando
  ausência de rewrite e substituição de header de tenant injetado pelo contexto
  confiável do parceiro.
- TypeScript sem emissão aprovado.
- ESLint dos arquivos alterados aprovado, sem avisos.
- Build de produção aprovado.
- Tentativa HTTP no servidor local com Host Racon retornou o gate 404 “Site não
  configurado para este domínio”, inclusive com flag de parceiro no processo;
  não constitui homologação HTTP do domínio real. Servidor de teste encerrado.

## Publicação e reversão

Envio à `main` autorizado pelo titular em 21/10/2026, junto à correção de
permissões de Contas a Pagar. Validação conjunta: 31 testes aprovados em sete
arquivos. O envio ao Git não confirma deploy. Os endereços só
devem ser homologados para impressão após publicar e conferir os dois fluxos
no domínio de produção, inclusive a disponibilidade da palestra selecionada.
Reversão por retorno dos arquivos de aplicação; nenhum dado requer reversão.
