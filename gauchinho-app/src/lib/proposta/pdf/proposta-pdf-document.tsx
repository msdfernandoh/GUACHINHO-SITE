import type { PropostaPdfData, SegmentoPdf, GrupoPdfBlock } from "./types";
import {
  AVISO_PROJECAO_PDF,
  AVISO_RESUMO,
  FRASE_CAPA,
  MARCA_ADMINISTRADORA,
  MARCA_PRINCIPAL,
  RUBINHO_NOME,
  TEXTO_COMPARATIVO,
  TEXTO_ENCERRAMENTO,
  TITULO_PROPOSTA,
} from "./types";
import { fmtMoney, fmtPrazo } from "./format";
import { ensureFonts, FONT_DISPLAY, FONT_MONO } from "./fonts";
import { pdfImage } from "./assets";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

ensureFonts();

const NAVY = "#0a1e8c";
const NAVY_INK = "#0b1533";
const CYAN = "#16dbec";
const CYAN_DEEP = "#0a7a8a";
const PAPER = "#f8f9fc";
const CARD = "#ffffff";
const INK = "#131a33";
const INK_SOFT = "#4a5170";
const LINE = "#e3e6f1";
const LINE_STRONG = "#c9cee0";
const AMBER = "#b0771d";
const AMBER_SOFT = "#fbf1df";

const s = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 34,
    paddingHorizontal: 36,
    fontFamily: FONT_DISPLAY,
    fontSize: 10,
    color: INK,
    backgroundColor: PAPER,
  },
  mono: { fontFamily: FONT_MONO },

  rhead: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: LINE,
    paddingBottom: 5,
    marginBottom: 10,
  },
  rheadText: { fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 1, color: INK_SOFT, textTransform: "uppercase" },
  rheadBrand: { color: NAVY, fontWeight: 700 },
  rfoot: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderColor: LINE,
    paddingTop: 5,
  },
  rfootText: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.6, color: LINE_STRONG, textTransform: "uppercase" },

  kicker: { fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 2, color: CYAN_DEEP, textTransform: "uppercase", marginBottom: 5 },
  h2: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 17, color: NAVY_INK, marginBottom: 3 },
  subline: { fontSize: 8.5, color: INK_SOFT, lineHeight: 1.35, marginBottom: 9 },

  // resumo cards
  cardRow: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -3 },
  card: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 7,
    padding: 6,
    margin: 3,
    minWidth: 108,
    flexGrow: 1,
    flexBasis: "22%",
  },
  cardHero: { backgroundColor: NAVY, borderColor: NAVY, flexBasis: "46%" },
  cardLabel: { fontFamily: FONT_MONO, fontSize: 6.5, letterSpacing: 0.8, color: INK_SOFT, textTransform: "uppercase", marginBottom: 3 },
  cardLabelHero: { color: "#c3caff" },
  cardValue: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: NAVY_INK },
  cardValueHero: { color: "#ffffff", fontSize: 15 },
  cardSub: { fontSize: 7, color: INK_SOFT, marginTop: 2 },
  cardSubHero: { color: CYAN },

  // segment block
  seg: { borderWidth: 1, borderColor: LINE_STRONG, borderRadius: 9, overflow: "hidden", marginBottom: 8 },
  segBar: { flexDirection: "row", alignItems: "center", paddingVertical: 5, paddingHorizontal: 10 },
  segBarImovel: { backgroundColor: NAVY },
  segBarVeiculo: { backgroundColor: CYAN_DEEP },
  segBarTitle: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10.5, color: "#fff", textTransform: "uppercase", letterSpacing: 1 },
  segBarMeta: { fontFamily: FONT_MONO, fontSize: 7.5, color: "#e6ecff", marginLeft: "auto" },
  segIn: { padding: 8 },

  startbox: { flexDirection: "row", borderWidth: 1, borderColor: LINE_STRONG, borderRadius: 7, overflow: "hidden", marginBottom: 6 },
  startCell: { flexGrow: 1, flexBasis: "25%", padding: 5, borderRightWidth: 1, borderColor: LINE },
  startCellLast: { borderRightWidth: 0 },
  startCellHl: { backgroundColor: "#e9fbfd" },
  startLabel: { fontFamily: FONT_MONO, fontSize: 6.3, letterSpacing: 0.6, color: INK_SOFT, textTransform: "uppercase", marginBottom: 2 },
  startValue: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 10.5, color: NAVY_INK },
  startSmall: { fontSize: 6.3, color: INK_SOFT, marginTop: 1 },

  twocol: { flexDirection: "row", marginHorizontal: -4, marginBottom: 6 },
  panel: { flexGrow: 1, flexBasis: "50%", marginHorizontal: 4, borderWidth: 1, borderColor: LINE, borderRadius: 7, overflow: "hidden" },
  panelHead: { fontFamily: FONT_MONO, fontSize: 6.5, letterSpacing: 0.8, color: CYAN_DEEP, textTransform: "uppercase", paddingVertical: 4, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: LINE, backgroundColor: "#f4f6fc" },
  drow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: "#eef0f7" },
  drowLast: { borderBottomWidth: 0 },
  drowK: { fontSize: 8, color: INK_SOFT },
  drowV: { fontFamily: FONT_MONO, fontSize: 8, color: NAVY_INK },
  drowEmph: { backgroundColor: "#e9fbfd" },
  drowEmphK: { fontSize: 8, fontWeight: 700, color: NAVY_INK },
  drowEmphV: { fontFamily: FONT_MONO, fontSize: 8.5, fontWeight: 700, color: NAVY },

  cost: { flexDirection: "row", borderWidth: 1, borderColor: NAVY, borderRadius: 7, overflow: "hidden", marginBottom: 6 },
  costCell: { flexGrow: 1, padding: 6, borderRightWidth: 1, borderColor: LINE },
  costCellLast: { borderRightWidth: 0 },
  costCellHl: { backgroundColor: "#e9fbfd" },
  costLabel: { fontFamily: FONT_MONO, fontSize: 6.3, letterSpacing: 0.6, color: INK_SOFT, textTransform: "uppercase", marginBottom: 3 },
  costCalc: { fontFamily: FONT_MONO, fontSize: 7.5, color: NAVY_INK, lineHeight: 1.4 },
  costBig: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: NAVY },
  costBigSub: { fontFamily: FONT_MONO, fontSize: 6.3, color: INK_SOFT, marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },

  lanceHead: { fontFamily: FONT_MONO, fontSize: 6.5, letterSpacing: 0.8, color: CYAN_DEEP, textTransform: "uppercase", marginBottom: 4 },
  ltHead: { flexDirection: "row", backgroundColor: NAVY, borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  ltHeadCell: { fontFamily: FONT_MONO, fontSize: 6.3, color: "#dfe4ff", textTransform: "uppercase", letterSpacing: 0.5, paddingVertical: 3.5, paddingHorizontal: 6 },
  ltRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINE },
  ltRowSel: { backgroundColor: "#e9fbfd" },
  ltCell: { fontFamily: FONT_MONO, fontSize: 7.5, color: NAVY_INK, paddingVertical: 3, paddingHorizontal: 6 },
  ltCellName: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 7.5 },
  ltColName: { flexGrow: 3, flexBasis: "38%" },
  ltCol: { flexGrow: 1, flexBasis: "20%", textAlign: "right" },
  ltNote: { fontSize: 6.5, color: INK_SOFT, marginTop: 3, lineHeight: 1.3 },

  timeline: { borderWidth: 1, borderColor: LINE, borderRadius: 7, padding: 6, marginTop: 6 },
  timelineHead: { fontFamily: FONT_MONO, fontSize: 6.5, letterSpacing: 0.8, color: CYAN_DEEP, textTransform: "uppercase", marginBottom: 5 },
  track: { flexDirection: "row", marginHorizontal: -4 },
  node: { flexGrow: 1, flexBasis: "25%", marginHorizontal: 4 },
  nodeYr: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 8, color: NAVY_INK, marginBottom: 1 },
  nodeM: { fontFamily: FONT_MONO, fontSize: 6.5, color: INK_SOFT, lineHeight: 1.3 },

  obs: { borderWidth: 1, borderColor: AMBER, borderRadius: 10, overflow: "hidden", marginBottom: 16 },
  obsTop: { backgroundColor: AMBER, color: "#fff", fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 1, textTransform: "uppercase", paddingVertical: 7, paddingHorizontal: 12 },
  obsBody: { backgroundColor: AMBER_SOFT, padding: 12, fontSize: 9.5, lineHeight: 1.6, color: "#4a3a1a", minHeight: 60 },

  ccardRow: { flexDirection: "row", marginHorizontal: -5, marginBottom: 16 },
  ccard: { flexGrow: 1, flexBasis: "50%", marginHorizontal: 5, borderWidth: 1, borderColor: LINE, borderRadius: 8, padding: 11 },
  ccardL: { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 0.8, color: CYAN_DEEP, textTransform: "uppercase", marginBottom: 7 },
  ccardNm: { fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 12, color: NAVY_INK },
  ccardLi: { fontSize: 8.5, color: INK_SOFT, marginTop: 3 },

  signRow: { flexDirection: "row", marginHorizontal: -20, marginVertical: 18 },
  sign: { flexGrow: 1, flexBasis: "50%", marginHorizontal: 20, borderTopWidth: 1, borderColor: NAVY_INK, paddingTop: 5, fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 0.5, textTransform: "uppercase", color: INK_SOFT },

  disclaimer: { borderTopWidth: 1, borderColor: LINE, paddingTop: 12, fontSize: 7, lineHeight: 1.6, color: INK_SOFT },
  disclaimerP: { marginBottom: 6 },
});

/* ---------- shared bits ---------- */

function Rodape({ pagina }: { pagina: string }) {
  return (
    <View style={s.rfoot} fixed>
      <Text style={s.rfootText}>Gauchinho Consórcios · representante Racon</Text>
      <Text style={s.rfootText}>{pagina}</Text>
    </View>
  );
}

function Cabecalho({ direito }: { direito: string }) {
  return (
    <View style={s.rhead}>
      <Text style={s.rheadText}>
        <Text style={s.rheadBrand}>RACON</Text> · Consórcios
      </Text>
      <Text style={s.rheadText}>{direito}</Text>
    </View>
  );
}

/* ---------- capa padrão ---------- */

function CapaPadrao({ data }: { data: PropostaPdfData }) {
  const chips = data.segmentos.map((seg) => `${seg.label} ${fmtMoney(seg.totais.credito)}`);
  return (
    <Page size="A4" style={[s.page, { padding: 0 }]}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image src={pdfImage("grad-padrao.png")} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ padding: 46, flexGrow: 1, color: "#eef1ff" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center" }}>
            <Image src={pdfImage("racon-logo.png")} style={{ width: 84, height: 30, objectFit: "contain" }} />
            <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 8, color: NAVY, borderLeftWidth: 1, borderColor: "#d5d9ee", paddingLeft: 10, marginLeft: 10, lineHeight: 1.3 }}>
              Administradora{"\n"}{MARCA_ADMINISTRADORA}
            </Text>
          </View>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 8, color: "rgba(238,241,255,0.6)", textAlign: "right", lineHeight: 1.7 }}>
            Proposta nº{"\n"}
            <Text style={{ color: CYAN, fontWeight: 500 }}>#{data.propostaId.slice(0, 8).toUpperCase()}</Text>{"\n"}
            Emissão {data.dataEmissao}
          </Text>
        </View>

        <View style={{ flexGrow: 1 }} />

        <Text style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 3, color: CYAN, textTransform: "uppercase", marginBottom: 12 }}>
          Proposta de Consórcio
        </Text>
        <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: "#fff", lineHeight: 1.1, marginBottom: 18, maxWidth: 360 }}>
          {tituloCapa(data)}
        </Text>

        {chips.length > 0 ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 18 }}>
            {chips.map((c) => (
              <Text
                key={c}
                style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#dfe6ff", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}
              >
                {c}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={{ borderTopWidth: 1, borderColor: "rgba(255,255,255,0.16)", paddingTop: 14, marginBottom: 18 }}>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 2, color: "rgba(238,241,255,0.6)", textTransform: "uppercase", marginBottom: 5 }}>
            Preparada para
          </Text>
          <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff" }}>{data.cliente.nome}</Text>
        </View>

        <MetaCapa data={data} />

        <Text style={{ fontSize: 8, color: "rgba(238,241,255,0.5)", lineHeight: 1.5, marginTop: 16, maxWidth: 380 }}>
          {FRASE_CAPA}
        </Text>
      </View>
    </Page>
  );
}

/* ---------- capa campanha (Conquiste+) ---------- */

function CapaCampanha({ data }: { data: PropostaPdfData }) {
  return (
    <Page size="A4" style={[s.page, { padding: 0 }]}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <Image src={pdfImage("grad-campanha.png")} style={{ width: "100%", height: "100%" }} />
      </View>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 300, opacity: 0.28 }}>
        <Image src={pdfImage("cena-casa.jpg")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </View>

      <View style={{ padding: 46, flexGrow: 1, color: "#fff" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "flex-end", borderBottomWidth: 3, borderColor: "#fff", paddingBottom: 4 }}>
              <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 26, color: "#fff", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Conquiste
              </Text>
              <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 30, color: "#fff" }}>+</Text>
              <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 16, color: CYAN, marginLeft: 2 }}>↗</Text>
            </View>
            <Text style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 2, color: "#bfe6fb", textTransform: "uppercase", marginTop: 7 }}>
              Consórcio Racon
            </Text>
          </View>
          <View style={{ backgroundColor: "#fff", borderRadius: 10, padding: 10, flexDirection: "row", alignItems: "center" }}>
            <Image src={pdfImage("racon-logo.png")} style={{ width: 78, height: 28, objectFit: "contain" }} />
            <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 7.5, color: NAVY, borderLeftWidth: 1, borderColor: "#d5d9ee", paddingLeft: 9, marginLeft: 9, lineHeight: 1.3 }}>
              Administradora{"\n"}{MARCA_ADMINISTRADORA}
            </Text>
          </View>
        </View>

        <View style={{ flexGrow: 1 }} />

        <Text style={{ fontFamily: FONT_MONO, fontSize: 9, letterSpacing: 3, color: "#bfe6fb", textTransform: "uppercase", marginBottom: 12 }}>
          Proposta de Consórcio
        </Text>
        <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 30, color: "#fff", lineHeight: 1.08, marginBottom: 14, maxWidth: 340 }}>
          Sua <Text style={{ fontStyle: "italic" }}>próxima conquista</Text>, agora no papel.
        </Text>
        <View style={{ width: 60, height: 4, backgroundColor: CYAN, borderRadius: 3, marginBottom: 18 }} />

        <View style={{ marginBottom: 18 }}>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 8, letterSpacing: 2, color: "#bfe6fb", textTransform: "uppercase", marginBottom: 5 }}>
            Preparada para
          </Text>
          <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 22, color: "#fff" }}>{data.cliente.nome}</Text>
        </View>

        <View style={{ borderWidth: 1, borderColor: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.13)", borderRadius: 18, padding: 14, maxWidth: 330 }}>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 7.5, letterSpacing: 1.4, color: "#d7effb", textTransform: "uppercase", marginBottom: 3 }}>
            Crédito contratado
          </Text>
          <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontStyle: "italic", fontSize: 20, color: "#fff", marginBottom: 6 }}>
            {ofertaCapaLabel(data)}
          </Text>
          <Text style={{ fontFamily: FONT_MONO, fontSize: 8, color: "#eaf6fd", lineHeight: 1.6 }}>
            · Lance fidelidade, livre, fixo e embutido{"\n"}
            · Sem juros — só taxa de administração e fundo de reserva
          </Text>
        </View>

        <MetaCapa data={data} claro />

        <Text style={{ fontSize: 7.5, color: "#bcdcf1", lineHeight: 1.5, marginTop: 14, maxWidth: 380 }}>
          Documento gerado por Gauchinho Consórcios — representante autorizado Racon. Simulação sujeita
          às regras da administradora, disponibilidade de vagas e aprovação cadastral. Não constitui
          garantia de contemplação.
        </Text>
      </View>

      <View style={{ position: "absolute", right: 40, bottom: 120, alignItems: "center" }}>
        <Image
          src={pdfImage("rubinho.png")}
          style={{ width: 92, height: 92, borderRadius: 46, borderWidth: 3, borderColor: "rgba(255,255,255,0.85)" }}
        />
        <Text style={{ fontFamily: FONT_MONO, fontSize: 6, letterSpacing: 0.8, color: "#d7effb", textTransform: "uppercase", marginTop: 4 }}>
          {RUBINHO_NOME}
        </Text>
      </View>
    </Page>
  );
}

function MetaCapa({ data, claro }: { data: PropostaPdfData; claro?: boolean }) {
  const items: Array<[string, string]> = [
    ["Protocolo", `#${data.propostaId.slice(0, 8).toUpperCase()}`],
    ["Emissão", data.dataEmissao],
    ["Validade", data.validadeTexto ?? "—"],
    ["Consultor", data.consultor.nome ?? data.contatoGauchinho.nomeEmpresa],
  ];
  const lbl = { fontFamily: FONT_MONO, fontSize: 7, letterSpacing: 1.2, textTransform: "uppercase" as const, color: claro ? "#a9d6f2" : "rgba(238,241,255,0.55)", marginBottom: 4 };
  return (
    <View style={{ flexDirection: "row", borderTopWidth: 1, borderColor: "rgba(255,255,255,0.18)", paddingTop: 12, marginTop: 16 }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ flexGrow: 1, flexBasis: "25%" }}>
          <Text style={lbl}>{k}</Text>
          <Text style={{ fontFamily: FONT_DISPLAY, fontWeight: 500, fontSize: 9.5, color: "#fff" }}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

function tituloCapa(data: PropostaPdfData): string {
  const tipos = data.segmentos.map((seg) => seg.tipo);
  if (tipos.length === 1 && tipos[0] === "imovel") return "Seu plano para conquistar o imóvel";
  if (tipos.length === 1 && tipos[0] === "veiculo") return "Seu plano para conquistar o veículo";
  if (tipos.includes("imovel") && tipos.includes("veiculo")) return "Seu plano para conquistar imóvel e veículo";
  return TITULO_PROPOSTA;
}

function ofertaCapaLabel(data: PropostaPdfData): string {
  const total = data.consolidado?.credito ?? 0;
  const labels = data.segmentos.map((seg) => seg.label.toLowerCase()).join(" + ");
  return labels ? `${fmtMoney(total)} · ${labels}` : fmtMoney(total);
}

/* ---------- folha de resumo ---------- */

function FolhaResumo({
  data,
  primeiroSegmento,
  pagina,
}: {
  data: PropostaPdfData;
  primeiroSegmento: SegmentoPdf;
  pagina: string;
}) {
  const c = data.consolidado;
  const multi = data.segmentos.length > 1;
  return (
    <Page size="A4" style={s.page}>
      <Cabecalho direito={`Proposta #${data.propostaId.slice(0, 8).toUpperCase()}`} />
      <Text style={s.kicker}>{multi ? "Resumo consolidado" : "Resumo da proposta"}</Text>
      <Text style={s.h2}>{multi ? "Dois objetivos, uma só estratégia" : resumoTitulo(data)}</Text>
      <Text style={s.subline}>{resumoSubtitulo(data)}</Text>

      {multi && c ? (
        <View style={s.cardRow}>
          <View style={[s.card, s.cardHero]}>
            <Text style={[s.cardLabel, s.cardLabelHero]}>Crédito total contratado</Text>
            <Text style={[s.cardValue, s.cardValueHero]}>{fmtMoney(c.credito)}</Text>
            <Text style={[s.cardSub, s.cardSubHero]}>{c.totalGrupos} grupos · {c.totalCotas} cotas</Text>
          </View>
          <View style={s.card}><Text style={s.cardLabel}>1ª parcela somada</Text><Text style={s.cardValue}>{fmtMoney(c.primeiraParcela)}</Text></View>
          <View style={s.card}><Text style={s.cardLabel}>Lance total</Text><Text style={s.cardValue}>{fmtMoney(c.lanceTotal)}</Text></View>
          <View style={s.card}><Text style={s.cardLabel}>Crédito líquido total</Text><Text style={s.cardValue}>{fmtMoney(c.creditoLiquido)}</Text></View>
        </View>
      ) : (
        <View style={s.cardRow}>
          {resumoCardsSegmento(primeiroSegmento).map((it) => (
            <View key={it.label} style={s.card}>
              <Text style={s.cardLabel}>{it.label}</Text>
              <Text style={s.cardValue}>{it.value}</Text>
              {it.sub ? <Text style={s.cardSub}>{it.sub}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <SegBlock data={data} segmento={primeiroSegmento} />

      <Rodape pagina={pagina} />
    </Page>
  );
}

function resumoCardsSegmento(seg: SegmentoPdf) {
  const t = seg.totais;
  return [
    { label: "Crédito contratado", value: fmtMoney(t.credito), sub: undefined as string | undefined },
    { label: "1ª parcela", value: fmtMoney(t.primeiraParcela), sub: undefined },
    { label: "Lance total", value: fmtMoney(t.lanceTotal), sub: "embutido + próprio" },
    { label: "Crédito líquido", value: fmtMoney(t.creditoLiquido), sub: undefined },
  ];
}

function resumoTitulo(data: PropostaPdfData): string {
  const seg = data.segmentos[0];
  if (!seg) return "Resumo da proposta";
  return `${fmtMoney(seg.totais.credito)} de crédito ${seg.tipo === "imovel" ? "para o seu imóvel" : seg.tipo === "veiculo" ? "para o seu veículo" : ""}`.trim();
}

function resumoSubtitulo(data: PropostaPdfData): string {
  const partes = data.segmentos
    .map((seg) => `${seg.label.toLowerCase()} (${fmtMoney(seg.totais.credito)})`)
    .join(" e ");
  return `A proposta reúne ${partes}. Abaixo o resumo e o detalhamento de cada grupo — início, custo do plano, tipos de lance e evolução após a contemplação.`;
}

/* ---------- bloco de segmento ---------- */

function SegBlock({ data, segmento }: { data: PropostaPdfData; segmento: SegmentoPdf }) {
  return (
    <>
      {segmento.grupos.map((g, i) => (
        <View key={`${g.codigoGrupo}-${i}`} style={s.seg} wrap={false}>
          <View style={[s.segBar, segmento.tipo === "veiculo" ? s.segBarVeiculo : s.segBarImovel]}>
            <Text style={s.segBarTitle}>{segmento.label}</Text>
            <Text style={s.segBarMeta}>
              Grupo {g.codigoGrupo} · cota {g.cotaLabel} · início {g.inicioGrupo} · {g.parcelaTipoLabel}
            </Text>
          </View>
          <View style={s.segIn}>
            <StartBox g={g} linhas={data.linhasGrupo} />
            <DadosComposicao g={g} linhas={data.linhasGrupo} />
            {data.blocos.custoPlano ? <CustoBox g={g} /> : null}
            {data.blocos.tiposLance && g.modalidades.length > 0 ? <TiposLance g={g} /> : null}
            {data.blocos.evolucao && g.evolucao.length > 0 ? <Evolucao g={g} /> : null}
          </View>
        </View>
      ))}
    </>
  );
}

function StartBox({ g, linhas }: { g: GrupoPdfBlock; linhas: PropostaPdfData["linhasGrupo"] }) {
  const cells: Array<{ label: string; value: string; small?: string; hl?: boolean }> = [
    { label: "Início do grupo", value: g.inicioGrupo, small: "1ª assembleia", hl: true },
    { label: "Prazo total", value: g.prazoTotal ? `${g.prazoTotal} meses` : "—", small: linhas.assembleiasDecorridas && g.assembleiasDecorridas ? `${g.assembleiasDecorridas} assembleias` : undefined },
  ];
  if (linhas.prazoRestante) {
    cells.push({ label: "Prazo restante", value: g.prazoRestante ? `${g.prazoRestante} meses` : "—" });
  }
  cells.push({ label: "Custo do plano", value: g.custoMesLabel + " / mês", small: `${g.custoAnoLabel} / ano` });
  return (
    <View style={s.startbox}>
      {cells.map((c, i) => (
        <View key={c.label} style={[s.startCell, c.hl ? s.startCellHl : {}, i === cells.length - 1 ? s.startCellLast : {}]}>
          <Text style={s.startLabel}>{c.label}</Text>
          <Text style={s.startValue}>{c.value}</Text>
          {c.small ? <Text style={s.startSmall}>{c.small}</Text> : null}
        </View>
      ))}
    </View>
  );
}

function DadosComposicao({ g, linhas }: { g: GrupoPdfBlock; linhas: PropostaPdfData["linhasGrupo"] }) {
  const dados: Array<[string, string]> = [];
  if (linhas.administradora) dados.push(["Administradora", `${g.administradora}`]);
  if (linhas.taxaAdm && g.taxaAdmPercentual != null) dados.push(["Taxa de administração", pct(g.taxaAdmPercentual)]);
  if (linhas.fundoReserva && g.fundoReservaPercentual != null) dados.push(["Fundo de reserva", pct(g.fundoReservaPercentual)]);
  if (linhas.seguro) dados.push(["Seguro prestamista", g.seguroLabel]);
  if (linhas.reajuste) dados.push(["Reajuste do crédito", g.reajusteLabel]);
  if (linhas.contemplacao) dados.push(["Contemplação", g.contemplacaoLabel]);

  const comp: Array<[string, string, boolean]> = [
    ["Crédito contratado", fmtMoney(g.credito), false],
    ["Saldo devedor inicial", fmtMoney(g.saldoDevedor), false],
    ["1ª parcela", fmtMoney(g.primeiraParcela), false],
    ["Lance embutido", fmtMoney(g.lanceEmbutido), false],
    ...(g.recursoProprio > 0 ? [["Recurso próprio", fmtMoney(g.recursoProprio), false] as [string, string, boolean]] : []),
    ["Crédito líquido", fmtMoney(g.creditoLiquido), true],
  ];

  return (
    <View style={s.twocol}>
      <View style={s.panel}>
        <Text style={s.panelHead}>Dados do grupo</Text>
        {dados.map(([k, v], i) => (
          <View key={k} style={[s.drow, i === dados.length - 1 ? s.drowLast : {}]}>
            <Text style={s.drowK}>{k}</Text>
            <Text style={s.drowV}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={s.panel}>
        <Text style={s.panelHead}>Composição financeira</Text>
        {comp.map(([k, v, emph], i) => (
          <View key={k} style={[s.drow, emph ? s.drowEmph : {}, i === comp.length - 1 ? s.drowLast : {}]}>
            <Text style={emph ? s.drowEmphK : s.drowK}>{k}</Text>
            <Text style={emph ? s.drowEmphV : s.drowV}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function CustoBox({ g }: { g: GrupoPdfBlock }) {
  return (
    <View style={s.cost}>
      <View style={s.costCell}>
        <Text style={s.costLabel}>Custo do plano — sem juros</Text>
        <Text style={s.costCalc}>
          Taxa de administração + fundo de reserva = {pct(g.custoBasePercentual)}
          {"\n"}diluídos {g.prazoTotal ? `nos ${g.prazoTotal} meses do grupo` : "no prazo do grupo"}
        </Text>
      </View>
      <View style={[s.costCell, s.costCellHl]}>
        <Text style={s.costLabel}>Custo ao mês</Text>
        <Text style={s.costBig}>{g.custoMesLabel}</Text>
        <Text style={s.costBigSub}>base ÷ prazo</Text>
      </View>
      <View style={[s.costCell, s.costCellHl, s.costCellLast]}>
        <Text style={s.costLabel}>Custo ao ano</Text>
        <Text style={s.costBig}>{g.custoAnoLabel}</Text>
        <Text style={s.costBigSub}>custo mês × 12</Text>
      </View>
    </View>
  );
}

function TiposLance({ g }: { g: GrupoPdfBlock }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={s.lanceHead}>Tipos de lance disponíveis no grupo</Text>
      <View style={s.ltHead}>
        <Text style={[s.ltHeadCell, s.ltColName]}>Modalidade</Text>
        <Text style={[s.ltHeadCell, s.ltCol]}>Embutido</Text>
        <Text style={[s.ltHeadCell, s.ltCol]}>Rec. próprio</Text>
        <Text style={[s.ltHeadCell, s.ltCol]}>Lance total*</Text>
      </View>
      {g.modalidades.map((m, i) => (
        <View key={`${m.nome}-${i}`} style={[s.ltRow, m.escolhida ? s.ltRowSel : {}]}>
          <Text style={[s.ltCell, s.ltCellName, s.ltColName]}>
            {m.nome}
            {m.escolhida ? "  (escolhido)" : ""}
          </Text>
          <Text style={[s.ltCell, s.ltCol]}>{m.embutidoLabel}</Text>
          <Text style={[s.ltCell, s.ltCol]}>{m.recProprioLabel}</Text>
          <Text style={[s.ltCell, s.ltCol]}>{m.lanceTotalLabel}</Text>
        </View>
      ))}
      <Text style={s.ltNote}>
        * Estimado sobre o saldo devedor inicial de {fmtMoney(g.saldoDevedor)}. O lance efetivo
        depende da assembleia de contemplação. Modalidade escolhida em destaque.
      </Text>
    </View>
  );
}

function Evolucao({ g }: { g: GrupoPdfBlock }) {
  return (
    <View style={s.timeline}>
      <Text style={s.timelineHead}>
        Evolução após a contemplação{g.modalidadeEscolhidaNome ? ` — ${g.modalidadeEscolhidaNome}` : ""}
      </Text>
      <View style={s.track}>
        {g.evolucao.slice(0, 4).map((n, i) => (
          <View key={`${n.periodo}-${i}`} style={s.node}>
            <Text style={s.nodeYr}>{n.periodo}</Text>
            <Text style={s.nodeM}>{n.linhas.join("\n")}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ---------- folha de encerramento ---------- */

function FolhaEncerramento({ data, pagina }: { data: PropostaPdfData; pagina: string }) {
  const contato = data.consultor.usarConsultor && data.consultor.nome
    ? { nome: data.consultor.nome, tel: data.consultor.telefone, email: data.consultor.email }
    : { nome: data.contatoGauchinho.nomeEmpresa, tel: data.contatoGauchinho.whatsapp, email: data.contatoGauchinho.email };
  return (
    <Page size="A4" style={s.page}>
      <Cabecalho direito="Encerramento" />
      {data.blocos.observacao && data.observacaoConsultor ? (
        <>
          <Text style={s.kicker}>Observação do consultor</Text>
          <Text style={s.h2}>Recado personalizado e próximos passos</Text>
          <View style={[s.obs, { marginTop: 12 }]}>
            <Text style={s.obsTop}>Observação{data.consultor.nome ? ` — ${data.consultor.nome}` : ""}</Text>
            <Text style={s.obsBody}>{data.observacaoConsultor}</Text>
          </View>
        </>
      ) : (
        <>
          <Text style={s.kicker}>Atendimento</Text>
          <Text style={s.h2}>Próximos passos</Text>
          <Text style={s.subline}>{TEXTO_ENCERRAMENTO}</Text>
        </>
      )}

      <View style={s.ccardRow}>
        <View style={s.ccard}>
          <Text style={s.ccardL}>Consultor responsável</Text>
          <Text style={s.ccardNm}>{contato.nome}</Text>
          {contato.tel ? <Text style={[s.ccardLi, s.mono]}>{contato.tel}</Text> : null}
          {contato.email ? <Text style={s.ccardLi}>{contato.email}</Text> : null}
          {data.contatoGauchinho.site ? <Text style={s.ccardLi}>{data.contatoGauchinho.site}</Text> : null}
        </View>
        <View style={s.ccard}>
          <Text style={s.ccardL}>Administradora</Text>
          <Text style={s.ccardNm}>Racon Consórcios</Text>
          <Text style={s.ccardLi}>Randon Administradora de Consórcios Ltda</Text>
          <Text style={[s.ccardLi, s.mono]}>Grupo Randon</Text>
        </View>
      </View>

      {data.blocos.observacao ? (
        <View style={s.signRow}>
          <Text style={s.sign}>Assinatura do cliente</Text>
          <Text style={s.sign}>Consultor · Gauchinho Consórcios</Text>
        </View>
      ) : null}

      <View style={s.disclaimer}>
        <Text style={s.disclaimerP}>
          <Text style={{ fontWeight: 700, color: NAVY_INK }}>Aviso legal. </Text>
          {data.contatoGauchinho ? AVISO_RESUMO : AVISO_RESUMO} O consórcio não tem juros, mas possui
          taxa de administração e fundo de reserva. A contemplação ocorre por sorteio ou lance e não é
          garantida em prazo determinado. A adesão está sujeita à assinatura do contrato de
          participação e ao regulamento do grupo, registrados na administradora e fiscalizados pelo
          Banco Central do Brasil.
        </Text>
        <Text style={s.disclaimerP}>
          Documento emitido por Gauchinho Consórcios, representante autorizado Racon · Proposta #
          {data.propostaId.slice(0, 8).toUpperCase()} · Emissão {data.dataEmissao}
          {data.validadeTexto ? ` · Validade ${data.validadeTexto}` : ""}.
        </Text>
      </View>

      <Rodape pagina={pagina} />
    </Page>
  );
}

/* ---------- documento ---------- */

export function PropostaPdfDocument({ data }: { data: PropostaPdfData }) {
  const temSegmentos = data.segmentos.length > 0;

  if (!temSegmentos) {
    return <LegacyDocument data={data} />;
  }

  const multi = data.segmentos.length > 1;
  const [seg0, ...segRestantes] = data.segmentos;
  // Folha 1 = resumo + 1º segmento (sempre); demais segmentos ganham folha própria;
  // última folha = encerramento. Ex.: 1 segmento → capa + 2; 2 segmentos → capa + 3.
  const totalFolhas = 1 + segRestantes.length + 1;

  return (
    <Document title={TITULO_PROPOSTA} author={MARCA_PRINCIPAL}>
      {data.capaEstilo === "campanha" ? <CapaCampanha data={data} /> : <CapaPadrao data={data} />}

      <FolhaResumo data={data} primeiroSegmento={seg0} pagina={`Folha 1 / ${totalFolhas}`} />

      {segRestantes.map((seg, i) => (
        <Page key={seg.tipo} size="A4" style={s.page}>
          <Cabecalho direito={`Segmento ${seg.label}`} />
          <Text style={s.kicker}>Segmento {seg.label}</Text>
          <Text style={s.h2}>Detalhamento do grupo</Text>
          <View style={{ height: 8 }} />
          <SegBlock data={data} segmento={seg} />
          <Rodape pagina={`Folha ${2 + i} / ${totalFolhas}`} />
        </Page>
      ))}

      <FolhaEncerramento data={data} pagina={`Folha ${totalFolhas} / ${totalFolhas}`} />
    </Document>
  );
}

export async function renderPropostaPdfBuffer(data: PropostaPdfData) {
  return renderToBuffer(<PropostaPdfDocument data={data} />);
}

function pct(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

/* ============================================================
   Layout legado — propostas sem grupos (simulador / carta)
   ============================================================ */

const legacy = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#27272a", backgroundColor: "#fafafa" },
  cover: { flex: 1, justifyContent: "center", backgroundColor: "#18181b", padding: 48, margin: -40 },
  gold: { color: "#f59e0b" },
  white: { color: "#fafafa" },
  muted: { color: "#a1a1aa", fontSize: 9 },
  h1: { fontSize: 22, fontWeight: "bold", marginTop: 24, color: "#fafafa" },
  h2: { fontSize: 14, fontWeight: "bold", marginBottom: 12, color: "#18181b" },
  card: { backgroundColor: "#ffffff", borderRadius: 6, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#e4e4e7" },
  cardLabel: { fontSize: 8, color: "#71717a", textTransform: "uppercase" },
  cardValue: { fontSize: 12, fontWeight: "bold", marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colHalf: { width: "48%" },
  tableHeader: { flexDirection: "row", backgroundColor: "#18181b", padding: 6, marginTop: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e4e4e7", padding: 5 },
  cell: { flex: 1, fontSize: 8 },
  footer: { marginTop: 24, fontSize: 8, color: "#71717a", lineHeight: 1.4 },
  badge: { backgroundColor: "#fef3c7", color: "#92400e", padding: 4, borderRadius: 4, fontSize: 8, alignSelf: "flex-start", marginBottom: 8 },
});

function LegacyResumoCards({ data }: { data: PropostaPdfData }) {
  const items = [
    { label: "Valor do crédito", value: fmtMoney(data.resumo.valorCredito) },
    { label: "Tipo de solução", value: data.tipoProposta },
    { label: "Prazo", value: fmtPrazo(data.resumo.prazo) },
    { label: "Parcela estimada", value: fmtMoney(data.resumo.parcela) },
    { label: "Entrada / recurso", value: fmtMoney(data.resumo.entrada) },
    { label: "Lance embutido", value: fmtMoney(data.resumo.lanceEmbutido) },
    { label: "Saldo devedor inicial", value: fmtMoney(data.resumo.valorTotal) },
    { label: "Crédito líquido", value: fmtMoney(data.resumo.creditoLiquido) },
  ];
  return (
    <View style={legacy.row}>
      {items.map((it) => (
        <View key={it.label} style={[legacy.card, legacy.colHalf]}>
          <Text style={legacy.cardLabel}>{it.label}</Text>
          <Text style={legacy.cardValue}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

function LegacyDocument({ data }: { data: PropostaPdfData }) {
  const contato = data.consultor.usarConsultor && data.consultor.nome
    ? { nome: data.consultor.nome, tel: data.consultor.telefone, email: data.consultor.email }
    : { nome: data.contatoGauchinho.nomeEmpresa, tel: data.contatoGauchinho.whatsapp, email: data.contatoGauchinho.email };

  return (
    <Document title={TITULO_PROPOSTA} author={MARCA_PRINCIPAL}>
      <Page size="A4" style={legacy.page}>
        <View style={legacy.cover}>
          <Text style={[legacy.gold, { fontSize: 11, letterSpacing: 2 }]}>{MARCA_PRINCIPAL}</Text>
          {data.parceiroNome ? (
            <Text style={[legacy.white, { marginTop: 8, fontSize: 10 }]}>Em parceria com {data.parceiroNome}</Text>
          ) : null}
          <Text style={legacy.h1}>{TITULO_PROPOSTA}</Text>
          <Text style={[legacy.white, { fontSize: 14, marginTop: 16 }]}>{data.cliente.nome}</Text>
          <Text style={[legacy.muted, { marginTop: 8 }]}>{data.tipoProposta}{data.tipoBem ? ` · ${data.tipoBem}` : ""}</Text>
          <Text style={[legacy.muted, { marginTop: 4 }]}>Emissão: {data.dataEmissao}</Text>
          {data.validadeTexto ? (
            <Text style={[legacy.gold, { marginTop: 8 }]}>Validade da proposta: {data.validadeTexto}</Text>
          ) : null}
          <Text style={[legacy.white, { marginTop: 32, fontSize: 10, lineHeight: 1.5, maxWidth: 400 }]}>{FRASE_CAPA}</Text>
        </View>
      </Page>

      <Page size="A4" style={legacy.page}>
        <Text style={legacy.h2}>Resumo executivo</Text>
        <LegacyResumoCards data={data} />
        <Text style={[legacy.footer, { marginTop: 16 }]}>{AVISO_RESUMO}</Text>
      </Page>

      <Page size="A4" style={legacy.page}>
        <Text style={legacy.h2}>Detalhamento da simulação</Text>
        {data.detalhesLinhas.map((ln) => (
          <View key={ln.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text>{ln.label}</Text>
            <Text style={{ fontWeight: "bold" }}>{ln.value}</Text>
          </View>
        ))}
        {data.gruposCotas.length > 0 ? (
          <>
            <Text style={[legacy.h2, { marginTop: 16 }]}>Grupos e cotas selecionados</Text>
            <View style={legacy.tableHeader}>
              {["Grupo", "Tipo", "Crédito", "Parcela", "Lance tot."].map((h) => (
                <Text key={h} style={[legacy.cell, legacy.white]}>{h}</Text>
              ))}
            </View>
            {data.gruposCotas.map((g, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={legacy.tableRow}>
                  <Text style={legacy.cell}>{g.codigoGrupo}</Text>
                  <Text style={legacy.cell}>{g.modalidade}</Text>
                  <Text style={legacy.cell}>{fmtMoney(g.valorCredito)}</Text>
                  <Text style={legacy.cell}>{fmtMoney(g.parcela)}</Text>
                  <Text style={legacy.cell}>{fmtMoney(g.lanceTotal)}</Text>
                </View>
              </View>
            ))}
          </>
        ) : null}
      </Page>

      {data.comparativo ? (
        <Page size="A4" style={legacy.page}>
          <Text style={legacy.h2}>Comparativo Consórcio x Financiamento</Text>
          <View style={legacy.row}>
            <View style={[legacy.card, legacy.colHalf]}>
              <Text style={{ fontWeight: "bold", color: "#047857" }}>Consórcio</Text>
              <Text style={{ marginTop: 8 }}>Parcela: {fmtMoney(data.comparativo.consorcioParcela)}</Text>
              <Text>Total est.: {fmtMoney(data.comparativo.consorcioTotal)}</Text>
            </View>
            <View style={[legacy.card, legacy.colHalf]}>
              <Text style={{ fontWeight: "bold", color: "#0369a1" }}>Financiamento</Text>
              <Text style={{ marginTop: 8 }}>Parcela: {fmtMoney(data.comparativo.financiamentoParcela)}</Text>
              <Text>Total: {fmtMoney(data.comparativo.financiamentoTotal)}</Text>
            </View>
          </View>
          <Text style={legacy.footer}>{TEXTO_COMPARATIVO}</Text>
        </Page>
      ) : null}

      {data.mostrarProjecao && data.marcosProjecao.length > 0 ? (
        <Page size="A4" style={legacy.page}>
          <Text style={legacy.h2}>Vantagem da Programação Financeira</Text>
          {data.marcosProjecao.map((m) => (
            <View key={m.periodo} style={legacy.card}>
              <Text style={{ fontWeight: "bold" }}>{m.periodo}</Text>
              <Text>Total pago est.: {fmtMoney(m.totalPago)}</Text>
              <Text>Crédito reajustado: {fmtMoney(m.creditoReajustado)}</Text>
              <Text>Ganho patrimonial est.: {fmtMoney(m.ganhoPatrimonial)}</Text>
            </View>
          ))}
          <Text style={legacy.footer}>{AVISO_PROJECAO_PDF}</Text>
        </Page>
      ) : null}

      <Page size="A4" style={legacy.page}>
        <Text style={legacy.h2}>Atendimento e próximos passos</Text>
        <View style={legacy.card}>
          <Text style={legacy.cardLabel}>Contato</Text>
          <Text style={legacy.cardValue}>{contato.nome}</Text>
          {contato.tel ? <Text>WhatsApp: {contato.tel}</Text> : null}
          {contato.email ? <Text>E-mail: {contato.email}</Text> : null}
        </View>
        <Text style={[legacy.footer, { marginTop: 24 }]}>{TEXTO_ENCERRAMENTO}</Text>
        <Text style={legacy.muted}>Proposta #{data.propostaId.slice(0, 8)}</Text>
      </Page>
    </Document>
  );
}
