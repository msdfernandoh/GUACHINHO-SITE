# Portal de cotas contempladas — contempladas.<domínio>

- Subdomínio `contempladas` em `lib/landings/subdominios.ts` (herda o tenant do domínio pai, como `spl.`).
- Migration `348_contempladas_portal.sql`: `contempladas_config`, `contempladas_lotes`, `contempladas_cotas`,
  `contempladas_propostas` (número sequencial a partir de 1001), `contempladas_reservas`, `contempladas_simulacoes`,
  bucket privado `contempladas-comprovantes` e `usuarios.contempladas_pode_enviar`. Tudo aditivo; `cartas_contempladas` intocada.
- Rotas: `/contempladas` (simulador e junção), `/contempladas/importar` (login + autorização de envio),
  `/contempladas/p/[numero]` (proposta reimprimível com status atual), `/contempladas/painel` (reservas, PIX, vendidas, configuração e autorizações).
- Regras: pré-reserva não bloqueia cota (só contador com relógio configurável); reserva com PIX + comprovante bloqueia;
  comissão só aparece para usuário logado; acréscimo de entrada (% do crédito ou fixo) no envio e na proposta.
- Motor puro em `lib/contempladas/motor.ts` com testes.
