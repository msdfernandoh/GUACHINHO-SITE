# Contas a Pagar — reconhecimento de Master/Superadmin

Data: 21/10/2026. Escopo: GAUCHINHO SITE.

## Problema e causa

O titular informou que Fernando não conseguia editar data de pagamento nem
valor, com aviso de restrição a Master. A página calculava `master` apenas por
`vinculo.papel.codigo === "admin_empresa"`. O relatório de recuperação de
18/10 registra o papel canônico de Fernando como `super_admin`/`PLATFORM`.
A comparação local não representava a autorização efetiva do banco.

A migration 101 define `is_financeiro_tenant_master(empresa_id)`, incluindo
Superadmin, e `pode_estornar_conta_pagar(empresa_id)`. A RPC de edição de conta
paga da migration 301 usa a primeira função. O frontend usava uma regra própria
mais restritiva e desabilitava os campos antes da chamada dessa RPC.

## Correção

Novo serviço servidor `contas-pagar-permissoes.ts` consulta as duas funções
canônicas usando a sessão autenticada e a empresa ativa resolvida no servidor.
A página passa seus resultados à interface existente. A mesma flag libera
valor, data do pagamento e demais controles reservados a Master nessa tela.
Estorno delegado permanece separado: poder estornar não torna um usuário Master.
Falha ao consultar permissões é explícita, sem concessão nem classificação
silenciosa incorreta. Nenhuma autoridade é derivada de e-mail, nome ou
`usuarios.perfil` pela nova camada de aplicação.

Guards de rota, permissão financeira da action, RPC de gravação e validação
do banco permanecem aplicados. Não houve alteração de usuário, senha, papel,
vínculo N:N, configuração ou registro financeiro. Sem migration ou escrita
remota. As alterações anteriores de QR Codes foram preservadas.

## Validação

- 16 testes direcionados aprovados, incluindo seis novos cenários de permissão:
  Master/Superadmin canônico, operador comum, estorno delegado sem Master,
  consultas independentes por empresa e falhas em cada RPC.
- Contratos existentes de edição de data e governança financeira aprovados.
- TypeScript sem emissão aprovado.
- ESLint direcionado: zero erros; quatro avisos de `any` já existentes na página.
- Build de produção aprovado (compilação, TypeScript e geração das páginas).

## Publicação e reversão

Envio à `main` autorizado pelo titular em 21/10/2026, junto à correção dos QR
fixos. A validação conjunta aprovou 31 testes em sete arquivos. O envio ao Git
não constitui confirmação de deploy. A resolução real da sessão
de Fernando e a edição pelo domínio de produção dependem da publicação e
homologação autenticada. Os testes de autorização desta fase usam mocks das
RPCs, sem alterar pagamentos reais para testar.
Reversão por retorno da página e remoção do serviço; não há dados a reverter.
