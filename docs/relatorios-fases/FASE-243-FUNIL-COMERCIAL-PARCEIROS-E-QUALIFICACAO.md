# Fase 243 — Funil Comercial de Parceiros e Qualificação

## Objetivo

Substituir o protótipo resumido das landings de parceiros por uma jornada comercial orientada à conversão, com comparações, cenários de ganho e coleta de contexto para o atendimento.

## Entrega pública

- `/parceiros` agora apresenta hero comercial, pilares de estrutura, comparação objetiva dos três modelos, bloco de network semanal, suporte entregue pela operação e CTA final.
- Cada rota de modalidade exibe público indicado, condições, tabela de projeção mensal/12/24 meses e um simulador interativo de produção mensal.
- As projeções usam exclusivamente a premissa de comunicação aprovada: R$ 1 milhão de produção gera R$ 33 mil de base líquida; o percentual exibido é aplicado sobre essa referência. A interface traz aviso explícito de estimativa, validação da operação, recebimento efetivo, cancelamentos, inadimplência e estornos.
- O botão de acesso ao app permanece após a conclusão do cadastro, para não desviar a decisão principal da conversão da landing.

## Cadastro e dados

- O fluxo conversacional passa a coletar cidade, estado, profissão, experiência em consórcio, modelo desejado, rede de relacionamento, potencial mensal, interesse no Network de terça-feira, PIX e observação opcional.
- A migration `233_programa_parceiros_origem_e_qualificacao.sql` adiciona os campos de qualificação e de atribuição (`origem_cadastro`, `pagina_origem`, `utm_source`, `utm_medium`, `utm_campaign`) em `programa_indicadores`.
- A API pública grava esses dados após criar, de maneira controlada, a identidade, o vínculo N:N da empresa, o participante comercial e o indicador. A modalidade comercial efetiva continua Nível 1/`INDICADOR`; solicitações superiores continuam registradas como `EM_ANALISE`.

## Segurança e preservação

Não houve alteração de regras de comissão, permissões, escopo de ERP ou dados existentes. A migration é somente aditiva; acesso financeiro continua protegido por autenticação e pelo vínculo `usuarios → empresa_usuarios → participantes_comerciais`.

## Validação

- `npx tsc --noEmit`
- `npm run lint:errors`
