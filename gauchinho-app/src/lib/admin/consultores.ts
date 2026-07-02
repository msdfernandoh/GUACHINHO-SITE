import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultorOption = { id: string; nome: string; email?: string | null };

function isMissingConsultorColumn(error: { message?: string } | null): boolean {
  const msg = error?.message ?? "";
  return /is_consultor/.test(msg) || /column/.test(msg);
}

/** Usuários marcados como consultores comerciais (agenda e leads). */
export async function listarConsultores(supabase: SupabaseClient): Promise<ConsultorOption[]> {
  const withFlag = await supabase
    .from("usuarios")
    .select("id, nome, email")
    .eq("ativo", true)
    .eq("is_consultor", true)
    .order("nome");

  if (!withFlag.error) {
    return (withFlag.data ?? []) as ConsultorOption[];
  }

  if (isMissingConsultorColumn(withFlag.error)) {
    const legacy = await supabase
      .from("usuarios")
      .select("id, nome, email")
      .eq("ativo", true)
      .eq("perfil", "srd")
      .order("nome");
    if (legacy.error) {
      console.warn("[consultores] fallback srd:", legacy.error.message);
      return [];
    }
    return (legacy.data ?? []) as ConsultorOption[];
  }

  console.warn("[consultores] listar:", withFlag.error.message);
  return [];
}
