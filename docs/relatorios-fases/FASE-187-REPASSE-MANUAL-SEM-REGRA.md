# Fase 187 — Repasse manual independente de regra

## Incidente

O cadastro de uma linha antiga do relatório ainda podia exigir a seleção de uma
regra do consultor. A validação nativa do formulário impedia a criação do
cliente, grupo, cota e comissão, mesmo com o valor informado pelo PDF.

## Correção

- removido o seletor de regra do cadastro mínimo;
- o valor da comissão passa a ser sempre o valor exato da linha do relatório;
- a ação do servidor envia obrigatoriamente `p_sem_regra=true` e regra nula;
- a migration `184` protege o contrato no banco e ignora regra mesmo quando uma
  versão antiga da tela enviar os campos anteriores;
- permanecem obrigatórios apenas cliente, grupo, cota e consultor;
- cliente e grupo inexistentes continuam sendo criados com pendências
  cadastrais e sem publicação no site.
