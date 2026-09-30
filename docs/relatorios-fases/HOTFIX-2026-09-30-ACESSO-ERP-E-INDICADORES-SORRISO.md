# Hotfix — acesso ERP e perfis de indicação da Racon Sorriso

Data: 30/09/2026

## Incidentes

1. Um usuário interno criado no ERP com o perfil legado `parceiro` recebia o
   papel tenant `parceiro_comercial`. Após o login, ele era enviado para a
   antiga `/area-parceiro`, sem os vínculos exigidos pelo portal atual.
2. O cadastro público do programa de indicação da Racon Sorriso não encontrava
   os perfis canônicos `Indicador` e `Gerador de Oportunidades` no próprio
   tenant e interrompia a adesão.

## Correções

- O papel `parceiro_comercial` passa a ser encaminhado ao app vigente
  `/app-indicador`; o portal legado não é mais usado como destino do login.
- O formulário interno de usuários do ERP não oferece nem aceita a criação de
  `parceiro`, pois esse formulário não coleta CPF, PIX e adesão ao programa.
  Indicadores continuam sendo criados pelo fluxo público tenant-aware.
- A migration `302_perfis_indicacao_racon_sorriso.sql` cria, de modo
  idempotente e restrito ao tenant Sorriso, os dois perfis comerciais exigidos
  pelo cadastro público.
- O vínculo do usuário interno afetado foi corrigido em produção para o papel
  COMPANY `consultor`, preservando a identidade global e os dados existentes.

## Governança financeira

A migration cria somente perfis que identificam funções comerciais. Ela não
copia programas, percentuais ou regras de comissão de outra empresa. Qualquer
pagamento permanece condicionado à configuração e homologação financeira
específica da Racon Sorriso.

## Multi-tenancy e preservação

- O acesso continua sendo resolvido por `empresa_usuarios(empresa_id,
  usuario_id, papel_id)`.
- Nenhum registro de usuário, participante, lead ou proposta foi excluído.
- A alteração operacional do usuário foi limitada aos identificadores exatos
  do vínculo e da identidade afetados.

## Validação

- Teste contratual confirma que parceiros usam `/app-indicador` e nunca o
  destino legado.
- Teste contratual confirma que o cadastro interno não cria parceiros
  incompletos.
- Typecheck, testes dirigidos e build de produção executados antes da
  publicação.

