/** Rótulo público da modalidade do grupo (valor interno no banco pode ser "Auto"). */
export function labelModalidadeGrupoPublica(modalidade: string): string {
  if (modalidade === "Auto") return "Veículo";
  return modalidade;
}
