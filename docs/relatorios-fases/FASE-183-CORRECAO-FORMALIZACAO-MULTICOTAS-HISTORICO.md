# Fase 183 — Correção da formalização multicotas e histórico operacional

## Incidente

Ao confirmar uma venda com duas cotas, a RPC da fase 168 concluía a geração dentro da transação e tentava registrar `COTAS_DEFINITIVAS_GERADAS`. A constraint legada `contratacoes_formalizacao_historico_evento_check` não reconhecia esse evento, rejeitava o último insert e revertia atomicamente venda, cotas e quantidade.

Além disso, `contratacoes_online.quantidade_cotas` foi criada com `DEFAULT 1`. A leitura da tela priorizava essa coluna antes da quantidade explícita do snapshot comercial, fazendo contratações antigas de duas cotas reaparecerem como uma.

## Correção

- A migration `180_corrige_historico_formalizacao_multicotas.sql` recria a constraint com o vocabulário anterior e acrescenta `VENDA_FORMALIZADA` e `COTAS_DEFINITIVAS_GERADAS`.
- Contratações ainda sem venda, com coluna igual a 1 e quantidade explícita entre 2 e 100 no snapshot, são reconciliadas de forma determinística.
- Nenhuma venda ou cota definitiva existente é atualizada, removida ou recriada.
- `obterQuantidadeCotasContratacao` passa a priorizar a quantidade explícita do snapshot e usa a coluna persistida como fallback para snapshots antigos.

## Segurança e preservação

A correção mantém uma venda total e N cotas, não altera crédito ou parcela aceitos, não relaxa validações de tenant, catálogo, comissão ou snapshot e não cria fixtures. A contratação exibida no incidente não foi alterada durante os testes locais.

## Validação

- Testes direcionados das fases 168/177 e da resolução de quantidade: 10 aprovados.
- TypeScript: aprovado.
- Suíte completa: 229 arquivos aprovados e 9 ignorados; 1.220 testes aprovados e 37 ignorados.
- Build de produção: aprovado, com 149 rotas geradas.
