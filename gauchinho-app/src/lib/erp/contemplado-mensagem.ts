/** Mensagem e dados do aviso de contemplação (lista de contemplados). */
import { formatBRL } from "@/lib/formatters/money";

export type AvisoContemplacao = {
  cliente: string; grupo: string; cota: string; credito: number | null; liquido: number | null;
  parcela: number | null; modalidade: string | null; data: string;
};

export function primeiroNomeCliente(nome: string) {
  const p = nome.trim().split(/\s+/)[0] ?? "";
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/** Parcela aproximada: meses entre a contratação e a contemplação, contando a primeira. */
export function parcelaDaContemplacao(contratacao: string | null, contemplacao: string) {
  if (!contratacao) return null;
  const [a1, m1] = contratacao.slice(0, 7).split("-").map(Number);
  const [a2, m2] = contemplacao.slice(0, 7).split("-").map(Number);
  const n = (a2 - a1) * 12 + (m2 - m1) + 1;
  return n >= 1 && n <= 400 ? n : null;
}

export function rotuloModalidade(m: string | null) {
  if (!m) return null;
  const u = m.toUpperCase();
  if (u.includes("SORTEIO")) return "sorteio";
  if (u.includes("FIDELIDADE")) return "lance fidelidade";
  if (u.includes("FIXO")) return "lance fixo";
  if (u.includes("LIVRE") || u.includes("LANCE")) return "lance";
  return null;
}

export function mensagemContemplacao(a: AvisoContemplacao) {
  const mod = rotuloModalidade(a.modalidade);
  const linhas = [
    `🎉🎊 PARABÉNS, ${primeiroNomeCliente(a.cliente).toUpperCase()}! 🎊🎉`,
    "",
    "Sua cota foi *CONTEMPLADA*! 🏆✨",
    "",
    `📌 Grupo *${a.grupo}* · Cota *${a.cota}*`,
    ...(a.credito !== null ? [`💰 Crédito contemplado: *${formatBRL(a.credito)}*`] : []),
    ...(a.liquido !== null ? [`💵 Crédito líquido: *${formatBRL(a.liquido)}*`] : []),
    ...(a.parcela ? [`🗓️ Contemplada na *${a.parcela}ª parcela*${mod ? ` por ${mod}` : ""}`] : mod ? [`🗓️ Contemplada por ${mod}`] : []),
    "",
    "Esse momento é o resultado da sua disciplina e do planejamento que construímos juntos. Agora é hora de transformar esse crédito em conquista! 🏡🚗🔑",
    "",
    "Em breve falamos com você sobre os próximos passos. Seguimos ao seu lado em cada etapa! 🤝💙",
    "",
    "Fernando e Eroni · Gauchinho Consórcios | Racon",
  ];
  return linhas.join("\n");
}
