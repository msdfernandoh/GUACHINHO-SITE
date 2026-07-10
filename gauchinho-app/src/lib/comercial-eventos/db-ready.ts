/** Erros comuns quando tabelas de eventos/agenda ainda não existem no Supabase. */
export function isDbMissingRelationError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /relation .* does not exist/i.test(msg) ||
    /Could not find the table/i.test(msg) ||
    /42P01/.test(msg) ||
    /PGRST205/.test(msg)
  );
}

export const EVENTOS_MIGRATION_HINT =
  "Módulo de eventos ainda não está configurado no banco de dados. Aplique a migration supabase/migrations/016_eventos_agenda.sql para ativar esta tela.";

export const EVENTOS_INSCRICAO_MIGRATION_HINT =
  "Para inscrição externa e upload de imagens, aplique supabase/migrations/018_eventos_inscricao_externa_storage.sql no Supabase.";

export const EVENTOS_SORTEIO_MIGRATION_HINT =
  "Para sorteio de brindes, aplique supabase/migrations/022_eventos_sorteios.sql e 026_eventos_sorteio_inscricao_link.sql no Supabase.";

export function isDbMissingColumnError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /column .* does not exist/i.test(msg) ||
    /Could not find the .* column/i.test(msg) ||
    /42703/.test(msg) ||
    /PGRST204/.test(msg)
  );
}
