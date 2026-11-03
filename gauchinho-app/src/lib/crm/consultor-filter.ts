import type { ConsultorOption } from "@/lib/admin/consultores";
import type { LeadListRow } from "./types";

/** Filtra identidades comprovadas por vínculo; nomes iguais não juntam pessoas. */
export function matchesConsultor(lead: Pick<LeadListRow, "srd_responsavel_id">, selected: string, options: ConsultorOption[]) {
  if (!selected) return true;
  const option = options.find(c => c.id === selected);
  return lead.srd_responsavel_id === selected || Boolean(lead.srd_responsavel_id && option?.usuarioIds?.includes(lead.srd_responsavel_id));
}

/** Permite consultar responsáveis históricos sem torná-los elegíveis para nova atribuição. */
export function consultoresParaFiltro(options: ConsultorOption[], leads: LeadListRow[]) {
  const result = [...options];
  const ids = new Set(options.flatMap(c => [c.id, ...(c.usuarioIds ?? [])]));
  for (const lead of leads) {
    if (!lead.srd_responsavel_id || ids.has(lead.srd_responsavel_id)) continue;
    ids.add(lead.srd_responsavel_id);
    result.push({ id: lead.srd_responsavel_id, nome: `${lead.srd_responsavel_nome || "Responsável"} (vínculo histórico)` });
  }
  return result.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
