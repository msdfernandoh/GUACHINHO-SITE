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
    const lote = idsSemNome.slice(inicio, inicio + 100);
    const { data } = await supabase
      .from("eventos_sorteio_indicacoes")
      .select("lead_id, indicador:eventos_sorteio_participantes!indicador_participante_id(nome)")
      .in("lead_id", lote)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<{ lead_id: string; indicador: { nome: string } | null }[]>();

    for (const { lead_id, indicador } of data ?? []) {
      const nome = indicador?.nome.trim();
      if (nome && !nomesPorLead.has(lead_id)) nomesPorLead.set(lead_id, nome);
    }

    const semVinculo = lote.filter((id) => !nomesPorLead.has(id));
    if (semVinculo.length === 0) continue;

    const { data: historico } = await supabase
      .from("eventos_site")
      .select("lead_id, dados_evento")
      .in("lead_id", semVinculo)
      .eq("tipo_evento", "lead_criado")
      .eq("origem", "indicacao")
      .eq("pagina", "evento_nps_sorteio")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<{ lead_id: string; dados_evento: { indicador?: unknown } | null }[]>();

    for (const { lead_id, dados_evento } of historico ?? []) {
      const indicador = dados_evento?.indicador;
      if (typeof indicador === "string" && indicador.trim() && !nomesPorLead.has(lead_id)) {
        nomesPorLead.set(lead_id, indicador.trim());
      }
    }
  }

  return leads.map((lead) => {
    const nome = nomeRegistrado(lead) ?? nomesPorLead.get(lead.id);
    return nome ? { ...lead, indicador_nome: nome } : lead;
  });
}
