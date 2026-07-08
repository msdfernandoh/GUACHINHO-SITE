import type { EventoListaConvidadosItemRow } from "./listas-convidados-types";

export function countListaConvidadosItens(itens: Pick<EventoListaConvidadosItemRow, "status_presenca">[]) {
  let confirmados = 0;
  let presentes = 0;
  let cancelados = 0;
  for (const item of itens) {
    if (item.status_presenca === "confirmado") confirmados += 1;
    if (item.status_presenca === "presente") presentes += 1;
    if (item.status_presenca === "cancelado") cancelados += 1;
  }
  return {
    total: itens.length,
    confirmados,
    presentes,
    cancelados,
  };
}
