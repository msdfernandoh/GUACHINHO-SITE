import type { SupabaseClient } from "@supabase/supabase-js";
import { nomeComTipoComissao } from "@/lib/participantes/nome-com-parceria";

export type ConsultorOption = { id: string; nome: string; email?: string | null };

function isMissingColumn(error: { message?: string } | null, col: string): boolean {
  const msg = error?.message ?? "";
  return new RegExp(col).test(msg) && /column|Could not find/i.test(msg);
}

type ConsultorRow = ConsultorOption & { is_consultor?: boolean };

type TenantConsultorLink = {
  is_consultor?: boolean | null;
  papel?: { codigo?: string } | { codigo?: string }[] | null;
  usuario?: (ConsultorOption & { ativo?: boolean; auth_user_id?: string | null }) | (ConsultorOption & { ativo?: boolean; auth_user_id?: string | null })[] | null;
};

/** Um usuário pode ter vários papéis. Nome igual, sozinho, não comprova identidade. */
export function consultoresDosVinculos(links: TenantConsultorLink[]) {
  const usuarios = new Map<string, ConsultorRow>();
  for (const link of links) {
    const papel = Array.isArray(link.papel) ? link.papel[0] : link.papel;
    const usuario = Array.isArray(link.usuario) ? link.usuario[0] : link.usuario;
    const elegivel = link.is_consultor === true || ["super_admin", "admin_empresa", "gestor", "consultor"].includes(papel?.codigo ?? "");
    if (usuario?.ativo !== true || !elegivel) continue;
    const key = usuario.auth_user_id ? `auth:${usuario.auth_user_id}` : `id:${usuario.id}`;
    const anterior = usuarios.get(key);
    usuarios.set(key, {
      id: anterior?.id ?? usuario.id,
      nome: anterior?.nome ?? usuario.nome,
      email: anterior?.email ?? usuario.email ?? null,
      is_consultor: Boolean(anterior?.is_consultor || link.is_consultor === true || papel?.codigo === "consultor"),
    });
  }
  return [...usuarios.values()];
}

/** Usuários ativos elegíveis como consultor responsável em leads. */
export async function listarConsultores(
  supabase: SupabaseClient,
  opts?: { preferirMarcados?: boolean; empresaId?: string },
): Promise<ConsultorOption[]> {
  if (opts?.empresaId) {
    const { data, error } = await supabase
      .from("empresa_usuarios")
      .select("is_consultor,papel:papeis(codigo),usuario:usuarios!empresa_usuarios_usuario_id_fkey(id,nome,email,ativo,auth_user_id)")
      .eq("empresa_id", opts.empresaId)
      .eq("ativo", true);
    if (error) {
      console.warn("[consultores] listar tenant:", error.message);
      return [];
    }
    let tenantRows = consultoresDosVinculos((data ?? []) as TenantConsultorLink[]);
    const ids = tenantRows.map((row) => row.id);
    const { data: participantes, error: participantesError } = ids.length
      ? await supabase
          .from("participantes_comerciais")
          .select("id,usuario_id,status")
          .eq("empresa_id", opts.empresaId)
          .in("usuario_id", ids)
      : { data: [], error: null };
    if (participantesError) return [];
    const ativos = (participantes ?? []).filter(p => String(p.status).toUpperCase() === "ATIVO");
    tenantRows = tenantRows.filter(row => !(participantes ?? []).some(p => p.usuario_id === row.id) || ativos.some(p => p.usuario_id === row.id));
    const participanteIds = ativos.map((participante) => participante.id);
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: perfisComissao } = participanteIds.length
      ? await supabase
          .from("participante_comissao_perfis")
          .select("participante_id,papel_tipo")
          .in("participante_id", participanteIds)
          .eq("ativo", true)
          .lte("vigencia_inicio", hoje)
          .or(`vigencia_fim.is.null,vigencia_fim.gte.${hoje}`)
      : { data: [] };
    const usuarioPorParticipante = new Map((participantes ?? []).map((participante) => [participante.id, participante.usuario_id]));
    const tiposPorUsuario = new Map<string, string[]>();
    for (const vinculo of perfisComissao ?? []) {
      const usuarioId = usuarioPorParticipante.get(vinculo.participante_id);
      if (!usuarioId) continue;
      tiposPorUsuario.set(usuarioId, [...(tiposPorUsuario.get(usuarioId) ?? []), vinculo.papel_tipo]);
    }
    const preferidos = opts.preferirMarcados ? tenantRows.filter((row) => row.is_consultor) : tenantRows;
    return (preferidos.length ? preferidos : tenantRows)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      .map(({ id, nome, email }) => ({ id, nome: nomeComTipoComissao(nome, tiposPorUsuario.get(id)), email }));
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
      .eq("ativo", true);
    const usuario = consultoresDosVinculos((data ?? []) as TenantConsultorLink[])[0];
    if (error || !usuario) {
      return null;
    }
    const participantes = await supabase.from("participantes_comerciais").select("status")
      .eq("empresa_id", empresaId).eq("usuario_id", id);
    if (participantes.error || (participantes.data?.length && !participantes.data.some(p => String(p.status).toUpperCase() === "ATIVO"))) return null;
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
