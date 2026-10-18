# Recuperação do Superadmin e preservação da autoridade global

Data: 18/10/2026. Escopo: GAUCHINHO SITE. Autorização do titular: “pode resolver”.

## Resultado em produção

O acesso da identidade original `msdfernando@gmail.com` foi recuperado em
18/10/2026 às 09:35:07 (America/Cuiaba). O mesmo vínculo ativo passou de
`admin_empresa`/`COMPANY` para o papel canônico ativo `super_admin`/`PLATFORM`.
Senha, usuário, empresa, módulos, configurações comerciais e vínculos não foram
substituídos. Não houve criação de outra conta nem concessão a terceiros.

Supabase confirmado: `eaeuoynprurmmulzhydt`. Migration aplicada e registrada:
`307_preservar_superadmin_legado`. A aplicação continuou no deployment
`dpl_AcJajeHCeoSqzDuknDEzv3wvK3F5`; a correção está nos triggers do banco,
funciona com o formulário já publicado e não depende de deploy do frontend.

## Correção

A migration 145 substituíra a validação da 043 por uma regra COMPANY-only,
incompatível com o vínculo global legado. Além disso, havia dois triggers
invocando a mesma validação. A migration 307 mantém uma única validação
BEFORE INSERT/UPDATE/DELETE, com `search_path=pg_catalog` e permissões explícitas.

- Editar opções operacionais de um vínculo global já existente continua permitido
  pelas camadas normais de autorização. Quando o formulário legado envia
  `master -> admin_empresa`, o banco conserva o papel global existente.
- Rebaixamento para outro papel, inativação, alteração de status, remoção ou
  transferência dessa autoridade pelo fluxo tenant são recusados, inclusive
  quando a action utiliza `service_role`.
- Atribuir papel PLATFORM a outro usuário continua proibido pela API. Alterações
  dessa autoridade exigem manutenção SQL direta, `session_user=postgres`, sem
  papel de API e sem JWT. Não existe RPC pública de recuperação nem autorização
  por e-mail, perfil legado ou metadados.
- Mesmo a manutenção direta não pode remover o último vínculo Superadmin ativo;
  as remoções são serializadas por advisory lock. A proteção empresarial do
  último `admin_empresa` permanece intacta.
- Mudanças de papel, identidade, status e atividade de vínculos passam a registrar
  antes/depois, executor e motivo em `audit_logs_central`, na mesma transação.

A recuperação de uso único fica em
`supabase/maintenance/2026-10-18-recuperar-superadmin.sql`. Ela valida os IDs de
identidade Auth, usuário interno, empresa e vínculo, o e-mail esperado e o papel
anterior; altera somente `papel_id` e `updated_at`, exige auditoria e é idempotente.
Os UUIDs da conta aparecem somente nessa manutenção e nas evidências, nunca em
runtime para conceder acesso.

## Validação e preservação

O ensaio inicial aplicou DDL, recuperação e cenários positivos/negativos em uma
transação encerrada com ROLLBACK. Na publicação, os testes foram repetidos antes
do COMMIT. Cenários de edição foram isolados em subtransações e revertidos;
o papel customizado sintético usado no teste de outro tenant não persistiu.

Foram aprovados:

1. Payload real do formulário preserva o papel global e permite opções operacionais.
2. Promoção de terceiro por `service_role` é recusada.
3. Rebaixamento, inativação, mudança de status, exclusão e transferência de
   identidade global são recusados.
4. Edição normal de papel COMPANY continua funcionando.
5. Papel customizado de outra empresa é recusado.
6. Manutenção direta não remove o último Superadmin.
7. `is_platform_superadmin()` retorna true sob JWT autenticado da conta recuperada
   e false sob JWT de administrador empresarial comum.
8. As duas funções de trigger não têm EXECUTE direto para `anon`, `authenticated`
   ou `service_role`; privilégios reais conferidos após aplicação.

A transação comparou contagens e hashes de conteúdo em 30 tabelas antes/depois,
incluindo usuários e Auth, empresas, papéis, outros vínculos, participantes,
sócios, leads, propostas, contratações, catálogo, vendas, cotas, previsões,
recebimentos, pagamentos, contas a pagar, movimentos financeiros, caixa,
Agenda e índices financeiros. Todos foram preservados. O vínculo-alvo foi
comparado separadamente, permitindo apenas a mudança do papel e do timestamp.
Somente a auditoria da recuperação e o registro da migration foram acrescentados.

A primeira tentativa de publicação foi abortada integralmente porque a lista
de preservação usava o nome histórico `agenda_eventos`, ausente no schema atual.
Foi confirmado que papel e metadata continuavam no estado anterior; a lista foi
corrigida para as seis tabelas canônicas da Agenda antes da publicação efetiva.

Smoke autenticado no domínio real, com sessão temporária da própria identidade:

| Domínio | Rota | Resultado |
|---|---|---|
| admin.gauchinhoconsorcios.com.br | /platform | HTTP 200; painel presente |
| admin.gauchinhoconsorcios.com.br | /platform/empresas | HTTP 200 |
| admin.gauchinhoconsorcios.com.br | /platform/usuarios | HTTP 200 |
| www.raconsinop.com.br | /erp | HTTP 200 |
| www.raconsinop.com.br | /erp/vendas | HTTP 200; Vendas presente |

Nenhuma rota apresentou o bloqueio PLATFORM_SUPERADMIN nem marcador de erro de
renderização. O token de teste foi gerado sem envio de e-mail e sem redefinir
senha; a sessão temporária foi encerrada com `scope: local`, preservando as
demais sessões. O smoke atualizou somente metadados normais de login no Auth.
Nenhuma credencial, token ou senha foi registrado nos artefatos.

Regressão local: cinco arquivos e 39 testes aprovados, cobrindo política do host,
governança/cadastro de usuários, relações N:N e autorização ERP. Não houve mudança
TypeScript/React; build e lint de aplicação não foram necessários para o DDL.

## Operação e limites

O titular pode atualizar o endereço da Plataforma e continuar usando a senha
atual. A autenticação e a autorização canônicas continuam independentes: não se
abriu acesso global para administradores empresariais comuns.

A proteção desta fase cobre alterações no vínculo `empresa_usuarios`. Ela não
substitui os controles próprios de administração de identidades Auth, usuários e
catálogo de papéis. A origem histórica do rebaixamento continua provável, sem
autoria ou data comprovadas pela auditoria anterior ao hotfix.

Reversão operacional deve ser forward-only. Não restaurar a validação COMPANY-only
da 145 nem rebaixar o único Superadmin; eventual evolução deve preservar o helper
canônico, a conta recuperada e os controles empresariais.

Durante a execução apareceu outro arquivo local, de trabalho concorrente,
`307_central_robos_importacao.sql`. Ele não foi alterado nem aplicado nesta tarefa.
A versão remota 307 pertence a `preservar_superadmin_legado`; esse outro trabalho
precisa reconciliar sua numeração antes de qualquer aplicação. Outras lacunas e
duplicidades históricas de migrations não foram reaplicadas automaticamente.

Não houve commit, push ou publicação das alterações locais de outros trabalhos.
