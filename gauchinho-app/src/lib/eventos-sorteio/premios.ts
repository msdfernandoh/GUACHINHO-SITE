import { createAdminClient } from "@/lib/supabase/admin";

export type EventoPremioRow = {
  id: string;
  evento_id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  imagem_url: string | null;
  status: "pendente" | "sorteado" | "cancelado";
  ganhador_participante_id: string | null;
  sorteado_at: string | null;
  created_at: string;
  updated_at: string;
  ganhador_nome?: string;
  ganhador_codigo?: string;
};

export async function listPremiosEvento(eventoId: string): Promise<EventoPremioRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("eventos_premios")
    .select("*, eventos_sorteio_participantes(nome, codigo)")
    .eq("evento_id", eventoId)
    .order("ordem", { ascending: true });

  if (error) {
    if (/eventos_premios|schema cache|does not exist/i.test(error.message)) {
      return [];
    }
    throw new Error(error.message);
  }

  type RowWithPart = EventoPremioRow & {
    eventos_sorteio_participantes?: { nome?: string; codigo?: string } | { nome?: string; codigo?: string }[] | null;
  };

  return (data ?? []).map((row: RowWithPart) => {
    const partRaw = row.eventos_sorteio_participantes;
    const part = Array.isArray(partRaw) ? partRaw[0] : partRaw;
    return {
      ...row,
      ganhador_nome: part?.nome,
      ganhador_codigo: part?.codigo,
    };
  });
}

export async function criarPremioEvento(params: {
  eventoId: string;
  titulo: string;
  descricao?: string;
  imagemUrl?: string;
  ordem?: number;
}): Promise<EventoPremioRow> {
  const admin = createAdminClient();
  const titulo = params.titulo.trim();
  if (!titulo) throw new Error("Título do prêmio é obrigatório");

  let ordem = params.ordem;
  if (!ordem) {
    const { count } = await admin
      .from("eventos_premios")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", params.eventoId);
    ordem = (count ?? 0) + 1;
  }

  const { data, error } = await admin
    .from("eventos_premios")
    .insert({
      evento_id: params.eventoId,
      titulo,
      descricao: params.descricao?.trim() || null,
      imagem_url: params.imagemUrl?.trim() || null,
      ordem,
      status: "pendente",
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Falha ao criar prêmio");
  return data as EventoPremioRow;
}

export async function atualizarPremioEvento(
  id: string,
  patch: { titulo?: string; descricao?: string; imagemUrl?: string; ordem?: number; status?: "pendente" | "sorteado" | "cancelado" },
): Promise<void> {
  const admin = createAdminClient();
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.titulo !== undefined) row.titulo = patch.titulo.trim();
  if (patch.descricao !== undefined) row.descricao = patch.descricao.trim() || null;
  if (patch.imagemUrl !== undefined) row.imagem_url = patch.imagemUrl.trim() || null;
  if (patch.ordem !== undefined) row.ordem = patch.ordem;
  if (patch.status !== undefined) row.status = patch.status;

  const { error } = await admin.from("eventos_premios").update(row).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function excluirPremioEvento(id: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("eventos_premios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
