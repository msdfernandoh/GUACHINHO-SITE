"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { requireGerenciarParticipantes } from "@/lib/parceiros/authorization";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import {
  fase3AdminDisabledMessage,
  isFase3ParticipantesSchemaReady,
} from "@/lib/parceiros/schema-ready";
import {
  validateGestorMesmaEmpresa,
  validateParticipanteCreateInput,
  validateVinculoParticipanteOrganizacao,
  validateResponsavelPrincipalUnico,
  canLinkUsuarioToParticipante,
} from "@/lib/parceiros/rules";
import { normalizeCpf, normalizeEmail } from "@/lib/parceiros/normalize";
import type { ParticipanteComTipos } from "@/lib/parceiros/types";
import { PARTICIPANTE_TIPOS } from "@/lib/parceiros/constants";

async function resolveEmpresaIdPadrao(): Promise<string> {
  const { empresaAtiva } = await getCurrentTenantContext();
  if (empresaAtiva?.id) return empresaAtiva.id;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", "gauchinho")
    .single();
  if (error || !data) throw new Error("Empresa ativa não encontrada.");
  return data.id as string;
}

async function assertAdminAccess(empresaId: string) {
  if (await isPlatformSuperadmin()) return;
  const { empresaAtiva } = await getCurrentTenantContext();
  if (empresaAtiva?.id && empresaAtiva.id === empresaId) return;

  const ready = await isFase3ParticipantesSchemaReady();
  if (!ready) throw new Error(fase3AdminDisabledMessage());
  try {
    await requireGerenciarParticipantes(empresaId);
  } catch {
    if (!empresaAtiva?.id) {
      throw new Error("Sem permissão para gerenciar participantes nesta empresa.");
    }
  }
}

export async function fetchParticipantesList(filters?: {
  status?: string;
  q?: string;
}): Promise<{ ready: boolean; message?: string; rows: ParticipanteComTipos[]; empresaId: string | null }> {
  try {
    const empresaId = await resolveEmpresaIdPadrao();
    const supabase = await createClient();
    let query = supabase
      .from("participantes_comerciais")
      .select("*, participante_tipos(tipo_codigo)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false });

    if (filters?.status) query = query.eq("status", filters.status);
    if (filters?.q?.trim()) {
      const q = filters.q.trim();
      query = query.or(`nome.ilike.%${q}%,email.ilike.%${q}%,whatsapp.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const { data: euData } = await supabase
      .from("empresa_usuarios")
      .select("usuario_id, erp_modulos_visiveis")
      .eq("empresa_id", empresaId);

    const euMap = new Map<string, string[]>();
    (euData ?? []).forEach((eu: any) => {
      if (eu.usuario_id && Array.isArray(eu.erp_modulos_visiveis)) {
        euMap.set(eu.usuario_id, eu.erp_modulos_visiveis);
      }
    });

    const rows: ParticipanteComTipos[] = (data ?? []).map((row: Record<string, unknown>) => {
      const tiposRaw = row.participante_tipos as Array<{ tipo_codigo: string }> | null;
      const { participante_tipos: _t, ...rest } = row;
      const uId = row.usuario_id as string | null;
      let modulos = row.modulos_permitidos as string[] | null;
      if ((modulos === null || modulos === undefined) && uId && euMap.has(uId)) {
        modulos = euMap.get(uId) ?? null;
      }
      return {
        ...(rest as unknown as ParticipanteComTipos),
        modulos_permitidos: modulos,
        tipos: (tiposRaw ?? [])
          .map((t) => t.tipo_codigo)
          .filter((c): c is (typeof PARTICIPANTE_TIPOS)[number] =>
            (PARTICIPANTE_TIPOS as readonly string[]).includes(c)
          ),
      };
    });

    return { ready: true, rows, empresaId };
  } catch (err) {
    return {
      ready: true,
      rows: [],
      empresaId: null,
      message: err instanceof Error ? err.message : "Erro ao listar participantes.",
    };
  }
}

export async function createParticipanteAction(formData: FormData): Promise<{ ok: boolean; success: boolean; error?: string }> {
  try {
    const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
    await assertAdminAccess(empresaId);

    const tipos = formData.getAll("tipos").map(String);
    const modulosArray = formData.getAll("modulos_permitidos").map(String);
    const modulosRaw = formData.get("modulos_permitidos");
    let modulosPermitidos: string[] = modulosArray.length > 0 ? modulosArray : [];
    if (modulosPermitidos.length === 0 && typeof modulosRaw === "string" && modulosRaw.trim().startsWith("[")) {
      try {
        modulosPermitidos = JSON.parse(modulosRaw);
      } catch {
        modulosPermitidos = [];
      }
    }

    const input = {
      empresaId,
      nome: String(formData.get("nome") ?? ""),
      tipos,
      status: String(formData.get("status") ?? "RASCUNHO"),
      telefone: String(formData.get("telefone") ?? "") || null,
      whatsapp: String(formData.get("whatsapp") ?? "") || null,
      cpf: String(formData.get("cpf") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      usuarioId: String(formData.get("usuario_id") ?? "") || null,
    };

    const validated = validateParticipanteCreateInput(input);
    if (!validated.ok) return { ok: false, success: false, error: validated.error };

    const supabase = await createClient();

    if (input.usuarioId && input.status === "ATIVO") {
      const { data: existing } = await supabase
        .from("participantes_comerciais")
        .select("id, empresa_id, usuario_id")
        .eq("empresa_id", empresaId)
        .eq("usuario_id", input.usuarioId)
        .eq("status", "ATIVO");
      const linkCheck = canLinkUsuarioToParticipante({
        usuarioId: input.usuarioId,
        empresaId,
        existingActiveLinks: (existing ?? []).map((e) => ({
          participanteId: e.id,
          empresaId: e.empresa_id,
          usuarioId: e.usuario_id!,
        })),
      });
      if (!linkCheck.ok) return { ok: false, success: false, error: linkCheck.error };
    }

    const gestorId = String(formData.get("gestor_participante_id") ?? "") || null;
    if (gestorId) {
      const { data: gestor } = await supabase
        .from("participantes_comerciais")
        .select("empresa_id")
        .eq("id", gestorId)
        .maybeSingle();
      const gCheck = validateGestorMesmaEmpresa({
        participanteEmpresaId: empresaId,
        gestorEmpresaId: gestor?.empresa_id,
      });
      if (!gCheck.ok) return { ok: false, success: false, error: gCheck.error };
    }

    let createdId: string | null = null;
    try {
      const { data: created, error } = await supabase
        .from("participantes_comerciais")
        .insert({
          empresa_id: empresaId,
          nome: input.nome.trim(),
          nome_exibicao: String(formData.get("nome_exibicao") ?? "") || null,
          cpf: normalizeCpf(input.cpf),
          email: normalizeEmail(input.email),
          telefone: input.telefone,
          whatsapp: input.whatsapp,
          cargo: String(formData.get("cargo") ?? "") || null,
          status: input.status,
          usuario_id: input.usuarioId,
          gestor_participante_id: gestorId,
          observacoes: String(formData.get("observacoes") ?? "") || null,
          data_entrada: String(formData.get("data_entrada") ?? "") || null,
          escopo_visualizacao: String(formData.get("escopo_visualizacao") ?? "TODOS"),
          modulos_permitidos: modulosPermitidos,
        })
        .select("id")
        .single();

      if (error) throw error;
      createdId = created.id;
    } catch {
      const { data: createdFallback, error: fallbackError } = await supabase
        .from("participantes_comerciais")
        .insert({
          empresa_id: empresaId,
          nome: input.nome.trim(),
          cpf: normalizeCpf(input.cpf),
          email: normalizeEmail(input.email),
          telefone: input.telefone,
          whatsapp: input.whatsapp,
          status: input.status,
          usuario_id: input.usuarioId,
          gestor_participante_id: gestorId,
          data_entrada: String(formData.get("data_entrada") ?? "") || null,
        })
        .select("id")
        .single();

      if (fallbackError) return { ok: false, success: false, error: fallbackError.message };
      createdId = createdFallback.id;
    }

    if (createdId && tipos.length) {
      try {
        await supabase.from("participante_tipos").insert(
          tipos.map((tipo_codigo) => ({
            participante_id: createdId,
            empresa_id: empresaId,
            tipo_codigo,
          }))
        );
      } catch {
        // Tolerar
      }
    }

    if (input.usuarioId && modulosPermitidos.length > 0) {
      try {
        await supabase
          .from("empresa_usuarios")
          .update({ erp_modulos_visiveis: modulosPermitidos })
          .eq("empresa_id", empresaId)
          .eq("usuario_id", input.usuarioId);
      } catch {
        // Tolerar
      }
    }

    try {
      if (createdId) {
        await supabase.from("participante_auditoria").insert({
          participante_id: createdId,
          empresa_id: empresaId,
          acao: "CRIAR",
          payload: { status: input.status, tipos, modulos_permitidos: modulosPermitidos },
        });
      }
    } catch {
      // Tolerar
    }

    revalidatePath("/admin/participantes");
    revalidatePath("/erp/consultores");
    return { ok: true, success: true };
  } catch (err) {
    return { ok: false, success: false, error: err instanceof Error ? err.message : "Erro ao criar participante." };
  }
}

export async function updateParticipanteAction(formData: FormData): Promise<{ ok: boolean; success: boolean; error?: string }> {
  try {
    const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
    await assertAdminAccess(empresaId);

    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, success: false, error: "ID do participante obrigatório." };

    const tipos = formData.getAll("tipos").map(String);
    const modulosArray = formData.getAll("modulos_permitidos").map(String);
    const modulosRaw = formData.get("modulos_permitidos");
    let modulosPermitidos: string[] = modulosArray.length > 0 ? modulosArray : [];
    if (modulosPermitidos.length === 0 && typeof modulosRaw === "string" && modulosRaw.trim().startsWith("[")) {
      try {
        modulosPermitidos = JSON.parse(modulosRaw);
      } catch {
        modulosPermitidos = [];
      }
    }

    const input = {
      empresaId,
      nome: String(formData.get("nome") ?? ""),
      tipos,
      status: String(formData.get("status") ?? "ATIVO"),
      telefone: String(formData.get("telefone") ?? "") || null,
      whatsapp: String(formData.get("whatsapp") ?? "") || null,
      cpf: String(formData.get("cpf") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      usuarioId: String(formData.get("usuario_id") ?? "") || null,
    };

    const validated = validateParticipanteCreateInput(input);
    if (!validated.ok) return { ok: false, success: false, error: validated.error };

    const supabase = await createClient();

    // Preserva usuario_id se já estava associado
    let finalUsuarioId = input.usuarioId;
    if (!finalUsuarioId) {
      const { data: existingPart } = await supabase
        .from("participantes_comerciais")
        .select("usuario_id")
        .eq("id", id)
        .eq("empresa_id", empresaId)
        .maybeSingle();
      if (existingPart?.usuario_id) {
        finalUsuarioId = existingPart.usuario_id;
      }
    }

    const gestorId = String(formData.get("gestor_participante_id") ?? "") || null;

    const updatePayload: Record<string, unknown> = {
      nome: input.nome.trim(),
      nome_exibicao: String(formData.get("nome_exibicao") ?? "") || null,
      cpf: normalizeCpf(input.cpf),
      email: normalizeEmail(input.email),
      telefone: input.telefone,
      whatsapp: input.whatsapp,
      cargo: String(formData.get("cargo") ?? "") || null,
      status: input.status,
      usuario_id: finalUsuarioId,
      gestor_participante_id: gestorId,
      observacoes: String(formData.get("observacoes") ?? "") || null,
      modulos_permitidos: modulosPermitidos,
      escopo_visualizacao: String(formData.get("escopo_visualizacao") ?? "TODOS"),
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from("participantes_comerciais")
      .update(updatePayload)
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (updateErr) {
      delete updatePayload.modulos_permitidos;
      const { error: fbErr } = await supabase
        .from("participantes_comerciais")
        .update(updatePayload)
        .eq("id", id)
        .eq("empresa_id", empresaId);
      if (fbErr) return { ok: false, success: false, error: fbErr.message };
    }

    if (finalUsuarioId) {
      try {
        await supabase
          .from("empresa_usuarios")
          .update({ erp_modulos_visiveis: modulosPermitidos })
          .eq("empresa_id", empresaId)
          .eq("usuario_id", finalUsuarioId);
      } catch {
        // Tolerar
      }
    }

    if (tipos.length) {
      try {
        await supabase.from("participante_tipos").delete().eq("participante_id", id).eq("empresa_id", empresaId);
        await supabase.from("participante_tipos").insert(
          tipos.map((tipo_codigo) => ({
            participante_id: id,
            empresa_id: empresaId,
            tipo_codigo,
          }))
        );
      } catch {
        // Tolerar
      }
    }

    if (input.usuarioId && modulosPermitidos.length > 0) {
      try {
        await supabase
          .from("empresa_usuarios")
          .update({ erp_modulos_visiveis: modulosPermitidos })
          .eq("empresa_id", empresaId)
          .eq("usuario_id", input.usuarioId);
      } catch {
        // Tolerar
      }
    }

    try {
      await supabase.from("participante_auditoria").insert({
        participante_id: id,
        empresa_id: empresaId,
        acao: "EDITAR",
        payload: { status: input.status, tipos, modulos_permitidos: modulosPermitidos },
      });
    } catch {
      // Tolerar
    }

    revalidatePath("/admin/participantes");
    revalidatePath("/erp/consultores");
    return { ok: true, success: true };
  } catch (err) {
    return { ok: false, success: false, error: err instanceof Error ? err.message : "Erro ao atualizar participante." };
  }
}


export async function deleteParticipanteAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
    await assertAdminAccess(empresaId);
    const id = String(formData.get("id") ?? "");
    if (!id) return { success: false, error: "ID obrigatório para exclusão." };

    const deps = await verificarDependenciasParticipanteAction(id);
    if (!deps.pode_excluir) {
      return {
        success: false,
        error: `Não é possível excluir o participante: possui histórico vinculado (${deps.motivos.join(", ")}). Recomenda-se inativar o cadastro.`,
      };
    }

    const supabase = await createClient();
    await supabase.from("participante_tipos").delete().eq("participante_id", id).eq("empresa_id", empresaId);
    await supabase.from("participante_organizacoes").delete().eq("participante_id", id).eq("empresa_id", empresaId);
    const { error } = await supabase
      .from("participantes_comerciais")
      .delete()
      .eq("id", id)
      .eq("empresa_id", empresaId);

    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/participantes");
    revalidatePath("/erp/consultores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir participante." };
  }
}

export async function updateParticipanteStatusAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
    await assertAdminAccess(empresaId);
    const id = String(formData.get("id") ?? "");
    const status = String(formData.get("status") ?? "");
    if (!id) return { success: false, error: "ID obrigatório." };

    const supabase = await createClient();
    const { error } = await supabase
      .from("participantes_comerciais")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("empresa_id", empresaId);
    if (error) return { success: false, error: error.message };

    const acaoMap: Record<string, string> = {
      ATIVO: "ATIVAR",
      INATIVO: "INATIVAR",
      SUSPENSO: "SUSPENDER",
      DESLIGADO: "DESLIGAR",
    };
    await supabase.from("participante_auditoria").insert({
      participante_id: id,
      empresa_id: empresaId,
      acao: acaoMap[status] ?? "ATUALIZAR",
      motivo: String(formData.get("motivo") ?? "") || null,
    });

    revalidatePath("/admin/participantes");
    revalidatePath("/erp/consultores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar status do participante." };
  }
}

export async function vincularParticipanteOrganizacaoAction(formData: FormData): Promise<{ success: boolean; error?: string }> {
  try {
    const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
    await assertAdminAccess(empresaId);

    const participanteId = String(formData.get("participante_id") ?? "");
    const organizacaoId = String(formData.get("organizacao_parceira_id") ?? "");
    const responsavelPrincipal = formData.get("responsavel_principal") === "on";
    const principal = formData.get("principal") === "on";

    const supabase = await createClient();
    const [{ data: part }, { data: org }] = await Promise.all([
      supabase.from("participantes_comerciais").select("empresa_id").eq("id", participanteId).maybeSingle(),
      supabase.from("organizacoes_parceiras").select("empresa_id").eq("id", organizacaoId).maybeSingle(),
    ]);

    const same = validateVinculoParticipanteOrganizacao({
      participanteEmpresaId: part?.empresa_id ?? "",
      organizacaoEmpresaId: org?.empresa_id ?? "",
    });
    if (!same.ok) return { success: false, error: same.error };

    if (responsavelPrincipal) {
      const { data: existing } = await supabase
        .from("participante_organizacoes")
        .select("id, organizacao_parceira_id, ativo")
        .eq("organizacao_parceira_id", organizacaoId)
        .eq("responsavel_principal", true)
        .eq("ativo", true);
      const check = validateResponsavelPrincipalUnico({
        organizacaoId,
        settingPrincipal: true,
        ativo: true,
        existingPrincipals: (existing ?? []).map((e) => ({
          id: e.id,
          organizacaoId: e.organizacao_parceira_id,
          ativo: e.ativo,
        })),
      });
      if (!check.ok) return { success: false, error: check.error };
    }

    const { error } = await supabase.from("participante_organizacoes").upsert(
      {
        empresa_id: empresaId,
        participante_id: participanteId,
        organizacao_parceira_id: organizacaoId,
        funcao: String(formData.get("funcao") ?? "") || null,
        principal,
        responsavel_principal: responsavelPrincipal,
        ativo: true,
      },
      { onConflict: "participante_id,organizacao_parceira_id" }
    );
    if (error) return { success: false, error: error.message };

    await supabase.from("participante_auditoria").insert({
      participante_id: participanteId,
      empresa_id: empresaId,
      acao: "VINCULAR_ORGANIZACAO",
      payload: { organizacao_parceira_id: organizacaoId },
    });

    revalidatePath("/admin/participantes");
    revalidatePath("/admin/organizacoes-parceiras");
    revalidatePath("/erp/consultores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao vincular organização." };
  }
}

export async function canAccessParticipantesAdmin(): Promise<boolean> {
  if (await isPlatformSuperadmin()) return true;
  try {
    const empresaId = await resolveEmpresaIdPadrao();
    await requireGerenciarParticipantes(empresaId);
    return true;
  } catch {
    return false;
  }
}


export async function verificarDependenciasParticipanteAction(participanteId: string): Promise<{
  pode_excluir: boolean;
  total_vinculos: number;
  motivos: string[];
}> {
  try {
    const supabase = await createClient();
    const motivos: string[] = [];
    let total = 0;

    const [vendas, propostas, clientes, leads] = await Promise.all([
      supabase.from("vendas").select("id", { count: "exact", head: true }).eq("participante_id", participanteId),
      supabase.from("propostas").select("id", { count: "exact", head: true }).eq("participante_comercial_id", participanteId),
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("participante_comercial_id", participanteId),
      supabase.from("leads").select("id", { count: "exact", head: true }).eq("consultor_id", participanteId),
    ]);

    if (vendas.count) {
      total += vendas.count;
      motivos.push(`${vendas.count} venda(s)`);
    }
    if (propostas.count) {
      total += propostas.count;
      motivos.push(`${propostas.count} proposta(s)`);
    }
    if (clientes.count) {
      total += clientes.count;
      motivos.push(`${clientes.count} cliente(s)`);
    }
    if (leads.count) {
      total += leads.count;
      motivos.push(`${leads.count} lead(s)`);
    }

    return {
      pode_excluir: total === 0,
      total_vinculos: total,
      motivos,
    };
  } catch {
    return {
      pode_excluir: false,
      total_vinculos: 1,
      motivos: ["Erro ao verificar dependências"],
    };
  }
}
