import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultorOption = { id: string; nome: string; email?: string | null };

function isMissingColumn(error: { message?: string } | null, col: string): boolean {
  const msg = error?.message ?? "";
  return new RegExp(col).test(msg) && /column|Could not find/i.test(msg);
}

/** Usuários ativos elegíveis como consultor responsável em leads. */
export async function listarConsultores(supabase: SupabaseClient): Promise<ConsultorOption[]> {
  const staff = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, is_consultor")
    .eq("ativo", true)
    .in("perfil", ["master", "srd", "visualizador"])
    .order("nome");

  if (!staff.error) {
    return (staff.data ?? []).map((u) => ({
      id: u.id as string,
      nome: u.nome as string,
      email: (u.email as string | null) ?? null,
    }));
  }

  if (isMissingColumn(staff.error, "is_consultor")) {
    const legacy = await supabase
      .from("usuarios")
      .select("id, nome, email")
      .eq("ativo", true)
      .in("perfil", ["master", "srd", "visualizador"])
      .order("nome");
    if (legacy.error) {
      console.warn("[consultores] listar:", legacy.error.message);
      return [];
    }
    return (legacy.data ?? []) as ConsultorOption[];
  }

  console.warn("[consultores] listar:", staff.error.message);
  return [];
}
