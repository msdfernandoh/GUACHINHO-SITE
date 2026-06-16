import type { CalculadoraId } from "./types";

export function mensagemWhatsappCalculadora(id: CalculadoraId, nome: string): string {
  const n = nome.trim() || "cliente";
  switch (id) {
    case "aplicacao_mensal":
      return `Olá, fiz uma simulação de aplicação mensal no site Gauchinho e gostaria de uma análise personalizada. Meu nome é ${n}.`;
    case "valor_futuro":
      return `Olá, simulei o valor futuro de um investimento no site Gauchinho e gostaria de entender melhor as opções. Meu nome é ${n}.`;
    case "financiamento":
      return `Olá, fiz uma simulação de financiamento no site Gauchinho e gostaria de comparar com consórcio. Meu nome é ${n}.`;
    case "correcao":
      return `Olá, fiz uma simulação de correção de valores no site Gauchinho e gostaria de uma orientação. Meu nome é ${n}.`;
  }
}

export function labelCalculadora(id: CalculadoraId): string {
  switch (id) {
    case "aplicacao_mensal":
      return "Aplicação mensal";
    case "valor_futuro":
      return "Valor futuro";
    case "financiamento":
      return "Financiamento";
    case "correcao":
      return "Correção de valores";
  }
}
