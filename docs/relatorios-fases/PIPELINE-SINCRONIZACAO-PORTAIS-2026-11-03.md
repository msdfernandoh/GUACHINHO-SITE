# Pipeline — sincronização após editar e entre portais — 03/11/2026

Causa confirmada no cliente: board inicializava leads com useState e não
reconciliava initialLeads após router.refresh. Card também mantinha cópia antiga.
Modal ignorava etapa/status do resultado salvo na sua atualização local.
Esses estados agora acompanham dados recebidos. Modal aplica retorno canônico
da action. Ao voltar à aba/janela o Pipeline solicita atualização do servidor,
permitindo refletir alterações feitas no outro domínio que usa o mesmo tenant.

Actions de edição e etapa exigem uma linha retornada do UPDATE; ausência de linha
não é sucesso. Edição invalida também /admin/crm e /admin/crm/pipeline.
Nenhuma troca de tenant, service role ou relaxamento de RLS. Sem migration.
TypeScript aprovado. Causa de eventual recusa remota de gravação ainda depende de
homologação autenticada; esta entrega não comprova persistência remota.
Não houve alteração de leads reais durante validação.

Build de produção e lint direcionado aprovados. Envio à main segue autorização do titular para as correções desta sequência.
