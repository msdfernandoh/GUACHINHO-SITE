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
