# Fase 280 — Histórico de PDFs das propostas no CRM

## Objetivo

Permitir que o consultor mantenha, no card do Pipeline CRM, as versões em PDF
de propostas associadas ao mesmo lead até o encerramento comercial.

## Entregas

- Modal **PDFs** no card do Pipeline CRM, com propostas ligadas ao lead.
- Visualização e download do PDF atual já gerado pela plataforma.
- Upload de PDFs de até 20 MB, exclusivamente no formato PDF, em cada proposta.
- Histórico imutável de anexos por proposta, exibindo nome, tamanho e data.
- Tabela `propostas_arquivos` com `empresa_id`, autoria, vínculo composto à
  proposta e políticas RLS baseadas no vínculo N:N do usuário com o tenant.
- Arquivos enviados no bucket privado `propostas-pdf`, no caminho
  `<proposta_id>/historico/<uuid>.pdf`.
- Funções de Storage atualizadas para reconhecer tanto o arquivo legado
  `<proposta_id>.pdf` quanto os caminhos versionados.

## Segurança e integridade

- A proposta é conferida no tenant ativo antes de enviar, listar ou assinar um
  arquivo.
- O bucket não é público; cada visualização ou download recebe URL assinada com
  expiração de 15 minutos.
- O registro de metadados é criado depois do upload. Se a gravação falhar, o
  objeto recém-enviado é removido para não deixar arquivo órfão.
- Não há exclusão pela interface nesta fase, preservando o histórico do
  relacionamento comercial.

## Validação prevista

1. Executar a migration 280 no Supabase vinculado.
2. Checar tipagem/lint do app Next.js.
3. Confirmar que o card abre o modal, que o PDF atual recebe URL assinada e que
   um anexo novo aparece no histórico após o upload.
