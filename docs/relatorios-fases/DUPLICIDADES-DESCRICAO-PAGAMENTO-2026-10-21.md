# Checagem ampliada de contas e alerta no fechamento — 21/10/2026

## Causa confirmada

O detector anterior exigia fornecedor normalizado idêntico, mesmo valor e mesma
competência (ou vencimento sem competência). Os três pares apontados não tinham
fornecedor idêntico. Piscineiro e Salário ainda tinham uma ocorrência de agosto
e outra de setembro, embora ambas tenham sido pagas em 24/09/2026.

| Possível repetição | Valor de cada lançamento | Cadastro antigo | Cadastro manual |
| --- | --- | --- | --- |
| Piscineiro | R$ 350,00 | Prestador de Serviço; competência agosto | Ronaldo piscineiro; competência setembro |
| Salário | R$ 2.500,00 | Folha de Pagamento; competência agosto | Gauchinho consorcios; competência setembro |
| Madalena | R$ 1.500,00 | Salario Zeladora / Maria Madalena de Jesus Macedo | Madalena / Salario Madalena |

Não há evidência suficiente para determinar automaticamente qual lançamento
deve ser excluído: competências diferentes também podem ser pagamentos de duas
obrigações legítimas. Nesta fase nenhuma despesa, banco ou saldo foi alterado.

## Alterações

- Preservada a regra anterior de fornecedor + valor + competência.
- Acrescentado mesmo valor e descrição igual ou nome/serviço significativo
  compartilhado entre descrição e fornecedor, dentro da mesma competência ou
  mesmo mês de pagamento. Apenas contas efetivamente pagas usam pago_em.
- Termos genéricos como salário, serviço, manutenção e escritório não bastam
  para associar despesas diferentes. Valores monetários são comparados em centavos.
- Grupos exibem os motivos e destacam competências diferentes. Cada linha
  identifica fornecedor e competência para apoiar a decisão.
- Lista de possíveis repetidas carrega automaticamente ao abrir Contas a pagar.
- Consulta paginada por empresa extraída para serviço compartilhado: Contas a
  pagar e Fechamento dos sócios usam as mesmas contas e decisões registradas.
- Fechamento exibe aviso vermelho no topo, linhas/descrições/valores em vermelho
  e link para a lista de checagem. Vale para linhas ainda não conferidas.
- Manter preserva decisão por snapshot; excluir usa action financeira canônica.
  Nenhuma exclusão automática ou remoção dos valores do cálculo do fechamento.

## Validação

Executada a função nova sobre todas as contas abertas/pagas não excluídas da
empresa, retornando quatro grupos: Salário, Piscineiro, Madalena e
Papelaria/Envelopes (duas contas de R$ 54,72, mesmo fornecedor e competência).
Os três pares solicitados foram encontrados. Despesas diferentes que apenas
compartilhavam a palavra escritório foram corretamente separadas.

34 testes passaram em seis arquivos: exemplos reais reproduzidos, meses
diferentes, salários de pessoas diferentes, decisões de manter, invalidação de
revisão, paginação, isolamento de empresa, exclusão canônica e fechamento.
TypeScript sem erros. Build de produção validado antes do envio.

Sem migration, mudança de permissões, escrita remota ou ajuste financeiro.
