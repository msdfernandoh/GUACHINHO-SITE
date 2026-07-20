import type { SupabaseClient } from "@supabase/supabase-js";

export type ConsultorOption = { id: string; nome: string; email?: string | null };

function isMissingColumn(error: { message?: string } | null, col: string): boolean {
  const msg = error?.message ?? "";
  return new RegExp(col).test(msg) && /column|Could not find/i.test(msg);
}

type ConsultorRow = ConsultorOption & { is_consultor?: boolean };

/** Usuários ativos elegíveis como consultor responsável em leads. */
export async function listarConsultores(
  supabase: SupabaseClient,
  opts?: { preferirMarcados?: boolean },
): Promise<ConsultorOption[]> {
  const staff = await supabase
    .from("usuarios")
    .select("id, nome, email, perfil, is_consultor")
    .eq("ativo", true)
    .in("perfil", ["master", "srd", "visualizador"])
    .order("nome");

  let rows: ConsultorRow[] = [];

  if (!staff.error) {
    rows = (staff.data ?? []).map((u) => ({
      id: u.id as string,
      nome: u.nome as string,
      email: (u.email as string | null) ?? null,
      is_consultor: Boolean(u.is_consultor),
    }));
  } else if (isMissingColumn(staff.error, "is_consultor")) {
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
    rows = (legacy.data ?? []).map((u) => ({
      id: u.id as string,
      nome: u.nome as string,
      email: (u.email as string | null) ?? null,
    }));
  } else {
    console.warn("[consultores] listar:", staff.error.message);
    return [];
  }

  if (opts?.preferirMarcados) {
    const marcados = rows.filter((u) => u.is_consultor);
    if (marcados.length) rows = marcados;
  }

  return rows.map(({ id, nome, email }) => ({ id, nome, email }));
}

export async function resolverConsultorPorId(
  supabase: SupabaseClient,
  consultorId: string,
): Promise<ConsultorOption | null> {
  const id = consultorId.trim();
  if (!id) return null;
  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, email")
    .eq("id", id)
    .eq("ativo", true)
    .in("perfil", ["master", "srd", "visualizador"])
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    nome: data.nome as string,
    email: (data.email as string | null) ?? null,
  };
}
