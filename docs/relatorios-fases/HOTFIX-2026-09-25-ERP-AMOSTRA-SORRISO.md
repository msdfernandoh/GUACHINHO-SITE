# Hotfix — ERP e amostra fictícia da Racon Sorriso

Data: 25/09/2026. Tenant: `sorriso` (`3b5d14ec-6e0f-4f8e-952a-75adbfaa0949`).

## Diagnóstico e correção

- A assinatura ativa do Plano Profissional concede os 12 módulos base, mas o onboarding havia gravado somente `erp_habilitado` e `modulos_erp_selecionados`. O ERP lia apenas `erp_sistema`.
- O vínculo ativo de `fernando@msdeducacao.com.br` tinha papel `admin_empresa` e `erp_modulos_visiveis = {}`, que bloqueava todos os módulos apesar da assinatura.
- A migration 291 grava `erp_sistema` a partir dos módulos ativos do plano e troca a lista vazia desse vínculo por `NULL`, que significa herança dos módulos contratados. A aplicação passa a ler os campos de onboarding se a configuração canônica estiver ausente.
- Acesso validado no host `raconsorriso.com.br/erp`, com Plano Profissional e todos os módulos base. O link “ERP Sistema” foi validado no portal em uma navegação nova.

## Amostra da unidade

A migration 292 cria dados idempotentes exclusivamente para a master Sorriso. Todos os nomes e descrições são marcados `[DEMO]`; não há telefone, e-mail, CPF nem pessoa real. Os registros foram aplicados e contados em produção:

| Registro | Total | Observação |
| --- | ---: | --- |
| Clientes | 5 | Pessoas fictícias |
| Leads | 5 | Origem `demonstracao` |
| Propostas | 3 | Sem envio ou contrato |
| Contas a pagar pagas | 3 | Baixadas por `rpc_baixar_conta_pagar`, com movimentos de caixa |
| Venda | 1 | `afeta_faturamento = false`, sem fechar lead ou compor faturamento |
| Comissão | 1 | Previsão fictícia de R$ 1.200, sem recebimento ou repasse |

O caixa de demonstração pode mostrar saldo negativo de R$ 1.475 porque foram simuladas três saídas sem entrada bancária. Esse saldo representa a amostra, não operação real.

## Tour guiado proposto

Uma primeira versão deve ser opcional e exclusiva de tenants com demonstração ativa, com aviso permanente de dados fictícios. Percurso sugerido: Dashboard → Clientes e carteira → Leads/CRM → Propostas → Vendas e Cotas → Comissões → Contas a pagar → Financeiro e Caixa. Cada etapa explica a finalidade do menu, aponta um registro `[DEMO]` e oferece próximo, voltar e encerrar. A conclusão pode ser guardada por usuário e tenant, com botão para reiniciar. Nenhum passo deve executar alteração financeira nem disparar comunicação.

## Validação

- Consulta direta confirmou os 12 módulos contratados, o vínculo `admin_empresa` e a configuração `erp_sistema` ativa.
- Consulta após o seed confirmou 5 clientes, 5 leads, 3 propostas, 3 contas pagas com movimento de caixa, 1 venda fora do faturamento e 1 comissão prevista.
- Testes de configuração e autorização do ERP: 16 aprovados; ESLint dos arquivos alterados: sem erros.
