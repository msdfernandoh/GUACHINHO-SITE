# Fase 185 — Repasse: vínculo amplo, cadastro mínimo e simplificação de UX

## Decisão de UX

A conciliação do PDF passa a ser o único ponto de confirmação do recebimento
nesta tela. O motor administrativo completo, que repetia valor, motivo, data,
confirmação e transferência de saldo, foi removido da página de repasse; regras
e caixa continuam acessíveis pelos atalhos próprios.

## Regras entregues

- vínculo manual mostra todas as previsões abertas da mesma administradora,
  independentemente da competência, exibindo o mês em cada opção;
- linha sem correspondência abre um cadastro guiado com cliente, grupo, cota e
  consultor;
- o modo “sem regra” usa exatamente a comissão informada no relatório;
- cliente sem documento e telefone recebe `PENDENTE_CPF_CNPJ` e
  `PENDENTE_TELEFONE`;
- grupo inexistente é criado como `LOCAL`, inativo e exclusivo da franquia, sem
  publicação no site;
- venda e cota administrativas não afetam o faturamento operacional.

## Segurança

O fluxo exige simultaneamente as permissões financeira e de comissões, valida
tenant, administradora, consultor e grupo, e mantém vínculo auditável entre item
do PDF, cliente, venda, cota e previsões.

