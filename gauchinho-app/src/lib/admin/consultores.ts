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
  opts?: { preferirMarcados?: boolean; empresaId?: string },
): Promise<ConsultorOption[]> {
  if (opts?.empresaId) {
    const { data, error } = await supabase
      .from("empresa_usuarios")
      .select("is_consultor,papel:papeis(codigo),usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email,ativo)")
      .eq("empresa_id", opts.empresaId)
      .eq("ativo", true);
    if (error) {
      console.warn("[consultores] listar tenant:", error.message);
      return [];
    }
    const tenantRows = (data ?? []).flatMap((link) => {
      const papel = (Array.isArray(link.papel) ? link.papel[0] : link.papel) as { codigo?: string } | null;
      const usuario = (Array.isArray(link.usuario) ? link.usuario[0] : link.usuario) as
        | { id: string; nome: string; email?: string | null; ativo?: boolean }
        | null;
      const elegivel =
        link.is_consultor === true ||
        ["super_admin", "admin_empresa", "gestor", "consultor"].includes(papel?.codigo ?? "");
      if (!usuario?.ativo || !elegivel) return [];
      return [{
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email ?? null,
        is_consultor: link.is_consultor ?? papel?.codigo === "consultor",
      }];
    });
    const preferidos = opts.preferirMarcados ? tenantRows.filter((row) => row.is_consultor) : tenantRows;
    return (preferidos.length ? preferidos : tenantRows)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(({ id, nome, email }) => ({ id, nome, email }));
  }

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
  empresaId?: string,
): Promise<ConsultorOption | null> {
  const id = consultorId.trim();
  if (!id) return null;
  if (empresaId) {
    const { data, error } = await supabase
      .from("empresa_usuarios")
      .select("is_consultor,papel:papeis(codigo),usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email,ativo)")
      .eq("empresa_id", empresaId)
      .eq("usuario_id", id)
      .eq("ativo", true)
      .maybeSingle();
    const papel = (Array.isArray(data?.papel) ? data.papel[0] : data?.papel) as { codigo?: string } | null;
    const usuario = (Array.isArray(data?.usuario) ? data.usuario[0] : data?.usuario) as
      | { id: string; nome: string; email?: string | null; ativo?: boolean }
      | null;
    const elegivel =
      data?.is_consultor === true ||
      ["super_admin", "admin_empresa", "gestor", "consultor"].includes(papel?.codigo ?? "");
    if (error || !usuario?.ativo || !elegivel) {
      return null;
    }
    return { id: usuario.id, nome: usuario.nome, email: usuario.email ?? null };
  }
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
