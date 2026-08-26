# Fase 130 — Transparência Fiscal das Comissões

Data de implementação local: 26/08/2026  
Migration: `130_comissoes_transparencia_fiscal_vinculo_previsoes.sql`  
Estado: implementada e validada localmente; Production pendente.

## Objetivo

Mostrar no extrato mensal do participante o valor líquido depois do imposto e, quando autorizado pela empresa, a composição entre bruto proporcional, imposto abatido e líquido, usando exclusivamente os snapshots históricos do motor de comissão.

## Regra contábil

A previsão da franquia já congela:

- `valor_bruto`;
- `percentual_imposto`;
- `valor_imposto`;
- `valor_liquido`.

A previsão do participante é calculada sobre o líquido da franquia. Para explicar o impacto fiscal sem duplicar o bruto da franquia, a interface atribui ao participante a mesma proporção que sua comissão líquida representa no líquido da franquia:

`proporção = líquido_participante / líquido_franquia`

`bruto_proporcional = bruto_franquia × proporção`

`imposto_proporcional = imposto_franquia × proporção`

O valor financeiro efetivo do participante continua sendo `comissao_previsoes_participantes.valor_previsto`. Nenhum fato é recalculado ou atualizado pela interface.

## Integridade do vínculo

A migration 130:

- recupera `previsao_franquia_id` de snapshots V2 antigos somente quando empresa e venda coincidem;
- adiciona FK forward-only para novos vínculos;
- cria trigger que rejeita previsão da franquia de outra empresa ou venda;
- cria índices por empresa, participante, competência e previsão da franquia.

## Visibilidade

O participante sempre vê o valor líquido. A abertura de bruto e imposto respeita `empresa_configuracoes_fiscais.participante_exibe_detalhes_fiscais` vigente.

Quando habilitado, o card do período mostra:

- bruto proporcional;
- imposto abatido;
- líquido do participante.

A tabela mensal passa a identificar explicitamente `Líquido gerado`, evitando chamar um valor líquido de apenas “Gerado”.

## Vigência fiscal

Alterar o percentual fiscal hoje não altera previsões históricas. A tela usa os valores congelados em cada previsão da franquia. A configuração vigente é usada somente para decidir a transparência visual e pelo motor na geração de previsões futuras.

## Validação

- build e TypeScript: aprovados;
- 146 páginas geradas;
- 6 testes contratuais específicos adicionados;
- suíte completa obrigatória antes do commit.
