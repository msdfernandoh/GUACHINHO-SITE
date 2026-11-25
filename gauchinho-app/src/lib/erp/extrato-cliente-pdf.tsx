import "server-only";
import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { pdfImage } from "@/lib/proposta/pdf/assets";
import { ensureFonts, FONT_DISPLAY, FONT_MONO } from "@/lib/proposta/pdf/fonts";
import { moedaExtrato as brl } from "./extrato-cliente";
import { totalCompleto } from "./extrato-mensagem";

const NAVY = "#071a3d";
const NAVY_2 = "#0c2a5e";
const CYAN = "#18b4f0";
const INK = "#121a33";
const SOFT = "#556080";
const LINE = "#e3e8f2";
const PAPER = "#f6f8fc";
const VERDE = "#0f8a5f";

export const ASSINATURAS = [
  { nome: "Fernando Hugo", telefone: "(66) 99608-6030" },
  { nome: "Eroni Bolfe", telefone: "(66) 99912-6120" },
];

export type CotaPdf = {
  id: string; grupo: string | null; cota: string | null; contemplada: boolean | null; adesao: string | null; quantidade: number;
  contratado: number | null; atual: number | null; valorizacao: number | null; percentual: number | null; totalParcelas: number | null;
  projecao3: number | null; projecao5: number | null; taxa: number | null; reajustou: boolean;
  assembleias: { numero: number; data: string; melhor: { modalidade: string; cota: string | number; distancia: number } | null; percentual: number | null }[];
};
export type ExtratoPdfDados = { cliente: { nome: string }; hoje: string; mes: string; historico: string; cotas: CotaPdf[] };

const s = StyleSheet.create({
  page: { paddingTop: 92, paddingBottom: 56, paddingHorizontal: 40, fontFamily: FONT_DISPLAY, fontSize: 9, color: INK, backgroundColor: "#fff" },
  faixa: { position: "absolute", top: 0, left: 0, right: 0, height: 64, backgroundColor: NAVY, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 40 },
  rodape: { position: "absolute", bottom: 20, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: SOFT, borderTopWidth: 1, borderColor: LINE, paddingTop: 6 },
  rotulo: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 1.5, textTransform: "uppercase", color: SOFT },
  h1: { fontWeight: 700, fontSize: 20, color: NAVY, marginBottom: 4 },
  h2: { fontWeight: 700, fontSize: 14, color: NAVY },
  card: { borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 10, backgroundColor: "#fff" },
  nota: { fontSize: 7, color: SOFT, lineHeight: 1.45 },
});

const primeiro = (nome: string) => { const p = nome.trim().split(/\s+/)[0] ?? ""; return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase(); };
const data = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "não informada");
const mesExtenso = (mes: string) => new Date(mes + "-15T12:00:00Z").toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const pct = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + "%");
const periodo = (h: string) => (h === "mes" ? "do mês atual" : h === "todos" ? "desde a adesão" : "dos últimos 12 meses");
const soma = (cotas: CotaPdf[], k: "contratado" | "totalParcelas" | "projecao3" | "projecao5") =>
  cotas.length && cotas.every((c) => c[k] !== null) ? cotas.reduce((t, c) => t + c[k]!, 0) : null;

const FRASES = [
  "Consórcio é constância: cada parcela em dia é um passo a mais rumo à sua conquista.",
  "Você não está sozinho nessa jornada. Acompanhamos cada assembleia junto com você.",
  "Planejamento bem feito transforma paciência em patrimônio.",
  "Seu crédito é corrigido ao longo do tempo para manter o poder de compra do seu objetivo.",
];

function Faixa() {
  return (
    <View style={s.faixa} fixed>
      <Image src={pdfImage("racon-gauchinho-logo.png")} style={{ width: 92, height: 42, objectFit: "contain" }} />
      <Text style={{ fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 2, color: "#9fc6ff", textTransform: "uppercase" }}>Extrato da carteira de consórcio</Text>
    </View>
  );
}

function Rodape({ nome }: { nome: string }) {
  return (
    <View style={s.rodape} fixed>
      <Text>{nome} · Gauchinho Consórcios · Franqueado Racon</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function Capa({ d }: { d: ExtratoPdfDados }) {
  const credito = totalCompleto(d.cotas, "atual");
  const reajuste = totalCompleto(d.cotas, "valorizacao");
  const chips = [
    `${d.cotas.length} ${d.cotas.length === 1 ? "cota" : "cotas"}`,
    `Crédito atualizado ${brl(credito)}`,
    ...(reajuste !== null && reajuste > 0 ? [`Reajuste acumulado ${brl(reajuste)}`] : []),
  ];
  return (
    <Page size="A4" style={{ padding: 0, fontFamily: FONT_DISPLAY, backgroundColor: NAVY }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image src={pdfImage("grad-padrao.png")} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ padding: 46, flexGrow: 1, color: "#eef3ff" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Image src={pdfImage("racon-gauchinho-logo.png")} style={{ width: 170, height: 78, objectFit: "contain" }} />
          <Text style={{ fontFamily: FONT_MONO, fontSize: 8, color: "rgba(238,243,255,0.65)", textAlign: "right", lineHeight: 1.7 }}>
            Referência{"\n"}<Text style={{ color: CYAN, fontWeight: 500 }}>{mesExtenso(d.mes)}</Text>{"\n"}Data-base {data(d.hoje)}
          </Text>
        </View>

        <View style={{ flexGrow: 1 }} />

        <Text style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 3, color: CYAN, textTransform: "uppercase", marginBottom: 12 }}>Extrato do cliente</Text>
        <Text style={{ fontWeight: 700, fontSize: 32, color: "#fff", lineHeight: 1.08, marginBottom: 6 }}>
          Sua conquista,{"\n"}<Text style={{ fontStyle: "italic", color: CYAN }}>bem cuidada</Text> todos os meses.
        </Text>
        <View style={{ width: 46, height: 3, backgroundColor: CYAN, marginVertical: 16 }} />

        <Text style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 2, color: "rgba(238,243,255,0.6)", textTransform: "uppercase", marginBottom: 4 }}>Preparado para</Text>
        <Text style={{ fontWeight: 700, fontSize: 22, color: "#fff", marginBottom: 14 }}>{d.cliente.nome}</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 20 }}>
          {chips.map((c) => (
            <Text key={c} style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#e3ecff", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}>{c}</Text>
          ))}
        </View>

        <View style={{ borderWidth: 1, borderColor: "rgba(24,180,240,0.55)", backgroundColor: "rgba(12,42,94,0.75)", borderRadius: 12, padding: 16, marginBottom: 22 }}>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 2, color: CYAN, textTransform: "uppercase", marginBottom: 6 }}>Gestão do seu investimento</Text>
          <Text style={{ fontWeight: 700, fontSize: 14, color: "#fff", marginBottom: 6 }}>Nós cuidamos da estratégia. Você acompanha a conquista.</Text>
          <Text style={{ fontSize: 9, color: "rgba(238,243,255,0.85)", lineHeight: 1.55 }}>
            Acompanhamos cada assembleia, estudamos as melhores estratégias e oportunidades de lance, organizamos os pagamentos e mantemos você informado sobre a evolução do seu crédito. Uma carteira bem administrada é o caminho mais seguro para mais satisfação e mais chances reais de contemplação.
          </Text>
        </View>

        <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingTop: 12 }}>
          {ASSINATURAS.map((a) => (
            <View key={a.nome} style={{ marginRight: 34 }}>
              <Text style={{ fontWeight: 700, fontSize: 9, color: "rgba(255,255,255,0.9)" }}>{a.nome}</Text>
              <Text style={{ fontFamily: FONT_MONO, fontSize: 7.5, color: "rgba(238,243,255,0.55)", marginTop: 2 }}>{a.telefone}</Text>
            </View>
          ))}
          <View style={{ flexGrow: 1 }} />
          <Text style={{ fontFamily: FONT_MONO, fontSize: 7, color: "rgba(238,243,255,0.45)", alignSelf: "flex-end" }}>Gauchinho Consórcios · Franqueado Racon</Text>
        </View>
      </View>
    </Page>
  );
}

function Kpi({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <View style={[s.card, { width: "31.5%", marginBottom: 8 }, destaque ? { backgroundColor: NAVY, borderColor: NAVY } : {}]}>
      <Text style={[s.rotulo, destaque ? { color: "#9fc6ff" } : {}]}>{rotulo}</Text>
      <Text style={{ fontWeight: 700, fontSize: 13, marginTop: 4, color: destaque ? "#fff" : NAVY }}>{valor}</Text>
    </View>
  );
}

function Barras({ itens }: { itens: { rotulo: string; valor: number | null; cor: string }[] }) {
  const max = Math.max(...itens.map((i) => i.valor ?? 0), 1);
  return (
    <View style={{ marginTop: 4 }}>
      {itens.map((i) => (
        <View key={i.rotulo} style={{ flexDirection: "row", alignItems: "center", marginBottom: 5 }}>
          <Text style={{ width: 92, fontSize: 7.5, color: SOFT }}>{i.rotulo}</Text>
          <View style={{ flexGrow: 1, height: 11, backgroundColor: PAPER, borderRadius: 3 }}>
            <View style={{ width: `${Math.max(2, ((i.valor ?? 0) / max) * 100)}%`, height: 11, backgroundColor: i.cor, borderRadius: 3 }} />
          </View>
          <Text style={{ width: 92, fontSize: 8, fontWeight: 700, textAlign: "right", color: INK }}>{brl(i.valor)}</Text>
        </View>
      ))}
    </View>
  );
}

function Resumo({ d }: { d: ExtratoPdfDados }) {
  const atual = totalCompleto(d.cotas, "atual");
  const contratado = soma(d.cotas, "contratado");
  const reajuste = totalCompleto(d.cotas, "valorizacao");
  const pilares = [
    ["Estratégia", "Definimos com você o melhor caminho para cada cota, de acordo com o seu objetivo."],
    ["Lances", "Estudamos o histórico das assembleias para orientar quando e como ofertar."],
    ["Pagamentos", "Acompanhamos as parcelas para que nenhuma oportunidade seja perdida."],
    ["Acompanhamento", "Todo mês você recebe este extrato com a evolução da sua carteira."],
  ];
  return (
    <View>
      <Text style={s.rotulo}>Visão geral · {mesExtenso(d.mes)}</Text>
      <Text style={s.h1}>Resumo da sua carteira</Text>
      <Text style={{ fontSize: 9.5, color: SOFT, lineHeight: 1.5, marginBottom: 12 }}>
        {primeiro(d.cliente.nome)}, este é o retrato atualizado das suas {d.cotas.length === 1 ? "cota" : `${d.cotas.length} cotas`}. Cada número abaixo representa um passo a mais na construção do seu patrimônio.
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi rotulo="Crédito atualizado" valor={brl(atual)} destaque />
        <Kpi rotulo="Crédito na adesão" valor={brl(contratado)} />
        <Kpi rotulo="Reajuste acumulado" valor={reajuste === null ? "—" : `${brl(reajuste)}${contratado ? "  (" + pct((reajuste / contratado) * 100) + ")" : ""}`} />
        <Kpi rotulo="Parcelas estimadas pagas" valor={brl(soma(d.cotas, "totalParcelas"))} />
        <Kpi rotulo="Projeção em 3 anos" valor={brl(soma(d.cotas, "projecao3"))} />
        <Kpi rotulo="Projeção em 5 anos" valor={brl(soma(d.cotas, "projecao5"))} />
      </View>
      {reajuste !== null && reajuste > 0 ? (
        <View style={{ backgroundColor: "#eafaf3", borderRadius: 8, padding: 10, marginTop: 4, marginBottom: 14, borderLeftWidth: 3, borderColor: VERDE }}>
          <Text style={{ color: VERDE, fontWeight: 700, fontSize: 9.5 }}>Seu crédito cresceu {brl(reajuste)} desde a adesão.</Text>
          <Text style={{ fontSize: 8, color: SOFT, marginTop: 2 }}>O reajuste mantém o poder de compra do seu objetivo ao longo do tempo.</Text>
        </View>
      ) : <View style={{ height: 10 }} />}

      <Text style={[s.h2, { marginBottom: 8 }]}>Como cuidamos do seu investimento</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {pilares.map(([t, txt], i) => (
          <View key={t} style={[s.card, { width: "48.5%", marginBottom: 8, flexDirection: "row" }]}>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 14, color: CYAN, width: 24 }}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: 700, fontSize: 10, color: NAVY }}>{t}</Text>
              <Text style={{ fontSize: 8, color: SOFT, lineHeight: 1.45, marginTop: 2 }}>{txt}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ backgroundColor: NAVY, borderRadius: 10, padding: 14, marginTop: 8 }}>
        <Text style={{ fontWeight: 700, fontStyle: "italic", fontSize: 12, color: "#fff", lineHeight: 1.4 }}>&ldquo;{FRASES[0]}&rdquo;</Text>
      </View>
      <Text style={[s.nota, { marginTop: 10 }]}>
        Simulação considerando todas as parcelas pagas em dia. O reajuste expressa a evolução do crédito. As projeções repetem o último reajuste anual e as parcelas também podem sofrer reajuste contratual. Histórico de assembleias {periodo(d.historico)}.
      </Text>
    </View>
  );
}

function CotaBloco({ c, i }: { c: CotaPdf; i: number }) {
  const linhas: [string, string][] = [
    ["Adesão", data(c.adesao)],
    ["Crédito na adesão", brl(c.contratado)],
    ["Crédito atualizado", brl(c.atual)],
    ["Reajuste acumulado", c.valorizacao === null ? "—" : `${brl(c.valorizacao)} (${pct(c.percentual)})`],
    ["Parcelas estimadas", `${c.quantidade} · ${brl(c.totalParcelas)}`],
    ["Taxa anual de referência", c.taxa === null ? "indisponível" : pct(c.taxa)],
  ];
  return (
    <View break={i > 0}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View>
          <Text style={s.rotulo}>Cota {i + 1}</Text>
          <Text style={s.h1}>Grupo {c.grupo ?? "—"} · Cota {c.cota ?? "—"}</Text>
        </View>
        <Text style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#fff", backgroundColor: c.contemplada ? VERDE : NAVY_2, borderRadius: 12, paddingVertical: 4, paddingHorizontal: 10 }}>
          {c.contemplada ? "Contemplada" : "Em acompanhamento"}
        </Text>
      </View>
      {c.reajustou ? (
        <Text style={{ backgroundColor: "#fff6e0", color: "#8a5a00", fontWeight: 700, fontSize: 8.5, padding: 7, borderRadius: 6, marginBottom: 8 }}>Seu crédito foi reajustado neste mês de referência.</Text>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={[s.card, { width: "44%" }]}>
          {linhas.map(([r, v]) => (
            <View key={r} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderColor: LINE }}>
              <Text style={{ fontSize: 8, color: SOFT }}>{r}</Text>
              <Text style={{ fontSize: 8.5, fontWeight: 700 }}>{v}</Text>
            </View>
          ))}
        </View>
        <View style={[s.card, { width: "54%" }]}>
          <Text style={[s.rotulo, { marginBottom: 6 }]}>Evolução e projeção do crédito</Text>
          <Barras itens={[
            { rotulo: "Na adesão", valor: c.contratado, cor: "#b9c6e0" },
            { rotulo: "Hoje", valor: c.atual, cor: NAVY },
            { rotulo: "Em 3 anos", valor: c.projecao3, cor: CYAN },
            { rotulo: "Em 5 anos", valor: c.projecao5, cor: "#0a7fb0" },
          ]} />
          <Text style={[s.nota, { marginTop: 4 }]}>Projeção repetindo o último reajuste anual.</Text>
        </View>
      </View>

      <Text style={[s.h2, { marginTop: 14, marginBottom: 6 }]}>Assembleias {c.assembleias.length ? `(${c.assembleias.length})` : ""}</Text>
      <View style={{ flexDirection: "row", backgroundColor: NAVY, borderTopLeftRadius: 6, borderTopRightRadius: 6, paddingVertical: 5, paddingHorizontal: 8 }}>
        {["Data", "Melhor referência", "Distância", "Proximidade histórica"].map((h, k) => (
          <Text key={h} style={{ width: ["18%", "42%", "15%", "25%"][k], fontSize: 7.5, fontWeight: 700, color: "#fff" }}>{h}</Text>
        ))}
      </View>
      {c.assembleias.map((a, k) => (
        <View key={a.numero} wrap={false} style={{ flexDirection: "row", paddingVertical: 4.5, paddingHorizontal: 8, backgroundColor: k % 2 ? PAPER : "#fff", borderBottomWidth: 1, borderColor: LINE }}>
          <Text style={{ width: "18%", fontSize: 8 }}>{data(a.data)}</Text>
          <Text style={{ width: "42%", fontSize: 8 }}>{a.melhor ? `${a.melhor.modalidade.replaceAll("_", " ").toLowerCase().replace(/^./, (l) => l.toUpperCase())} · cota ${a.melhor.cota}` : "Sem resultado elegível"}</Text>
          <Text style={{ width: "15%", fontSize: 8 }}>{a.melhor?.distancia ?? "—"}</Text>
          <View style={{ width: "25%", flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 46, height: 5, backgroundColor: LINE, borderRadius: 3, marginRight: 5 }}>
              <View style={{ width: `${Math.max(0, Math.min(100, a.percentual ?? 0))}%`, height: 5, backgroundColor: CYAN, borderRadius: 3 }} />
            </View>
            <Text style={{ fontSize: 8, fontWeight: 700 }}>{a.percentual === null ? "—" : pct(a.percentual)}</Text>
          </View>
        </View>
      ))}
      {!c.assembleias.length ? <Text style={[s.nota, { padding: 8 }]}>Sem assembleias verificadas neste período.</Text> : null}
      <Text style={[s.nota, { marginTop: 6 }]}>
        A proximidade compara a numeração da sua cota com os resultados das assembleias. Participação e elegibilidade nos lances precisam ser confirmadas; o percentual descreve o histórico e não indica probabilidade futura. Valores estimados pela parcela vigente, sujeitos a conferência de condições individuais e troca de bem.
      </Text>
      <View style={{ borderLeftWidth: 3, borderColor: CYAN, paddingLeft: 10, marginTop: 10 }}>
        <Text style={{ fontStyle: "italic", fontWeight: 700, fontSize: 9.5, color: NAVY }}>{FRASES[(i + 1) % FRASES.length]}</Text>
      </View>
    </View>
  );
}

function Encerramento({ d }: { d: ExtratoPdfDados }) {
  return (
    <View wrap={false} style={{ marginTop: 22 }}>
      <View style={{ backgroundColor: NAVY, borderRadius: 14, padding: 26 }}>
        <Text style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 2, color: CYAN, textTransform: "uppercase", marginBottom: 8 }}>Conte com a gente</Text>
        <Text style={{ fontWeight: 700, fontSize: 20, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>
          {primeiro(d.cliente.nome)}, seguimos ao seu lado em cada etapa.
        </Text>
        <Text style={{ fontSize: 9.5, color: "rgba(238,243,255,0.85)", lineHeight: 1.6 }}>
          Ficou com alguma dúvida, quer conversar sobre uma estratégia de lance ou pensa em ampliar seu planejamento? Fale com a gente. Cuidar bem da sua carteira é o nosso compromisso: mais organização, mais tranquilidade e mais chances de chegar lá.
        </Text>
        <View style={{ flexDirection: "row", marginTop: 18 }}>
          {ASSINATURAS.map((a) => (
            <View key={a.nome} style={{ marginRight: 40 }}>
              <Text style={{ fontWeight: 700, fontSize: 10, color: "#fff" }}>{a.nome}</Text>
              <Text style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#9fc6ff", marginTop: 2 }}>WhatsApp {a.telefone}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={[s.nota, { marginTop: 14, textAlign: "center" }]}>Gauchinho Consórcios · Franqueado Racon Consórcios · Documento informativo, não substitui o extrato oficial da administradora.</Text>
    </View>
  );
}

export function ExtratoClientePdf({ d }: { d: ExtratoPdfDados }) {
  ensureFonts();
  return (
    <Document title={`Extrato de ${d.cliente.nome}`} author="Gauchinho Consórcios">
      <Capa d={d} />
      <Page size="A4" style={s.page}>
        <Faixa />
        <Resumo d={d} />
        <Rodape nome={d.cliente.nome} />
      </Page>
      <Page size="A4" style={s.page}>
        <Faixa />
        {d.cotas.map((c, i) => <CotaBloco key={c.id} c={c} i={i} />)}
        {!d.cotas.length ? <Text>Nenhuma cota ativa encontrada.</Text> : null}
        <Encerramento d={d} />
        <Rodape nome={d.cliente.nome} />
      </Page>
    </Document>
  );
}
