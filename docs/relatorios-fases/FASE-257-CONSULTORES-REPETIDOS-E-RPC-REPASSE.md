# Fase 257 — Consultores repetidos e compatibilidade do vínculo de repasse

## Problemas identificados

- O cadastro manual de linhas antigas do relatório listava apenas o nome do participante. Cadastros distintos com o mesmo nome ficavam visualmente iguais e podiam ser selecionados de forma incorreta.
- A aplicação chamava `rpc_vincular_item_repasse_com_cota` com o argumento `p_nova_previsao_franquia_id`, enquanto a função publicada pela migração 242 recebe `p_previsao_franquia_id`. O PostgREST procura RPCs pela assinatura nominal e, por isso, retornava erro de função ausente no cache de esquema.

## Correção

- A página de repasse carrega os vínculos ativos e vigentes de `participante_comissao_perfis`, sempre limitados ao tenant ativo.
- Quando o nome aparece mais de uma vez, a seleção passa a exibir `Perfil de comissão · Nome`. Participantes repetidos ainda sem perfil ficam explicitamente identificados como `Sem perfil de comissão · Nome`.
- A chamada do vínculo manual usa o nome canônico `p_previsao_franquia_id`, igual à assinatura SQL já implantada. Assim, relatórios antigos reprocessados podem vincular linhas a clientes, cotas e previsões criados posteriormente.

## Preservação e segurança

- Nenhum participante foi mesclado ou excluído.
- A consulta e a RPC continuam isoladas por `empresa_id` e pelas permissões financeiras existentes.
- A baixa, a identificação da cota e a substituição do vínculo permanecem na transação definida pela migração 242.

## Validação

- Teste contratual confirma a igualdade entre o nome do argumento usado no TypeScript e a assinatura SQL.
- Teste contratual confirma a identificação de nomes repetidos e a apresentação do perfil antes do nome.
