import { createAdminClient } from "@/lib/supabase/admin";

export type TarefaGestaoRow = {
  id: string;
  empresa_id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  equipe_id: string | null;
  origem_tipo: "lead" | "proposta" | "venda" | "participante" | "parceiro" | "interna" | null;
  origem_id: string | null;
  prioridade: "baixa" | "media" | "alta" | "urgente";
  status: "pendente" | "em_andamento" | "concluida" | "cancelada";
  data_limite: string | null;
  concluido_em: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  responsavel?: {
    id: string;
    nome: string;
    email: string | null;
  } | null;
  equipe?: {
    id: string;
    nome: string;
  } | null;
  is_atrasada?: boolean;
};

export async function listTarefasForEmpresa(
  empresaId: string,
  filters?: {
    status?: "pendente" | "em_andamento" | "concluida" | "cancelada";
    responsavel_id?: string;
    equipe_id?: string;
  },
): Promise<TarefaGestaoRow[]> {
  const admin = createAdminClient();

  let query = admin
    .from("tarefas_gestao")
    .select("*, responsavel:participantes_comerciais!responsavel_id(id, nome, email), equipe:equipes!equipe_id(id, nome)")
    .eq("empresa_id", empresaId)
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.responsavel_id) {
    query = query.eq("responsavel_id", filters.responsavel_id);
  }
  if (filters?.equipe_id) {
    query = query.eq("equipe_id", filters.equipe_id);
  }

  const { data: tarefas, error } = await query;
  if (error) {
    throw new Error(`Erro ao listar tarefas de gestão: ${error.message}`);
  }

  const nowIso = new Date().toISOString();
  return (tarefas || []).map((t: any) => ({
    ...t,
    is_atrasada:
      t.status !== "concluida" &&
      t.status !== "cancelada" &&
      t.data_limite &&
      t.data_limite < nowIso,
  }));
}

export async function createTarefa(
  empresaId: string,
  data: {
    titulo: string;
    descricao?: string;
    responsavel_id?: string;
    equipe_id?: string;
    origem_tipo?: "lead" | "proposta" | "venda" | "participante" | "parceiro" | "interna";
    origem_id?: string;
    prioridade?: "baixa" | "media" | "alta" | "urgente";
    data_limite?: string;
    created_by?: string;
  },
): Promise<TarefaGestaoRow> {
  const admin = createAdminClient();

  const { data: tarefa, error } = await admin
    .from("tarefas_gestao")
    .insert({
      empresa_id: empresaId,
      titulo: data.titulo,
      descricao: data.descricao || null,
      responsavel_id: data.responsavel_id || null,
      equipe_id: data.equipe_id || null,
      origem_tipo: data.origem_tipo || "interna",
      origem_id: data.origem_id || null,
      prioridade: data.prioridade || "media",
      status: "pendente",
      data_limite: data.data_limite || null,
      created_by: data.created_by || null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao criar tarefa: ${error.message}`);
  }

  return tarefa as TarefaGestaoRow;
}

export async function updateTarefaStatus(
  empresaId: string,
  tarefaId: string,
  status: "pendente" | "em_andamento" | "concluida" | "cancelada",
): Promise<TarefaGestaoRow> {
  const admin = createAdminClient();

  const concluidoEm = status === "concluida" ? new Date().toISOString() : null;

  const { data: tarefa, error } = await admin
    .from("tarefas_gestao")
    .update({
      status,
      concluido_em: concluidoEm,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tarefaId)
    .eq("empresa_id", empresaId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao atualizar status da tarefa: ${error.message}`);
  }

  return tarefa as TarefaGestaoRow;
}
