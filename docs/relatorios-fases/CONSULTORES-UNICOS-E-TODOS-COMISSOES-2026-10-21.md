# Minhas comissões: seleção única de consultor e visão Todos

Data: 21/10/2026. Implementação local; sem publicação ou alteração do banco.

## Pedido e diagnóstico

O seletor listava diretamente participantes_comerciais ativos, repetindo nomes.
A consulta somente leitura confirmou duplicatas de Cleusa, Eroni e Fernando Hugo
Leandro na empresa Gauchinho. Há contas de acesso distintas e registros comerciais
sem usuário, portanto excluir/fundir identidades de login automaticamente seria
inadequado. Perfis de comissão já são N:N e independentes da identidade comercial;
a venda continua determinando o perfil/programa e conservando seu snapshot.

## Alterações

- Uma opção por nome completo normalizado no seletor, reunindo todos os IDs do
  legado no extrato e no resumo mensal de vendas. Não descarta previsões repetidas:
  cada parcela original continua um fato individual. Documentos diferentes
  impedem agrupamento de homônimos.
- Todos os consultores para os perfis já autorizados a consultar equipe, sempre
  dentro da empresa ativa. Coluna Consultor identifica cada parcela.
- Consultor comum consulta exclusivamente registros ligados ao próprio usuario_id,
  mesmo ao manipular participante=todos ou identificadores na URL.
- Leitura das previsões paginada em 500 linhas, ordenada por competência e ID.
- Produção mensal recebe o conjunto de participantes e deduplica por venda, para
  não contar várias vezes vendas compartilhadas no modo Todos.
- Pagamentos revalidam o grupo no servidor e continuam separados pelo participante
  original, organização e competência, incluindo essas dimensões na idempotência.
  Todos é uma visão de consulta; selecionar um consultor permite operar.
- Ajuste de parcelas usa o participante original da seleção e conserva a validação
  de mesma venda/cadastro no servidor.
- Cadastro manual recusa repetição de nome normalizado, CPF ou usuário e orienta
  reutilizar cadastro, adicionar perfis e escolher o modelo na venda.

## Preservação e limites

Nenhum cadastro, login, perfil, previsão, pagamento ou movimento foi excluído ou
reescrito. Nenhuma migration. A consolidação é de apresentação/consulta do legado,
não fusão física de contas. FERNANDO (abreviado), Fernando Hugo Leandro e contas
com TESTE permanecem distintos, sem inferir identidade por nome parcial. A guarda
no formulário manual não substitui uma futura constraint transacional para todos
os canais de cadastro. A edição da identidade e outros canais não foram alterados.
O modo Todos mantém o escopo preexistente de participantes ativos.

## Verificação

- 12 testes aprovados em quatro arquivos: agrupamento, preservação de IDs,
  homônimos/documentos distintos, nomes parciais, equipe vazia, permissões,
  crédito societário e resumo mensal sem dupla contagem.
- TypeScript: aprovado.
- ESLint direcionado: zero erros, dois avisos preexistentes.
- Consulta Supabase somente leitura validou os campos usados. Referência observada:
  364 parcelas não canceladas, R$ 236.844,16 previstos e R$ 47.782,18 pagos.
- Build de produção: aprovado (Next.js 16.3.0).
- Não executado pagamento de teste nem alteração financeira remota.
