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

## Fase 2 — usuários do portal, ágio e rentabilidade (migration 349)
- `contempladas_usuarios` (GERENTE/VENDEDOR) e `contempladas_convites` (link de 7 dias). Esses usuários não têm linha em
  `usuarios`/`empresa_usuarios`, então os layouts de `/admin` e `/erp` negam o acesso.
- Papéis: DONO (master do ERP), GERENTE (portal ou ERP com autorização), VENDEDOR (portal ou demais usuários do ERP).
- Ágio padrão (`contempladas_config.agio_*`) aplicado na subida; o envio pode desmarcar "usar configuração padrão".
- Adicional fixo por vendedor entra sozinho na entrada; desconto na entrada aparece na proposta.
- Rentabilidade (comissão + adicional − desconto) só no simulador logado e no painel; nunca na proposta do cliente.
