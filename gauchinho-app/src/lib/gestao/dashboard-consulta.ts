import type { ErpDashboardFullDTO, ErpDashboardPeriodFilter } from "./dashboards-service";

const periodos: ReadonlyArray<ErpDashboardPeriodFilter> = [
  "mes_atual", "mes_anterior", "ultimos_3_meses", "ultimos_6_meses", "ultimos_12_meses", "personalizado",
];

export function normalizarPeriodoDashboard(valor: string | null): ErpDashboardPeriodFilter {
  return periodos.find((periodo) => periodo === valor) ?? "mes_atual";
}

export async function consultarDashboard({ periodo, administradoraId, signal, fetcher = fetch }: {
  periodo: ErpDashboardPeriodFilter;
  administradoraId: string;
  signal: AbortSignal;
  fetcher?: typeof fetch;
}): Promise<ErpDashboardFullDTO> {
  const params = new URLSearchParams({ periodo });
  if (administradoraId) params.set("administradoraId", administradoraId);
  const resposta = await fetcher(`/api/admin/gestao/dashboard?${params}`, { signal, cache: "no-store" });
  if (!resposta.ok) throw new Error(`Não foi possível atualizar o dashboard (HTTP ${resposta.status}).`);
  const resultado: ErpDashboardFullDTO = await resposta.json();
  // Alguns transportes podem concluir mesmo depois do cancelamento.
  if (signal.aborted) throw new DOMException("Consulta cancelada.", "AbortError");
  return resultado;
}
