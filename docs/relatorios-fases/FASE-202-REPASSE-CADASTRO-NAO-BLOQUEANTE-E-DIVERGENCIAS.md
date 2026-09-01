# Fase 202 — Repasse: cadastro não bloqueante e divergências explícitas

## Objetivo

Separar pendências cadastrais do cliente das pendências financeiras do repasse e esclarecer as decisões aplicáveis quando o valor do sistema diverge do relatório da administradora.

## Entregas

- CPF/CNPJ e telefone ausentes aparecem somente como aviso cadastral do cliente.
- O comando de cadastro mínimo cria cliente, cota, comissão e vínculo na mesma operação e resolve imediatamente a linha do relatório.
- A central de divergências explica o efeito de cada escolha.
- `Ajustar no sistema` adota o valor do relatório na conciliação, preservando o snapshot histórico da regra.
- `Dar por ajustado · manter como está` encerra a atenção sem mudar os valores apresentados.
- A decisão `MANTER_COMO_ESTA` foi adicionada ao contrato do banco com autorização tenant-aware, idempotência e registro append-only.

## Preservação

Nenhum cliente, comissão, recebimento ou lançamento histórico é excluído. Ajustes financeiros continuam sendo representados por classificação ou resolução compensatória, sem reescrever o livro de caixa nem os snapshots de regras usados no passado.

## Verificação

- Teste de contrato da Fase 197 para cadastro não bloqueante, escolhas explícitas, isolamento tenant, idempotência e append-only.
- Testes anteriores da central de atenção atualizados para a nova nomenclatura.
