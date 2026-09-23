# Fase 272 — Edição rápida de lead no pipeline

O card do pipeline CRM agora abre uma janela compacta ao duplo clique para editar nome, WhatsApp, e-mail, etapa, crédito pretendido e parcela mensal que o cliente pode pagar, registrar observações e incluir/remover tags. A janela possui rolagem interna para manter tags e ações de salvamento acessíveis em telas menores. A gravação reutiliza `updateLeadAction`, preserva o escopo de autorização existente e atualiza a visualização local sem recarregar o quadro.

Foi criada a coluna aditiva `public.leads.tags` (`text[]`, padrão vazio) na migration `252_crm_lead_observacoes_tags.sql`. Nenhum dado existente é removido ou transformado.
