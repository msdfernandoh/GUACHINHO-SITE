import type { ContratacaoOnlineConfig, FormaPagamento } from "./types";

export type { ContratacaoOnlineConfig } from "./types";

export const DEFAULT_CONTRATACAO_ONLINE_CONFIG: ContratacaoOnlineConfig = {
  pix_primeira_parcela_ativo: false,
  pix_chave: "",
  pix_recebedor: "",
  pix_instrucoes:
    "Para agilizar sua contratação, realize o Pix e envie o comprovante.",
  comprovante_pix_obrigatorio: false,
};

export function formasPagamentoDisponiveis(
  cfg: ContratacaoOnlineConfig,
): FormaPagamento[] {
  const out: FormaPagamento[] = [];
  if (cfg.pix_primeira_parcela_ativo && cfg.pix_chave.trim()) {
    out.push("pix");
  }
  out.push("boleto", "cartao");
  return out;
}

export function labelFormaPagamento(forma: FormaPagamento): string {
  switch (forma) {
    case "pix":
      return "Pix";
    case "boleto":
      return "Boleto bancário";
    case "cartao":
      return "Cartão de crédito";
    default:
      return forma;
  }
}

export function pixConfigValida(cfg: ContratacaoOnlineConfig): boolean {
  return Boolean(cfg.pix_primeira_parcela_ativo && cfg.pix_chave.trim());
}
