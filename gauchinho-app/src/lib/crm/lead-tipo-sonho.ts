import { createClient } from "@/lib/supabase/server";
import type { LeadListRow } from "./types";

function tipoSonhoFromDadosSimulacao(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return null;
  const ts = (raw as Record<string, unknown>).tipo_sonho;
  return typeof ts === "string" && ts.trim() ? ts.trim() : null;
}

/** Preenche `tipo_sonho` a partir do participante do sorteio ou de dados_simulacao do lead. */
export async function enrichLeadsWithTipoSonho(rows: LeadListRow[]): Promise<LeadListRow[]> {
  if (!rows.length) return rows;

  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const map = new Map<string, string>();

  const { data: participantes, error: partErr } = await supabase
    .from("eventos_sorteio_participantes")
    .select("lead_id, tipo_sonho, created_at")
    .in("lead_id", ids)
    .not("lead_id", "is", null)
    .order("created_at", { ascending: false });

  if (!partErr) {
    for (const row of participantes ?? []) {
      const leadId = row.lead_id as string | null;
      const tipo = row.tipo_sonho as string | null;
      if (leadId && tipo?.trim() && !map.has(leadId)) map.set(leadId, tipo.trim());
    }
  }

  const missing = ids.filter((id) => !map.has(id));
  if (missing.length) {
    const { data: leadsExtra } = await supabase.from("leads").select("id, dados_simulacao").in("id", missing);
    for (const row of leadsExtra ?? []) {
      const tipo = tipoSonhoFromDadosSimulacao(row.dados_simulacao);
      if (tipo) map.set(row.id as string, tipo);
    }
  }

  return rows.map((r) => ({ ...r, tipo_sonho: map.get(r.id) ?? null }));
}
