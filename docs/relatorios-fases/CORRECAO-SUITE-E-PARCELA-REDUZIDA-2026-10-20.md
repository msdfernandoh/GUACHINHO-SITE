# Correção de regressões e da suíte — 20/10/2026

## Pedido e diagnóstico
O titular solicitou investigar as falhas gerais identificadas na publicação do
fechamento societário, aplicar ajustes e explicar suas causas.

O histórico localiza a mudança de seleção no commit 2a71f7fd (opções de 50% e
60%). A lista passou a oferecer [50,60], mas calcularLinhaSimulacaoGrupo ainda
usava o primeiro elemento quando config.percentualParcelaReduzida não era
informado. defaultConfigLinha já preservava o padrão do grupo; os dois caminhos
ficaram inconsistentes. O histórico não permite identificar a capacidade/modelo
do agente responsável nem atribuir todas as falhas à mesma alteração.

## Correções funcionais
1. O cálculo sem escolha explícita respeita percentual_parcela_reduzida quando
   disponível, com a mesma preferência por 60% do inicializador na ausência dele.
   Escolha explícita e valores oficiais específicos continuam prevalecendo.
   Exemplo: R$ 1.240.000 / 220 × 60% = R$ 3.381,82; selecionar 50% sem pedido
   produzia R$ 2.818,18. A correção não altera dados, taxas ou regras fiscais.
2. Na auditoria do fechamento foi identificado filtro acrescentado na fase
   anterior sobre financeiro_recebimento_itens.empresa_id, coluna inexistente.
   Corrigido para join interno com financeiro_recebimentos e filtro por
   recebimento.empresa_id. O isolamento tenant permanece explícito. Teste
   contratual confronta o schema da migration 055 com a consulta; não substitui
   smoke autenticado no Supabase de produção.
3. Campo reutilizável de login mostra CPF ou e-mail e teclado de texto quando
   aceita os dois; modo somenteCpf continua com CPF e teclado numérico.

## Correções dos testes
- Fixtures de cálculo teórico deixam parcelas oficiais nulas. Antes forneciam
  parcela_integral=4772,73, mas esperavam a fórmula=5918,18. A precedência de
  parcela oficial foi introduzida pela atualização documentada do catálogo.
  Preservar essa regra não exige alterar cotas reais para satisfazer fixtures.
- Casos de R$ 1.500.000 deixam de herdar parcelas de fixture de R$ 750.000.
- Quatro regressões adicionais verificam padrão 60%, escolha explícita 50%, valor
  oficial por modalidade e integral oficial com quantidade de cotas.
- Expectativa de modalidades passa a refletir o suporte documentado [50,60].
- Referência de migration 301 é corrigida para a migration canônica 314.
- Contratos textuais atualizados para os componentes e fluxos atuais. Testes de
  repasse verificam wrapper 242, correção 322, impedimento de troca de previsão
  paga, auditoria e reversões append-only; não restauram o fluxo obsoleto.
- Contrato de formalização mantém parcela aceita com ajuste promocional
  explícito; deixa de exigir nome de variável que antecedia essa funcionalidade.
- SEO usa serviços públicos simulados para testar URLs, sem depender de rede e
  credenciais reais. Não foi aumentado o timeout para esconder a causa.
- Suíte limita a quatro workers para evitar concorrência excessiva de bancos
  PGlite/WASM. Instância da homologação 220 é fechada em afterAll.
- Nenhum teste foi removido ou desativado e nenhuma asserção foi substituída
  simplesmente pelo valor observado; expectativas foram conciliadas com o
  contrato/documentação atual e as fontes correspondentes.

## Lint global
A ampliação da validação encontrou um erro prefer-const em erp/robos/actions.ts,
preexistente em HEAD: configs não é reatribuído. Corrigido sem alterar o fluxo.
O comando npm run lint também apresenta 669 avisos e excede o teto 353 do
package.json. O teto e as regras não foram relaxados. O comando lint:errors é
verificado separadamente para distinguir erro de dívida de avisos. Principais
avisos: 312 no-explicit-any e 257 no-unused-vars, além de hooks e acessibilidade.
Não se declara npm run lint aprovado enquanto essa dívida exceder o teto.

## Preservação
Sem migrations novas, backfill, escrita em banco remoto ou alteração de dados
históricos. PGlite executa somente banco isolado em memória. Multitenancy,
permissões e contratos financeiros permanecem preservados.

## Validação
Suíte final: 350 arquivos aprovados e 9 ignorados; 1.813 testes aprovados,
37 ignorados e zero falhas. Os ignorados já eram testes de integração opt-in.
TypeScript, lint:errors e build final de produção aprovados após a correção de schema.
Consulta PostgREST com join e filtro do fechamento validada no Supabase com
HTTP 200, limit(0), sem buscar registros nem gravar dados.
A aprovação local não equivale à homologação autenticada de produção.
