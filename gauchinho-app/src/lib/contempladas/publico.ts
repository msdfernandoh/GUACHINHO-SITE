import type { ConfigContempladas } from "./repo";

/** O que o cliente pode ver da configuração da unidade dona da cota. */
export type ConfigPublica = {
  unidade: string | null;
  whatsapp: string | null;
  chavePix: string | null;
  tipoPix: string | null;
  favorecido: string | null;
  minutos: number;
  sinalImovel: number;
  sinalAuto: number;
  transferenciaImovel: number;
  transferenciaAuto: number;
  diaVencimento: number;
};

const ROTULO_PIX = { CELULAR: "celular", EMAIL: "e-mail", CPF: "CPF", CNPJ: "CNPJ", ALEATORIA: "aleatória" } as const;

export function configPublica(cfg: ConfigContempladas, unidade: string | null = null): ConfigPublica {
  const d = (cfg.chave_pix ?? "").replace(/\D/g, "");
  return {
    unidade: cfg.unidade || unidade,
    whatsapp: cfg.whatsapp,
    chavePix: cfg.chave_pix_tipo === "CELULAR" && d.length === 11 ? d.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3") : cfg.chave_pix,
    tipoPix: ROTULO_PIX[cfg.chave_pix_tipo] ?? null,
    favorecido: cfg.favorecido_pix,
    minutos: cfg.pre_reserva_minutos,
    sinalImovel: cfg.sinal_imovel,
    sinalAuto: cfg.sinal_auto,
    transferenciaImovel: cfg.transferencia_imovel,
    transferenciaAuto: cfg.transferencia_auto,
    diaVencimento: cfg.dia_vencimento,
  };
}
