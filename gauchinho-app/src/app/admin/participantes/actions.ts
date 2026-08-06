"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { requireGerenciarParticipantes } from "@/lib/parceiros/authorization";
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
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("empresas")
    .select("id")
    .eq("slug", "gauchinho")
    .single();
  if (error || !data) throw new Error("Empresa Gauchinho não encontrada.");
  return data.id as string;
}

async function assertAdminAccess(empresaId: string) {
  const ready = await isFase3ParticipantesSchemaReady();
  if (!ready) throw new Error(fase3AdminDisabledMessage());
  await requireGerenciarParticipantes(empresaId);
}

export async function fetchParticipantesList(filters?: {
  status?: string;
  q?: string;
}): Promise<{ ready: boolean; message?: string; rows: ParticipanteComTipos[]; empresaId: string | null }> {
  const ready = await isFase3ParticipantesSchemaReady();
  if (!ready) {
    return { ready: false, message: fase3AdminDisabledMessage(), rows: [], empresaId: null };
  }

  const empresaId = await resolveEmpresaIdPadrao();
  await requireGerenciarParticipantes(empresaId);

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

  const rows: ParticipanteComTipos[] = (data ?? []).map((row: Record<string, unknown>) => {
    const tiposRaw = row.participante_tipos as Array<{ tipo_codigo: string }> | null;
    const { participante_tipos: _t, ...rest } = row;
    return {
      ...(rest as unknown as ParticipanteComTipos),
      tipos: (tiposRaw ?? [])
        .map((t) => t.tipo_codigo)
        .filter((c): c is (typeof PARTICIPANTE_TIPOS)[number] =>
          (PARTICIPANTE_TIPOS as readonly string[]).includes(c)
        ),
    };
  });

  return { ready: true, rows, empresaId };
}

export async function createParticipanteAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertAdminAccess(empresaId);

  const tipos = formData.getAll("tipos").map(String);
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
  if (!validated.ok) throw new Error(validated.error);

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
    if (!linkCheck.ok) throw new Error(linkCheck.error);
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
    if (!gCheck.ok) throw new Error(gCheck.error);
  }

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
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (tipos.length) {
    const { error: tipoError } = await supabase.from("participante_tipos").insert(
      tipos.map((tipo_codigo) => ({
        participante_id: created.id,
        empresa_id: empresaId,
        tipo_codigo,
      }))
    );
    if (tipoError) throw new Error(tipoError.message);
  }

  await supabase.from("participante_auditoria").insert({
    participante_id: created.id,
    empresa_id: empresaId,
    acao: "CRIAR",
    payload: { status: input.status, tipos },
  });

  revalidatePath("/admin/participantes");
}

export async function updateParticipanteStatusAction(formData: FormData) {
  const empresaId = String(formData.get("empresa_id") || (await resolveEmpresaIdPadrao()));
  await assertAdminAccess(empresaId);
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) throw new Error("ID obrigatório.");
  const validated = validateParticipanteCreateInput({
    empresaId,
    nome: "x",
    tipos: ["CONSULTOR"],
    status,
    telefone: "1",
  });
  if (!validated.ok) throw new Error(validated.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("participantes_comerciais")
    .update({ status })
    .eq("id", id)
    .eq("empresa_id", empresaId);
  if (error) throw new Error(error.message);

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
}

export async function vincularParticipanteOrganizacaoAction(formData: FormData) {
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
  if (!same.ok) throw new Error(same.error);

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
    if (!check.ok) throw new Error(check.error);
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
  if (error) throw new Error(error.message);

  await supabase.from("participante_auditoria").insert({
    participante_id: participanteId,
    empresa_id: empresaId,
    acao: "VINCULAR_ORGANIZACAO",
    payload: { organizacao_parceira_id: organizacaoId },
  });

  revalidatePath("/admin/participantes");
  revalidatePath("/admin/organizacoes-parceiras");
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
