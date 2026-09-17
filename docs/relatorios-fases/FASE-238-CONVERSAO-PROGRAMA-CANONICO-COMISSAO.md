# Fase 238 — Conversão pelo programa canônico da comissão

Data: 17/09/2026

## Problema

A preparação da formalização resolvia corretamente o programa de comissão pelo
perfil e pelo tipo canônico do grupo e gravava `programa_comissao_id` no
snapshot da contratação. A conversão final repetia a busca apenas por perfil.
Para perfis com regras em Imóvel e Veículo, como Sócio, essa segunda busca era
ambígua e podia escolher o programa incompatível. O resultado era a pendência
“Regra da franqueadora não homologada”, embora a tela exibisse regra, modalidade
e percentual válidos.

## Correção

A migration `228_conversao_reutiliza_programa_canonico.sql` altera a RPC
`rpc_converter_contratacao_venda` para consumir o `programa_comissao_id`
congelado pela preparação. Antes de criar a venda, a RPC confirma que:

- o programa pertence à empresa e à administradora;
- o programa está vinculado ao tipo canônico do grupo;
- o participante mantém vínculo vigente com o perfil selecionado;
- o perfil possui regra homologada e vigente nesse programa;
- a regra da franqueadora corresponde ao programa, tipo e modalidade.

Assim, um único perfil comercial pode atender Imóvel e Veículo por regras de
programa distintas, e a venda sempre usa a regra compatível com seu grupo.
O tratamento de falhas também relê o snapshot após a preparação, impedindo que
uma falha posterior remova o programa já resolvido ao registrar a pendência.

## Preservação

Nenhum perfil, percentual, histórico, venda ou regra é removido. A alteração é
forward-only e mantém as validações multiempresa e as permissões existentes.
