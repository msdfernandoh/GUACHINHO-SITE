# WhatsApp SaaS e instâncias por franquia — 02/11/2026

## Entrega
A configuração do App Meta, dos modelos e dos números fica em /platform/whatsapp, acessível exclusivamente ao Platform Superadmin. O cadastro da franquia oferece atalho para as suas instâncias. O ERP apresenta as instâncias liberadas, conexão central com a Meta, envio e histórico real de mensagens. Credenciais são cifradas no servidor e nunca serializadas para o navegador.

Modelos iniciais: Coexistência (QR da Meta), Cloud API (Embedded Signup) e Teste Meta (token temporário, sem QR). A integração usa a versão Graph cadastrada no App (padrão v26.0), subscribe da WABA, validação do vínculo telefone/WABA e sincronização de coexistência sem registrar novamente o número.

## Decisões confirmadas pelo titular
- Commit, envio à main e deploy autorizados.
- O titular cadastrará número de teste, WABA ID, Phone Number ID, token e validade diretamente no SaaS depois do deploy.
- raconsinop.com.br utiliza hoje o ERP compartilhado da Gauchinho. Foi escolhida expressamente a instância “Racon Sinop” vinculada à Gauchinho, preservando o roteamento atual.
- Sessões temporárias do Superadmin Fernando e do administrador da Racon Sinop autorizadas somente para esta homologação, sem enviar e-mails ou mensagens; encerramento local ao final de cada verificação.

## Banco e preservação
Migration aditiva 332_whatsapp_instancias.sql aplicada em transação e registrada no histórico do projeto eaeuoynprurmmulzhydt. Migration 310 preservada. Foram criados apps, modelos, instâncias, tentativas de conexão e mensagens, com RLS, privilégios por coluna para ocultar segredos, vínculo composto de empresa/instância e auditoria. RPCs controlam módulo e reserva idempotente com limite mensal em America/Cuiaba. Configurações anteriores da empresa são preservadas.

Conferência antes/depois por contagem e hash integral de dez tabelas operacionais sem divergências: usuarios 19; empresa_usuarios 22; leads 203; propostas 131; grupos_consorcio 191; grupos_cotas 336; contratacoes_online 18; indices_financeiros 8; vendas 115; cotas_definitivas 137. Não havia conexões ou mensagens anteriores a migrar. Nenhum cliente, lead, proposta, grupo ou cota foi alterado.

App existente do ambiente importado com cifragem. Instância vazia “Teste Meta — Racon Sinop” (b9b88eb0-1f01-4805-ac53-805aa4105aab) pertence à Gauchinho (7170f38e-15dd-4b19-8588-51e9a9cf0d4c), aguardando os dados do titular. A empresa Racon Sinop independente e seus domínios foram preservados; seu módulo WhatsApp foi restaurado ao estado anterior. Reatribuição da instância vazia auditada, sem token ou mensagens.

## Segurança e funcionamento
Links centrais assinados expiram em dez minutos, são de uso único e vinculam identidade interna, empresa, instância e revisão. A autorização é revalidada por usuarios.auth_user_id e empresa_usuarios, com ERP/módulo ativos. A URL sensível é retirada do endereço antes de abrir o SDK. A página usa no-store e no-referrer.

Webhook valida HMAC com App ativo, resolve a empresa por Phone Number ID, deduplica mensagens e atualiza entrega/leitura de forma monotônica. Falhas de persistência retornam erro para permitir nova tentativa da Meta. Envio exige autenticação e modelo ativo; teste aceita somente os destinatários configurados. Aceite da API não é apresentado como entrega. Resultados incertos não são reenviados automaticamente.

Páginas públicas de termos e exclusão de dados e links nos rodapés complementam a política de privacidade existente.

## Validação
- 48 testes focados aprovados, cobrindo assinatura/expiração, acesso, RLS e privilégios no PostgreSQL PGlite, vínculo entre empresas, idempotência, limites, teste Meta, conexão, webhook e regressões relacionadas.
- Suíte geral final com acesso de rede: **1.998 testes aprovados, 37 ignorados, zero falhas** (382 arquivos aprovados, nove ignorados).
- Diagnóstico da primeira suíte geral: 1.952 testes aprovados, 37 ignorados e cinco falhas. Três eram mock desatualizado de consulta financeira, uma era contrato textual do proxy de cron e uma dependia de acesso à Caixa bloqueado no sandbox. Mock e contrato foram corrigidos e passaram no conjunto focado; o teste de Caixa passou isoladamente com acesso de rede. Nenhum comportamento financeiro foi alterado.
- Build de produção e TypeScript aprovados; 173 páginas geradas. Lint aprovado: zero erros, 324 avisos dentro do limite existente de 353.
- Homologação local do build com ambiente de produção aprovada em dez verificações: páginas legais, link inválido, assinatura e challenge do webhook, SaaS autenticado, ausência de segredos no HTML, ERP compartilhado autenticado com a instância e bloqueio de envio anônimo. Sessões temporárias encerradas. No localhost foi usado o domínio principal da Gauchinho, que resolve a mesma empresa do ERP compartilhado; raconsinop.com.br será conferido no deploy.
- Inspeção visual via Computer Use indisponível: a ferramenta encerrou o acesso ao Chrome por não conseguir confirmar com segurança a URL atual. Nenhuma ação de navegador foi realizada.
- Publicação: pendente da etapa final abaixo.

## Operação para gravar a demonstração Meta
1. No SaaS, abrir WhatsApp > Instâncias e filtrar Gauchinho. Na instância “Teste Meta — Racon Sinop”, usar Editar para informar o número de teste internacional esperado.
2. No formulário Teste Meta da mesma instância, cadastrar WABA ID, Phone Number ID, token temporário, validade futura e até cinco destinatários já autorizados no painel da Meta. O token é informado somente neste formulário de senha.
3. Confirmar no App da Meta o callback https://admin.gauchinhoconsorcios.com.br/api/whatsapp/webhook e os eventos necessários para mensagens e status. Domínios e URLs públicas estão disponíveis na aba App da Meta do SaaS.
4. Entrar no ERP em raconsinop.com.br/erp/whatsapp, selecionar a instância e enviar o template hello_world ao destinatário autorizado. Aguardar o status real e responder pelo celular para exibir o recebimento no histórico. Atualizar histórico quando necessário.
5. Gravar a configuração sem mostrar token/segredos e o envio, entrega e resposta reais. O modo Teste Meta usa número da Meta e não exige QR. Para números comerciais em coexistência, a franquia usa o QR dentro do fluxo oficial da Meta, com cadastro e direcionamento mantidos no SaaS.

A integração está preparada para a demonstração. Nenhuma mensagem real foi enviada e nenhum vídeo de troca real foi produzido nesta homologação; isso depende dos dados que o titular fornecerá no SaaS.
