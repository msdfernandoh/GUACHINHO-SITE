# Robô parado na seleção Microsoft — 27/10/2026

## Sintoma e diagnóstico

Captura fornecida pelo titular mostra o primeiro robô repetindo “Conta selecionada
na lista inicial de contas. Aguardando...” após enviar a identificação Microsoft.
O código buscava textos de uma conta fixa em todos os elementos da página,
incluindo elementos ocultos, e executava `element.click()` sem comprovar transição.
Também considerava a mera existência de `#tilesHolder` como tela de escolha,
mesmo quando oculto, e tratava qualquer botão `idSIButton9` como confirmação de
“Continuar conectado?”. Isso permite falsos cliques e repetições sem progresso.

Não houve inspeção da sessão remota nem confirmação da tela Microsoft real dessa
execução. As capturas locais disponíveis são anteriores ao incidente; a causa
visual específica em produção ainda depende de nova execução com a correção.

## Correção

- Helper `scripts/robo-microsoft-login.mjs` identifica etapas visíveis e prioriza
  erros e verificação humana antes de preencher credenciais.
- Seleção de conta usa o login completo configurado no robô, comparado sem
  distinção de maiúsculas, e somente controles visíveis/interativos. Nenhum nome
  pessoal, usuário fixo ou domínio genérico decide qual conta selecionar.
- Sem correspondência, pode abrir o controle “Usar outra conta”; nunca seleciona
  uma conta diferente pelo mesmo domínio.
- Clique Playwright respeita visibilidade e disponibilidade; confirmação KMSI
  exige texto da tela correspondente.
- Após cada ação, aguarda mudança real de etapa por até 12 segundos; sem progresso,
  encerra com erro claro, sem repetir cliques ou enviar a senha novamente.
- Limite global do login inicial: 90 segundos. Senha incorreta, MFA, CAPTCHA ou
  bloqueio encerram com motivo específico. Logs novos não incluem login ou senha.
- O seletor intermediário do Newcon reutiliza correspondência exata e espera
  limitada, preservando o fluxo existente de consentimento e coleta.
- O tratamento de falha existente registra `ERRO` e captura local para diagnóstico.
  Sem alteração de schema, permissões, credenciais, dados comerciais ou financeiros.

## Validação

Oito testes de navegador Chromium/Playwright com páginas locais e requisições
interceptadas: seletor oculto/KMSI, conta exata entre múltiplas contas, texto sem
controle, clique sem efeito (uma tentativa), erro de senha sem reenvio, MFA sem
clique genérico, fluxo completo e “Usar outra conta”. Todos aprovados.

Nenhuma credencial real, portal real, Supabase ou importação foi acionado pelos
testes. Homologação autenticada do portal real permanece pendente.

## Disponibilização

Correção no processo-filho local usado pelo daemon: a próxima execução iniciada
por este checkout carrega o novo helper. Uma execução já iniciada mantém o código
anterior. Em outras máquinas, é necessário atualizar o checkout do runner junto
com os arquivos auxiliares. Deploy Vercel isolado não atualiza um runner externo.

Envio à main segue a autorização do titular nesta conversa. Não foi disparada
nova execução operacional nem interrompido processo existente nesta fase.
