# Fase 182 — Programa de Indicação público e comissões

## Objetivo

Transformar o formulário público de indicação em um programa tenant-aware, disponível nos modelos oficiais Gauchinho e Racon, com cadastro opcional do indicador, acompanhamento por CPF e integração ao motor canônico de comissões.

## Entregas

- `/indicar` reúne **Fazer indicação**, **Programa de Indicação** e **Ver minhas indicações**.
- Participação exige nome completo, CPF, telefone e chave PIX; empresa onde trabalha é opcional.
- A indicação avulsa exige somente nome completo e telefone de quem indica.
- Telefone associado a CPF diferente é bloqueado e direcionado para regularização pela equipe.
- A consulta usa CPF exato, limite público de requisições, nome parcialmente oculto e retorna somente indicações do mesmo indicador e tenant.
- O vínculo com a venda usa exclusivamente `vendas.lead_id`; não há associação por nome ou telefone.
- Status: `PENDENTE`, `VENDA_REALIZADA`, `COMISSAO_PREVISTA`, `DISPONIVEL_PAGAMENTO`, `PAGA` e `CANCELADA`.
- O valor exibido ao indicador é `vendas.valor_credito`.
- A comissão usa participante e perfil `INDICADOR` com regra ativa e homologada do programa da franqueadora. Nenhum percentual ou valor é presumido.
- A configuração é explicada em **ERP → Regras de Comissão → Perfis de Comissão**.
- O catálogo de menus e os vínculos publicados dos modelos `gauchinho_default` e `racon_inspired` recebem o item `programa_indicacao`.

## Banco e segurança

A migration `179_programa_indicacao_publico_comissoes.sql` cria `programa_indicadores` e `programa_indicacoes`, ambas com `empresa_id`, RLS interna, validação cross-tenant e referências restritivas. CPF e PIX não são retornados pela consulta pública. A chave PIX permanece restrita ao banco e às telas internas autorizadas.

O motor `rpc_gerar_previsoes_comissao_v2` é estendido de forma forward-only: preserva o resultado anterior e acrescenta a previsão do indicador somente quando existe cadastro, perfil e regra homologada não ambígua.

## Validação local

- TypeScript `npx tsc --noEmit`: aprovado.
- ESLint dos arquivos alterados: sem erros.
- Teste contratual `programa-indicacao-176-contract.test.ts`: 4 testes aprovados.
- Suíte completa: 228 arquivos aprovados, 9 ignorados; 1.217 testes aprovados, 37 ignorados.
- Build de produção: aprovado, 149 rotas geradas.
