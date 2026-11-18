import { pct, taxaJuncao, type Combinacao, type CotaMotor } from "./motor";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brl0 = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export type OpcoesMensagem = {
  /** Entrada que o cliente paga (já com adicional da revenda e desconto). */
  entrada: number;
  /** Taxa de transferência total da junção. */
  transferencia: number;
  diaVencimento: number;
  /** WhatsApp para a chamada (só dígitos, sem 55). */
  whatsapp?: string | null;
  linkProposta?: string | null;
};

/** Texto pronto para WhatsApp no estilo das listas de cartas contempladas. */
export function mensagemWhatsApp(c: Combinacao, o: OpcoesMensagem, hoje: Date = new Date()): string {
  const cotas = c.cotas as CotaMotor[];
  const veiculo = cotas.every((x) => x.tipo === "automovel");
  const adm = (cotas[0]?.administradora ?? "racon").toUpperCase();
  const taxa = taxaJuncao(cotas, o.entrada, hoje);
  const pctEntrada = o.entrada / c.credito;
  const mesVenc = cotas.map((x) => x.vencimento_mes).filter(Boolean)[0] as number | undefined;
  const venc = mesVenc ? `${String(o.diaVencimento).padStart(2, "0")}/${String(mesVenc).padStart(2, "0")}` : "a combinar";
  const juncao = cotas.length > 1 ? `\n🧩 Junção de ${cotas.length} cartas` : "";
  const prazo = `${c.prazoMaximo} × ${brl0(c.parcelaMedia)}`;
  // Códigos das cotas no topo: o cliente responde e você já sabe quais são.
  const linhas: string[] = [`🔖 ${cotas.length > 1 ? "Cotas" : "Cota"}: ${cotas.map((x) => x.codigo).join(" + ")}`, ""];

  if (veiculo) {
    linhas.push(`Contemplada ${adm} Veículo 🚘🚘🚘${juncao}`, "");
    linhas.push(`Crédito ${brl(c.credito)}`, "", `Entrada ${brl(o.entrada)}`, "", `Prazo médio ${prazo}`, "");
    linhas.push(`Saldo devedor ${brl(c.saldo)}`);
    if (o.transferencia > 0) linhas.push(`Taxa de transferência ${brl0(o.transferencia)}`);
    if (taxa) linhas.push(`Taxa ${pct(taxa.mensal)} a.m. · ${pct(taxa.anual)} a.a.`);
    linhas.push(`Vencimento ${venc}`);
  } else {
    if (taxa && taxa.mensal < 0.01) linhas.push(`🔥*TAXA ${pct(taxa.mensal).replace("%", "%")} A.M*🤏🔥`);
    else if (pctEntrada <= 0.3) linhas.push("🔥ENTRADA IMPERDÍVEL🔥");
    else linhas.push("🔥*OPORTUNIDADE CONTEMPLADA*🔥");
    linhas.push("", `${adm} CONSÓRCIOS - IMÓVEL 🏡🏠🏠${juncao}`, "");
    linhas.push(`Crédito: ${brl(c.credito)}`);
    linhas.push(`Entrada: ${brl(o.entrada)}${pctEntrada <= 0.3 ? " 🤏🔥😱" : ""}`);
    linhas.push("Prazo MÉDIO:", prazo, "");
    if (o.transferencia > 0) linhas.push(`Transferência: ${brl0(o.transferencia)}`);
    linhas.push(`Saldo devedor: ${brl(c.saldo)}`);
    if (taxa) linhas.push(`Taxa: ${pct(taxa.mensal)} a.m. · ${pct(taxa.anual)} a.a.`);
    linhas.push(`Vencimento: ${venc}`);
  }
  linhas.push("***");
  if (o.linkProposta) linhas.push("", `📄 Proposta: ${o.linkProposta}`);
  if (o.whatsapp) linhas.push("", `📲 Chama no WhatsApp: https://wa.me/55${o.whatsapp}`);
  return linhas.join("\n");
}
