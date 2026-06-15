# Testes — Fase 3.1 Grupos (cadastro rápido e `/grupos`)

**Data:** 15/06/2026  
**Build:** `cd gauchinho-app && npm run build`

## Admin — formulário de grupo

- [ ] `/admin/grupos/novo`: campos principais (código, modalidade Imóvel/Auto/Moto, administradora, status, ativo, observações).
- [ ] Seção financeira: taxas, fundo reserva, CET, prazos, seguro (% e valor R$), parcela reduzida, lance embutido, recurso próprio, seguro pós-contemplação.
- [ ] Colar cotas em bloco (uma linha = um crédito) → salvar → cotas com parcela/saldo estimados a partir do grupo.
- [ ] Desmarcar **Ativo** e salvar → grupo fica inativo.

## Popular grupos de teste (Master)

- [ ] Logado como **Master** em `/admin/grupos` → botão **Popular grupos de teste**.
- [ ] Cria 6 grupos (1203, 1283, 1443, 1533, 2045, 3012), administradora Racon, observações "Dados de teste", ativo.
- [ ] Segundo clique: idempotente (não duplica por código).
- [ ] Perfil SRD/visualizador: botão não aparece.

## Página pública `/grupos`

- [ ] Com grupos ativos: tabela, filtro por modalidade, busca, seleção (1 cota por grupo).
- [ ] Totalizadores atualizam ao selecionar.
- [ ] **Gerar simulação** sem seleção → mensagem amarela (toast).
- [ ] **Gerar proposta** e **Falar com especialista** desabilitados sem seleção.
- [ ] Com seleção: fluxo modal nome/WhatsApp (simulação/proposta/especialista).
- [ ] Sem grupos públicos: mensagem para visitante.
- [ ] Staff logado no mesmo browser (sessão Supabase): mensagem extra com link para `/admin/grupos`.

## Regressão

- [ ] Duplicar / inativar / excluir grupo (Master) em `/admin/grupos/[id]`.
- [ ] Fase 3 propostas PDF (`docs/TESTES-FASE-3-PROPOSTAS.md`) após cadastro de grupos.

## Unitários (opcional)

- [ ] `npm test` — `estimarCamposCotaBulk` / `calcularTotaisGrupos`.
