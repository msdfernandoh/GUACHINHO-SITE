import type { createClient } from "@/lib/supabase/server";

type LeadComIndicacao = {
  id: string;
  origem?: string | null;
  dados_simulacao?: unknown;
  parceiro_indicador_nome?: string | null;
};

function nomeRegistrado(lead: LeadComIndicacao): string | undefined {
  const dados = lead.dados_simulacao as {
    origem?: unknown;
    indicador_nome?: unknown;
    spl?: { indicado_por?: unknown };
  } | null | undefined;
  const nomeCheckin = dados?.origem === "evento_nps_sorteio_indicacao"
    ? dados.indicador_nome
    : dados?.spl?.indicado_por;
  const nomeIndicacao = lead.origem?.trim().toLowerCase() === "indicacao"
    ? lead.parceiro_indicador_nome?.trim()
    : undefined;
  return nomeIndicacao ||
    (typeof nomeCheckin === "string" ? nomeCheckin.trim() || undefined : undefined);
}

export async function incluirIndicadoresDosLeads<T extends LeadComIndicacao>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  leads: T[],
): Promise<(T & { indicador_nome?: string })[]> {
  const idsSemNome = leads
    .filter((lead) => !nomeRegistrado(lead))
    .map(({ id }) => id);
  const nomesPorLead = new Map<string, string>();

  for (let inicio = 0; inicio < idsSemNome.length; inicio += 100) {
    const { data } = await supabase
      .from("eventos_sorteio_indicacoes")
      .select("lead_id, indicador:eventos_sorteio_participantes!indicador_participante_id(nome)")
      .in("lead_id", idsSemNome.slice(inicio, inicio + 100))
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<{ lead_id: string; indicador: { nome: string } | null }[]>();

    for (const { lead_id, indicador } of data ?? []) {
      const nome = indicador?.nome.trim();
      if (nome && !nomesPorLead.has(lead_id)) nomesPorLead.set(lead_id, nome);
    }
  }

  return leads.map((lead) => {
    const nome = nomeRegistrado(lead) ?? nomesPorLead.get(lead.id);
    return nome ? { ...lead, indicador_nome: nome } : lead;
  });
}
