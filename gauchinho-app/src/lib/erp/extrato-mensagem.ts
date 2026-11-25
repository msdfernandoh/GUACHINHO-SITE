/** Mensagem de WhatsApp do extrato: mesma regra na lista e na tela do cliente. */
import { moedaExtrato as brl } from "./extrato-cliente";

export const MODELO_MENSAGEM_EXTRATO =
  "Olá, {cliente}! 😊\n\n📄 Seu extrato de {periodo} está pronto!\n🏦 Crédito atualizado da sua carteira: {credito}\n📈 Reajuste acumulado do crédito: {reajuste}\n\nConfira no PDF a evolução das suas cotas, as assembleias e as projeções de 3 e 5 anos. 🌱\nAs projeções consideram a repetição do último reajuste anual. A proximidade numérica descreve resultados passados.\n\nSeguimos cuidando de cada detalhe do seu planejamento. Estou à disposição! 🤝";

export const CHAVE_MODELO_EXTRATO = "extrato-cliente-modelo-whatsapp";

type Cota = { atual: number | null; valorizacao: number | null };

export function totalCompleto(cotas: Cota[], campo: keyof Cota) {
  return cotas.length && cotas.every((c) => c[campo] !== null) ? cotas.reduce((s, c) => s + c[campo]!, 0) : null;
}

export function periodoExtrato(historico: string) {
  return historico === "mes" ? "mês atual" : historico === "todos" ? "desde a adesão" : "últimos 12 meses";
}

export function montarMensagemExtrato(modelo: string, dados: { cliente: { nome: string }; historico: string; cotas: Cota[] }) {
  return modelo
    .replaceAll("{cliente}", dados.cliente.nome.trim().split(/\s+/)[0].replace(/^./, (l) => l.toUpperCase()).replace(/(?<=.)\p{Lu}+/gu, (r) => r.toLowerCase()))
    .replaceAll("{periodo}", periodoExtrato(dados.historico))
    .replaceAll("{credito}", brl(totalCompleto(dados.cotas, "atual")))
    .replaceAll("{reajuste}", brl(totalCompleto(dados.cotas, "valorizacao")));
}
