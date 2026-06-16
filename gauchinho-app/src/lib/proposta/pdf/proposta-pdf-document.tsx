import type { PropostaPdfData } from "./types";
import {
  AVISO_PROJECAO_PDF,
  AVISO_RESUMO,
  FRASE_CAPA,
  MARCA_PRINCIPAL,
  TEXTO_COMPARATIVO,
  TEXTO_ENCERRAMENTO,
  TITULO_PROPOSTA,
} from "./types";
import { fmtMoney, fmtPrazo } from "./format";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#27272a",
    backgroundColor: "#fafafa",
  },
  cover: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#18181b",
    padding: 48,
    margin: -40,
  },
  gold: { color: "#f59e0b" },
  white: { color: "#fafafa" },
  muted: { color: "#a1a1aa", fontSize: 9 },
  h1: { fontSize: 22, fontWeight: "bold", marginTop: 24, color: "#fafafa" },
  h2: { fontSize: 14, fontWeight: "bold", marginBottom: 12, color: "#18181b" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardLabel: { fontSize: 8, color: "#71717a", textTransform: "uppercase" },
  cardValue: { fontSize: 12, fontWeight: "bold", marginTop: 4 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  colHalf: { width: "48%" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#18181b",
    padding: 6,
    marginTop: 8,
  },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#e4e4e7", padding: 5 },
  cell: { flex: 1, fontSize: 8 },
  footer: { marginTop: 24, fontSize: 8, color: "#71717a", lineHeight: 1.4 },
  badge: {
    backgroundColor: "#fef3c7",
    color: "#92400e",
    padding: 4,
    borderRadius: 4,
    fontSize: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
});

function ResumoCards({ data }: { data: PropostaPdfData }) {
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
    <View style={s.row}>
      {items.map((it) => (
        <View key={it.label} style={[s.card, s.colHalf]}>
          <Text style={s.cardLabel}>{it.label}</Text>
          <Text style={s.cardValue}>{it.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function PropostaPdfDocument({ data }: { data: PropostaPdfData }) {
  const contato = data.consultor.usarConsultor && data.consultor.nome
    ? {
        nome: data.consultor.nome,
        tel: data.consultor.telefone,
        email: data.consultor.email,
      }
    : {
        nome: data.contatoGauchinho.nomeEmpresa,
        tel: data.contatoGauchinho.whatsapp,
        email: data.contatoGauchinho.email,
      };

  return (
    <Document title={TITULO_PROPOSTA} author={MARCA_PRINCIPAL}>
      <Page size="A4" style={s.page}>
        <View style={s.cover}>
          <Text style={[s.gold, { fontSize: 11, letterSpacing: 2 }]}>{MARCA_PRINCIPAL}</Text>
          {data.parceiroNome ? (
            <Text style={[s.white, { marginTop: 8, fontSize: 10 }]}>Em parceria com {data.parceiroNome}</Text>
          ) : null}
          <Text style={s.h1}>{TITULO_PROPOSTA}</Text>
          <Text style={[s.white, { fontSize: 14, marginTop: 16 }]}>{data.cliente.nome}</Text>
          <Text style={[s.muted, { marginTop: 8 }]}>{data.tipoProposta}{data.tipoBem ? ` · ${data.tipoBem}` : ""}</Text>
          <Text style={[s.muted, { marginTop: 4 }]}>Emissão: {data.dataEmissao}</Text>
          {data.validadeTexto ? (
            <Text style={[s.gold, { marginTop: 8 }]}>Validade da proposta: {data.validadeTexto}</Text>
          ) : null}
          <Text style={[s.white, { marginTop: 32, fontSize: 10, lineHeight: 1.5, maxWidth: 400 }]}>
            {FRASE_CAPA}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Resumo executivo</Text>
        <ResumoCards data={data} />
        <Text style={[s.footer, { marginTop: 16 }]}>{AVISO_RESUMO}</Text>
      </Page>

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Detalhamento da simulação</Text>
        {data.detalhesLinhas.map((ln) => (
          <View key={ln.label} style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text>{ln.label}</Text>
            <Text style={{ fontWeight: "bold" }}>{ln.value}</Text>
          </View>
        ))}
        {data.gruposCotas.length > 0 ? (
          <>
            <Text style={[s.h2, { marginTop: 16 }]}>Grupos e cotas selecionados</Text>
            <View style={s.tableHeader}>
              {["Grupo", "Tipo", "Crédito", "Parcela", "Lance tot."].map((h) => (
                <Text key={h} style={[s.cell, s.white]}>{h}</Text>
              ))}
            </View>
            {data.gruposCotas.map((g, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.cell}>{g.codigoGrupo}</Text>
                <Text style={s.cell}>{g.modalidade}</Text>
                <Text style={s.cell}>{fmtMoney(g.valorCredito)}</Text>
                <Text style={s.cell}>{fmtMoney(g.parcela)}</Text>
                <Text style={s.cell}>{fmtMoney(g.lanceTotal)}</Text>
              </View>
            ))}
            {data.gruposTotais ? (
              <View style={{ marginTop: 12 }}>
                <Text style={s.badge}>Totais</Text>
                <Text>Crédito total: {fmtMoney(data.gruposTotais.creditoTotal)}</Text>
                <Text>Lance total: {fmtMoney(data.gruposTotais.lanceTotal)}</Text>
                <Text>1ª parcela total: {fmtMoney(data.gruposTotais.primeiraParcela)}</Text>
                <Text style={s.gold}>Crédito líquido: {fmtMoney(data.gruposTotais.creditoLiquido)}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </Page>

      {data.comparativo ? (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Comparativo Consórcio x Financiamento</Text>
          <View style={s.row}>
            <View style={[s.card, s.colHalf]}>
              <Text style={{ fontWeight: "bold", color: "#047857" }}>Consórcio</Text>
              <Text style={s.muted}>Sem juros · Compra planejada · Taxa administrativa</Text>
              <Text style={{ marginTop: 8 }}>Parcela: {fmtMoney(data.comparativo.consorcioParcela)}</Text>
              <Text>Total est.: {fmtMoney(data.comparativo.consorcioTotal)}</Text>
            </View>
            <View style={[s.card, s.colHalf]}>
              <Text style={{ fontWeight: "bold", color: "#0369a1" }}>Financiamento</Text>
              <Text style={s.muted}>Compra imediata · Juros mensais · Análise de crédito</Text>
              <Text style={{ marginTop: 8 }}>Parcela: {fmtMoney(data.comparativo.financiamentoParcela)}</Text>
              <Text>Total: {fmtMoney(data.comparativo.financiamentoTotal)}</Text>
            </View>
          </View>
          <Text style={{ marginTop: 12 }}>
            Diferença de custo total: {fmtMoney(data.comparativo.diferencaTotal)} · Diferença de parcela:{" "}
            {fmtMoney(data.comparativo.diferencaParcela)}
          </Text>
          <Text style={s.footer}>{TEXTO_COMPARATIVO}</Text>
        </Page>
      ) : null}

      {data.mostrarProjecao && data.marcosProjecao.length > 0 ? (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Vantagem da Programação Financeira</Text>
          {data.marcosProjecao.map((m) => (
            <View key={m.periodo} style={s.card}>
              <Text style={{ fontWeight: "bold" }}>{m.periodo}</Text>
              <Text>Total pago est.: {fmtMoney(m.totalPago)}</Text>
              <Text>Crédito reajustado: {fmtMoney(m.creditoReajustado)}</Text>
              <Text>Valorização: {fmtMoney(m.valorizacao)}</Text>
              <Text>Ganho patrimonial est.: {fmtMoney(m.ganhoPatrimonial)}</Text>
            </View>
          ))}
          <Text style={s.footer}>{AVISO_PROJECAO_PDF}</Text>
        </Page>
      ) : null}

      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Atendimento e próximos passos</Text>
        <View style={s.card}>
          <Text style={s.cardLabel}>Contato</Text>
          <Text style={s.cardValue}>{contato.nome}</Text>
          {contato.tel ? <Text>WhatsApp: {contato.tel}</Text> : null}
          {contato.email ? <Text>E-mail: {contato.email}</Text> : null}
          {data.contatoGauchinho.site ? <Text>Site: {data.contatoGauchinho.site}</Text> : null}
          {data.contatoGauchinho.endereco ? <Text>{data.contatoGauchinho.endereco}</Text> : null}
        </View>
        <Text style={[s.footer, { marginTop: 24 }]}>{TEXTO_ENCERRAMENTO}</Text>
        <Text style={s.muted}>Proposta #{data.propostaId.slice(0, 8)}</Text>
      </Page>
    </Document>
  );
}

export async function renderPropostaPdfBuffer(data: PropostaPdfData) {
  return renderToBuffer(<PropostaPdfDocument data={data} />);
}
