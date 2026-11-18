# Migração do vínculo de indicações com Leads · 18/11/2026

- Migração `20261118170000_lead_id_indicacoes_sorteio.sql` aplicada no Supabase vinculado e registrada como aplicada no histórico.
- A coluna opcional `lead_id` referencia `leads.id` e recebe índice parcial. A exclusão de um lead limpa o vínculo, preservando a indicação.
- A execução de teste foi revertida e antecipou o resultado confirmado após a aplicação. Das 31 indicações existentes, 23 receberam vínculo e oito ficaram sem correspondência segura. A migração preservou o total de indicações e não inseriu nem alterou linhas de `leads`.
