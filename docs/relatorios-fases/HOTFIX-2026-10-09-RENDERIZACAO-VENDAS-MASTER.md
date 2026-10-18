# Hotfix — Renderização de Vendas para o master

Data: 09/10/2026. Escopo: GAUCHINHO SITE.

## Diagnóstico comprovado

A conta informada possui identidade ativa e vínculo N:N ativo com papel
`admin_empresa`, herdando os módulos da empresa. Consultas somente leitura ao
Supabase canônico `eaeuoynprurmmulzhydt` não reproduziram falhas nas relações de
vendas, cotas, comissões ou no resumo mensal de participação.

Smoke autenticado no domínio Racon Sinop antes da correção: `/erp/vendas`
retornou HTTP 500; `/erp/minhas-comissoes` retornou HTTP 200 com seu conteúdo.
A sessão temporária de validação foi encerrada sem alterar senha ou vínculos.

O teste de renderização de Vendas com consultor reproduziu exatamente
`ReferenceError: Cannot access 'normalizarBusca' before initialization`.
O `useMemo` do seletor utiliza a função antes da inicialização da constante.

## Correção

- A normalização passa a ser uma declaração de função, disponível durante toda
  a execução do componente, preservando o comportamento da busca e dos filtros.
- A rota física `/erp/vendas` recebe layout com `requireErpRouteAccess('vendas')`,
  preservando a mesma autorização de módulo da rota dinâmica anterior.
- Teste efetivo de renderização com venda, consultor e cota protege a regressão.

Não houve migration, escrita em fatos comerciais/financeiros, alteração de
permissões, senha, regras, snapshots ou cálculos históricos.

## Validação

- Regressão reproduzida antes da correção e aprovada depois.
- 49 testes em 13 arquivos aprovados: renderização, filtros, boletos,
  resumo mensal, comissões e matriz de acesso ERP. Três testes live já
  desativados permanecem ignorados e não contam como evidência.
- Um contrato textual antigo de competência esperava a expressão anterior ao
  hotfix de datas nulas; foi atualizado para os fallbacks atuais e para ignorar
  espaços, sem mudança da lógica de datas nesta entrega.
- TypeScript sem erros.
- Build local de produção aprovado. Lint do escopo: zero erros, 20 avisos
  existentes no componente de Vendas.
- Smoke autenticado após publicação em `www.raconsinop.com.br`: Vendas e
  Minhas Comissões retornaram HTTP 200, sem redirecionamento ou marcador de
  erro de renderização. Conteúdos de Vendas, Controle de Boletos e Minhas
  Comissões foram identificados no HTML. Sessão de teste encerrada.

## Operação e reversão

Publicado em produção no deployment `dpl_5HFG4ALLPwGUrHJCsmtvUg7hC3Ck`,
URL `https://guachinho-site-is6kr9gle-hugo-8097s-projects.vercel.app`, com
compilação remota aprovada e aliases atualizados. Reversão de aplicação por deployment
anterior; nenhuma reversão de banco é necessária. Minhas Comissões já respondeu
corretamente no smoke autenticado anterior à publicação.
