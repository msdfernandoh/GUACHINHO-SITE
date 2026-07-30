export type VisualizacaoProposta = "completa" | "resumida";

export function buildPropostaVisualizacaoUrl(
  rawUrl: string,
  visualizacao: VisualizacaoProposta,
): string {
  const isAbsolute = /^https?:\/\//i.test(rawUrl);
  const url = new URL(rawUrl, "http://local.invalid");

  if (visualizacao === "resumida") {
    url.searchParams.set("visualizacao", "resumida");
  } else {
    url.searchParams.delete("visualizacao");
  }

  return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
}
