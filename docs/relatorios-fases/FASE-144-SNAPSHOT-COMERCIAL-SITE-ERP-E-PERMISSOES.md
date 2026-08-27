# Fase 144 — Snapshot comercial do site, formalização no ERP e permissões

Data: 26/08/2026

Estado: concluída no código e no Supabase principal

Migration: `138_snapshot_comercial_site_preservado_no_erp.sql`

## Objetivo

Garantir que o site continue sendo a origem do cálculo comercial completo da
proposta, inclusive parcela inicial, modalidade da parcela, seguro, lance e
efeitos pós-contemplação. Depois da aceitação, o ERP deve conferir UUIDs,
participantes e comissão, gerar a cota real e formalizar a venda sem recalcular
ou substituir a condição apresentada ao cliente.

## Fluxo implantado

1. O site lê grupo e produto do catálogo SaaS autorizado para a empresa.
2. O navegador calcula a simulação para resposta imediata ao usuário.
3. Na criação da proposta, o servidor descarta os resultados financeiros
   enviados pelo navegador, recarrega grupo, cota e modalidades autorizadas e
   executa o mesmo motor TypeScript do site.
4. O servidor persiste um snapshot canônico com `versao_motor`, data, origem,
   indicador de imutabilidade e hash SHA-256 dos dados comerciais.
5. Antes de finalizar a contratação e antes da formalização no ERP, o hash é
   conferido. Alteração de valores bloqueia a operação e exige nova proposta.
6. O ERP preserva crédito e parcela aceitos; grupo e produto ficam bloqueados
   nas propostas assinadas pelo motor novo.
7. O ERP seleciona modelo de comissão, consultores, perfis e datas. A modalidade
   de comissão não é mais usada para recalcular a parcela do cliente.
8. As RPCs criam venda, cota definitiva e previsões usando os valores
   preservados. O número real da cota continua sendo atribuição operacional do
   ERP/administradora.

## Correções estruturais

- removida a dependência de `grupo_cota_modalidade_valores.valor_parcela` como
  fonte da parcela na preparação e conversão da venda;
- removido o dual-write que publicava a parcela específica de uma venda no
  catálogo global compartilhado;
- mantida a validação de grupo, cota, concessão, modalidade de comissão,
  participantes, perfis, programa e regra homologada;
- propostas legadas sem hash continuam formalizáveis pelos valores persistidos,
  sem backfill destrutivo;
- proposta nova com hash não aceita troca de grupo/cota no ERP;
- painel antigo da franquia não exibe mais editor estrutural de produtos: os
  dados oficiais são somente leitura e alterações globais permanecem no SaaS;
- alteração da apresentação local exige `gerenciar_grupos` e usa a empresa
  ativa da sessão. Qualquer `empresa_id` enviado pelo navegador é ignorado e
  divergência é bloqueada.

## Segurança e isolamento

- tenant resolvido por sessão e `empresa_usuarios`, nunca por parâmetro do
  navegador;
- hash de integridade conferido no servidor;
- UUID de grupo/cota validado contra concessão ativa;
- RPCs continuam exclusivas de `authenticated` com `formalizar_vendas`;
- nenhuma venda altera regras, taxas ou parcelas do catálogo global;
- a migration foi transacional e aplicada no Supabase principal, com histórico
  local/remoto confirmado em `001–138`.

## Compatibilidade

O contrato público da proposta e as assinaturas das RPCs foram preservados. O
snapshot adiciona metadados dentro de `dados_simulacao`, evitando alteração de
schema das propostas e permitindo que o RPC existente de materialização copie
o conteúdo integralmente para `contratacoes_online`.

## Validação

- build Next.js 16 aprovado, 147 rotas;
- `eslint --quiet` aprovado sem erros;
- suíte completa: 198 arquivos, 1.039 testes aprovados e 9 arquivos/37 testes
  live intencionalmente ignorados;
- migration aplicada no projeto `eaeuoynprurmmulzhydt`;
- `supabase migration list --linked` confirmou `001–138` alinhado.

## Limites conscientes

- a configuração local de subconjunto das modalidades de parcela do site ainda
  não possui campo próprio; nesta fase a franquia controla apresentação e o
  catálogo SaaS controla as modalidades oficiais;
- propostas legadas não podem ganhar hash retroativamente sem alterar a oferta
  histórica; por isso usam compatibilidade explícita e os valores já gravados;
- a governança completa de propostas locais de alteração de grupo, com aprovação
  e merge pela Platform, permanece no plano posterior da auditoria da Fase 141.
