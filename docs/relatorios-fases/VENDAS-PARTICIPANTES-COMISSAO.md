# Vendas — participantes e repartição de comissão

## Entrega versionada

- `072_participantes_venda_reparticao_comissao.sql`: atuação comercial adicional e configuração de fração entre Microfranquia e participante secundário.
- `073_concluir_participantes_venda_comissoes.sql`: campos na contratação, materialização tenant-aware na venda e repartição de previsões futuras antes de gravá-las.
- Tela de contratação: seleção de Microfranquia principal e secundário opcional (`SDR`, `PARCEIRO` ou `CONSULTOR`).
- Link SDR: simulação assinada sem proposta ou contratação persistida até o cliente preencher os dados mínimos.

## Regras preservadas

- O secundário é opcional.
- A fração reduz a previsão da Microfranquia e gera previsão equivalente para o secundário; não cria comissão adicional.
- Repartição só incide em vendas novas, sem reescrever previsões, pagamentos ou eventos financeiros históricos.
- O motor 060–063, cota definitiva e idempotência de conversão permanecem canônicos.

## Estado operacional

As migrations 072 e 073 estão versionadas, porém dependem de aplicação explícita no Supabase antes do uso da tela em Production.
