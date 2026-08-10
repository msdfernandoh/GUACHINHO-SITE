import { createAdminClient } from "@/lib/supabase/admin";

export type EquipeRow = {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  gestor_id: string | null;
  status: "ativa" | "inativa";
  created_at: string;
  updated_at: string;
  gestor?: {
    id: string;
    nome: string;
    email: string | null;
  } | null;
  membros_count?: number;
};

export type EquipeMembroRow = {
  id: string;
  equipe_id: string;
  participante_id: string;
  papel_equipe: "gestor" | "membro" | "supervisor";
  created_at: string;
  participante?: {
    id: string;
    nome: string;
    email: string | null;
    tipo_participante: string;
  } | null;
};

export async function listEquipesForEmpresa(empresaId: string): Promise<EquipeRow[]> {
  const admin = createAdminClient();

  const { data: equipes, error } = await admin
    .from("equipes")
    .select("*, gestor:participantes_comerciais!gestor_id(id, nome, email), membros:equipe_membros(count)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao listar equipes: ${error.message}`);
  }

  return (equipes || []).map((e: any) => ({
    ...e,
    membros_count: e.membros?.[0]?.count || 0,
  }));
}

export async function createEquipe(
  empresaId: string,
  data: {
    nome: string;
    descricao?: string;
    gestor_id?: string;
    status?: "ativa" | "inativa";
  },
): Promise<EquipeRow> {
  const admin = createAdminClient();

  const { data: equipe, error } = await admin
    .from("equipes")
    .insert({
      empresa_id: empresaId,
      nome: data.nome,
      descricao: data.descricao || null,
      gestor_id: data.gestor_id || null,
      status: data.status || "ativa",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar equipe: ${error.message}`);
  }

  // Se houver gestor_id, insere automaticamente como membro com papel gestor
  if (data.gestor_id) {
    await admin.from("equipe_membros").insert({
      equipe_id: equipe.id,
      participante_id: data.gestor_id,
      papel_equipe: "gestor",
    });
  }

  return equipe as EquipeRow;
}

export async function addMembroEquipe(
  empresaId: string,
  equipeId: string,
  participanteId: string,
  papelEquipe: "gestor" | "membro" | "supervisor" = "membro",
): Promise<EquipeMembroRow> {
  const admin = createAdminClient();

  // Valida que a equipe pertence ao tenant
  const { data: equipe } = await admin
    .from("equipes")
    .select("id")
    .eq("id", equipeId)
    .eq("empresa_id", empresaId)
    .single();

  if (!equipe) {
    throw new Error("Acesso negado ou equipe não encontrada.");
  }

  const { data: membro, error } = await admin
    .from("equipe_membros")
    .insert({
      equipe_id: equipeId,
      participante_id: participanteId,
      papel_equipe: papelEquipe,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao adicionar membro à equipe: ${error.message}`);
  }

  return membro as EquipeMembroRow;
}

export async function removeMembroEquipe(
  empresaId: string,
  equipeId: string,
  participanteId: string,
): Promise<void> {
  const admin = createAdminClient();

  // Valida que a equipe pertence ao tenant
  const { data: equipe } = await admin
    .from("equipes")
    .select("id")
    .eq("id", equipeId)
    .eq("empresa_id", empresaId)
    .single();

  if (!equipe) {
    throw new Error("Acesso negado ou equipe não encontrada.");
  }

  const { error } = await admin
    .from("equipe_membros")
    .delete()
    .eq("equipe_id", equipeId)
    .eq("participante_id", participanteId);

  if (error) {
    throw new Error(`Erro ao remover membro da equipe: ${error.message}`);
  }
}
