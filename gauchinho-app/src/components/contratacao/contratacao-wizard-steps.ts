export type Step =
  | "confirm"
  | "dados"
  | "pessoa"
  | "docs"
  | "pagamento"
  | "pix"
  | "boleto"
  | "cartao"
  | "success";

export const WIZARD_STEPS = [
  { id: "confirm", label: "Proposta" },
  { id: "dados", label: "Dados" },
  { id: "pessoa", label: "CPF/CNPJ" },
  { id: "docs", label: "Documentos" },
  { id: "pagamento", label: "Pagamento" },
  { id: "success", label: "Finalização" },
] as const;

export function stepProgressIndex(step: Step): number {
  switch (step) {
    case "confirm":
      return 0;
    case "dados":
      return 1;
    case "pessoa":
      return 2;
    case "docs":
      return 3;
    case "pagamento":
    case "pix":
    case "boleto":
    case "cartao":
      return 4;
    case "success":
      return 5;
    default:
      return 0;
  }
}
