# Hotfix — versão única da integração WhatsApp/Meta

Data: 18/10/2026.

## Diagnóstico

O painel fornecido pelo titular mostra v26.0. O código possuía padrão v23.0
no servidor e resolução independente na página, com precedência da variável
NEXT_PUBLIC_WHATSAPP_GRAPH_VERSION. Não foram encontradas URLs literais
facebook.com/v26.0 na implementação. A diferença entre as URLs de abertura e
fechamento da Meta não comprova, isoladamente, duas chamadas no código do ERP.
Os erros anteriores mostram rejeição de domínio pela Meta; o titular informou
ter cadastrado e salvo os domínios. Essa configuração externa não foi verificada
em sessão administrativa pelo agente.

## Correção

- config.ts: WHATSAPP_GRAPH_VERSION permanece como configuração única do servidor,
  agora com padrão v26.0.
- page.tsx: passa exatamente essa constante ao cliente e, por consequência, a FB.init.
  A variável pública histórica deixa de poder causar divergência com o servidor.
- Script de provisionamento: as duas variáveis de versão passam a v26.0.
  O script completo não deve ser executado para este hotfix, pois gera outro
  token de verificação de webhook. Somente as variáveis de versão serão atualizadas.
- Nenhuma alteração em App ID, config ID, segredos, token do webhook, tabelas,
  vínculos N:N, RLS ou dados comerciais. Alterações locais de outros módulos
  ficam fora do pacote desta publicação.

## Validação e publicação

- TypeScript local: `npx tsc --noEmit`, exit 0.
- ESLint direcionado: zero erros e um aviso preexistente de setState no efeito
  de carregamento do SDK em ui.tsx. Arquivos alterados sem erros de diff check.
- WHATSAPP_GRAPH_VERSION e NEXT_PUBLIC_WHATSAPP_GRAPH_VERSION atualizadas para
  v26.0 na Vercel Production. Variáveis locais de versão também alinhadas.
- Publicação isolada do baseline HEAD com somente os arquivos deste hotfix,
  preparada em tmp dentro do repositório; alterações locais alheias não enviadas.
- `vercel --prod --yes`: exit 0, build e TypeScript aprovados.
  Deployment: `https://guachinho-site-6hk1hs3su-hugo-8097s-projects.vercel.app`.
- Smoke no domínio `https://www.gauchinhoconsorcios.com.br` usando variáveis
  efetivas de Production, sem expor seus valores:
  - GET Graph v26.0 do app: HTTP 200, ID 1412730744263214 e app_domains contendo
    gauchinhoconsorcios.com.br e www.gauchinhoconsorcios.com.br.
  - GET do webhook com desafio: HTTP 200 e corpo exatamente igual ao desafio.
  - GET autenticado de /erp/whatsapp: HTTP 200, botão Conectar WhatsApp e única
    graphVersion serializada igual a v26.0.
  - Sessão temporária sem envio de e-mail, encerrada com escopo local ao final.
- Primeira tentativa de smoke com .env.local retornou Meta 401 e webhook 403;
  o reteste com as variáveis efetivas de Production passou integralmente. Isso
  evidencia credenciais locais divergentes, não falha do runtime publicado.
- A lista app_domains foi confirmada por API; a lista específica do JSSDK não
  foi inspecionada no painel. A tentativa de teste pelo navegador foi bloqueada
  porque o uso do navegador local está desativado nas configurações do Work.
  A abertura real do QR e a conexão do telefone permanecem pendentes de teste
  interativo pelo titular; HTTP 200 não as comprova.
