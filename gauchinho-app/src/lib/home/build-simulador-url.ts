export type QuickSimuladorParams = {
  tipo?: "imovel" | "automovel";
  solucao?: "consorcio" | "financiamento";
  valor?: number;
  prazo?: number;
  origem?: string;
  imovelId?: string;
};

/** Monta query string para `/simulador` a partir da home ou cards de sonho. */
export function buildSimuladorUrl(params: QuickSimuladorParams): string {
  const sp = new URLSearchParams();
  if (params.solucao === "financiamento") sp.set("solucao", "financiamento");
  else if (params.solucao === "consorcio") sp.set("solucao", "consorcio");
  if (params.tipo === "imovel" || params.tipo === "automovel") sp.set("tipo", params.tipo);
  if (params.valor != null && Number.isFinite(params.valor) && params.valor > 0) {
    sp.set("valor", String(Math.round(params.valor)));
  }
  if (params.prazo != null && Number.isFinite(params.prazo) && params.prazo > 0) {
    sp.set("prazo", String(Math.round(params.prazo)));
  }
  if (params.origem?.trim()) sp.set("origem", params.origem.trim());
  if (params.imovelId?.trim()) sp.set("imovel_id", params.imovelId.trim());
  const q = sp.toString();
  return q ? `/simulador?${q}` : "/simulador";
}
