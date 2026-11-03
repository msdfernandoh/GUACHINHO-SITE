# Erro ao criar usuário no ERP Racon Sinop — 03/11/2026

Log Vercel confirmou POST /erp/usuarios, www.raconsinop.com.br, erro 23514
empresa_usuarios_erp_modulos_visiveis_check, deployment
dpl_6P8Dv2KLvkGNVSGdU23XH24TuyKP, digest 2336278636.
A constraint 314 aceitava catálogo anterior; formulário atual inclui whatsapp e
robos. Fallback antigo removia somente conta-corrente-socios e não resolvia.

Migration 20261103213453_alinhar_menus_erp_usuarios aplicada ao projeto
eaeuoynprurmmulzhydt. Amplia somente os IDs aceitos por CHECK; não atualiza linhas,
não concede acessos nem altera RLS. 22 vínculos preservados por hash idêntico
8ddc7e8d30d7599d0911c7f9acd54413 antes/depois.
Consulta de validação da expressão real confirmou menus atuais aceitos e menu
inexistente rejeitado, sem criar usuário real ou alterar dados para teste.

Código trata falhas de criação com flash no cadastro, preservando redirects
internos via unstable_rethrow. Invalida também /erp/usuarios.
Oito testes de catálogo/relações aprovados e TypeScript aprovado.
Cadastro real autenticado não executado. Relatório da causa permite nova tentativa
pelo titular; tratamento de erros depende da publicação do código.

Build de produção e lint direcionado aprovados; envio à main segue autorização do titular nesta sequência.
