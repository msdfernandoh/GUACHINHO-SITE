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

## Fase 3 — multiunidade (migrations 350–352)
- Cada gerente é dono das cotas que sobe (`contempladas_cotas.dono_auth_id`); o dono do portal pode subir em nome de um gerente.
- `contempladas_gerente_config`: unidade, WhatsApp, PIX (com tipo), ágio de imóvel e de veículo, sinal de bloqueio por tipo e comissão. Sem cadastro, vale o padrão da empresa (`contempladas_config`).
- Negociar usa o WhatsApp/PIX/sinal da unidade dona; cotas de unidades diferentes não são reservadas juntas.
- Painel do gerente mostra só as cotas e reservas da unidade dele; o dono vê todas.
- Proposta: layout A4, logomarca e telefone do vendedor, bloco de assinatura.

## Domínio contempladasracon.com.br, menu no site e aprovação de revendas (19/11/2026)
- `contempladasracon.com.br` (e www) abre o portal como `contempladas.raconsinop.com.br` (`LANDING_DOMINIOS_PROPRIOS` em `src/lib/landings/subdominios.ts`); o endereço antigo segue funcionando. Rotas curtas `/solicitar` e `/seja-parceiro` incluídas.
- Site raconsinop.com.br: menu "Contempladas" (`/contempladas`) em todas as páginas e faixa "Acessar o portal" na home (`src/lib/contempladas/site-link.ts`).
- Administrador de cotas (GERENTE) aprova ou recusa cadastros pendentes de revenda; administradores novos continuam com o dono.

## Colaboradores (25/11/2026)
- Migration 360: `contempladas_usuarios.responsavel_auth_id/responsavel_nome/colaborador_percentual`; `contempladas_comissoes.colaborador_auth_id/colaborador_nome/tipo`.
- Aba "Colaboradores" no painel (dono, administrador de cotas e revenda): cadastra ou vincula (portal/ERP) um colaborador com o % da comissão; dono pode escolher o responsável.
- Colaborador vê nas cotas só a sua parte (comissão × %), inclui ágio em Meu perfil e não cadastra outros colaboradores.
- Venda de colaborador: o dono da cota paga o responsável (comissão cheia + ágio − desconto, tipo REVENDA) e o responsável paga o colaborador (% + ágio − desconto, tipo COLABORADOR).
