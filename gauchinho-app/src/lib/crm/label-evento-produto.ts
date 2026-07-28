import type { LeadListRow } from "./types";

/** Texto da coluna Evento / Produto — prioriza nome do evento sem confundir com produto. */
export function labelEventoProduto(
  lead: Pick<LeadListRow, "evento_nome" | "produto_interesse" | "tipo_interesse">,
): string {
  const evento = lead.evento_nome?.trim() || null;
  const produtoRaw = lead.produto_interesse?.trim() || null;
  const tipo = lead.tipo_interesse?.trim() || null;
  const produto =
    produtoRaw && evento && produtoRaw.toLowerCase() === evento.toLowerCase()
      ? null
      : produtoRaw || tipo;

  if (evento && produto) return `${evento} · ${produto}`;
  if (evento) return evento;
  if (produto) return produto;
  return "—";
}
