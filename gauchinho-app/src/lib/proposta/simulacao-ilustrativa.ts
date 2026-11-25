import { z } from "zod";

export const simulacaoIlustrativaSchema = z.object({
  taxaAnual: z.number().min(0).max(100),
  contemplacao: z.object({
    ano: z.number().int().min(1).max(50),
    taxaMensal: z.number().min(0).max(10),
  }).optional(),
});

export type SimulacaoIlustrativa = z.infer<typeof simulacaoIlustrativaSchema>;

export function projetarCredito(credito: number, prazo: number, config: SimulacaoIlustrativa) {
  const meses = Math.floor(prazo);
  const fatorAnual = 1 + config.taxaAnual / 100;
  const hipotese = config.contemplacao;
  const mesContemplacao = hipotese ? (hipotese.ano - 1) * 12 : meses;
  const simularContemplacao = hipotese && mesContemplacao < meses;
  const semContemplacao = (mes: number) => credito * fatorAnual ** Math.floor(mes / 12);
  const comContemplacao = (mes: number) => simularContemplacao && mes > mesContemplacao
    ? semContemplacao(mesContemplacao) * (1 + hipotese.taxaMensal / 100) ** (mes - mesContemplacao)
    : null;
  const linhas = Array.from({ length: Math.ceil(meses / 12) }, (_, i) => {
    const inicio = i * 12;
    return {
      ano: i + 1,
      sem: !simularContemplacao || inicio <= mesContemplacao ? semContemplacao(inicio) : null,
      com: comContemplacao(Math.min(inicio + 12, meses)),
    };
  });
  return { linhas, finalSem: semContemplacao(meses), finalCom: comContemplacao(meses) };
}
