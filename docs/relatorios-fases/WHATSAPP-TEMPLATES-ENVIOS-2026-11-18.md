# WhatsApp — templates e envios automáticos (2026-11-18)

## Já existia (mantido)
- Cadastro Incorporado com coexistência (`/conectar-whatsapp`, `FB.login` com config_id, `featureType: whatsapp_business_app_onboarding`, `sessionInfoVersion: 3`), troca de `code` por token, `POST /{waba}/subscribed_apps`, sincronização `smb_app_state_sync` + `history`, webhook com `X-Hub-Signature-256` roteando por `phone_number_id`.
- A tabela pedida como `whatsapp_connections` é `whatsapp_instancias` (migration 332): N instâncias por empresa, token cifrado AES-256-GCM, status.
- Graph API v26.0 (a mais recente).

## Novo
- Migration 349: `whatsapp_templates`, `whatsapp_contatos` (contatos do celular), `whatsapp_descadastros` (SAIR/PARAR), `whatsapp_campanhas`, `whatsapp_campanha_envios` (fila), funções `whatsapp_fila_reivindicar` (SKIP LOCKED) e `whatsapp_campanha_resumo`, bucket `whatsapp-midia`.
- Telas `/erp/whatsapp/templates` (lista, sincronizar, criar com variáveis, exemplos, cabeçalho texto/imagem, rodapé, botões, prévia em balão) e `/erp/whatsapp/envios` (disparo para leads/contatos/contatos do celular/lista colada, agendamento, automação "novo lead" com atraso, ritmo por minuto, janela de horário, pausar/retomar/cancelar, progresso).
- Webhook: `message_template_status_update`, `history`, `smb_app_state_sync`, descadastro por palavra.
- Cron `/api/cron/whatsapp-envios` a cada minuto (CRON_SECRET).
- Env aceita também `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID`.

## Extrato de clientes — atalhos e novo PDF (2026-11-25)
- Lista `/erp/extrato-clientes`: cartões de enviados/pendentes do mês, e em cada cliente os atalhos Copiar mensagem (gera e copia sem abrir), Baixar PDF, Abrir e Marcar enviado.
- Mensagem centralizada em `lib/erp/extrato-mensagem.ts` (mesmo modelo salvo no navegador nas duas telas; saudação pelo primeiro nome).
- PDF novo em `lib/erp/extrato-cliente-pdf.tsx`: capa com logo Racon + Gauchinho, texto de gestão do investimento, assinaturas de Fernando e Eroni; resumo da carteira; página por cota com gráfico de evolução e assembleias; encerramento.

## Contemplação por lance recusada (2026-11-25)
- Migration 363: `cota_contemplacao_recusas` + `rpc_registrar_recusa_contemplacao` / `rpc_desfazer_recusa_contemplacao`. A recusa devolve a cota para "ativa" (sem contemplação), guarda o estado anterior para desfazer e bloqueia se a contemplação já gerou comissão.
- Clientes contemplados: coluna de modalidade (sorteio, lance livre, fixo, fidelidade); desclassificadas da Racon entram como "lance não pago"; botão "Cliente recusou" nas contemplações por lance e "Desfazer recusa".
- Extrato (tela e PDF): a assembleia em que a própria cota saiu aparece destacada como "Sua cota foi contemplada" ou "Contemplada por lance livre · lance não pago".
