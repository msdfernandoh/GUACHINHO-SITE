import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatBRL } from "@/lib/formatters/money";
import { formatWhatsappBrInput } from "@/lib/utils/format";
import type { NpsDashboardData } from "@/lib/eventos-sorteio/nps-dashboard";
import { buildIndicacaoExportRow, buildNpsExportRow, formatNpsRespostaExport } from "@/lib/eventos-sorteio/nps-export";

const s = StyleSheet.create({
  page: {
    padding: 32,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#27272a",
  },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 10, color: "#71717a", marginBottom: 16 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  summaryCard: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
    padding: 8,
    minWidth: "22%",
  },
  summaryLabel: { fontSize: 7, color: "#71717a", textTransform: "uppercase" },
  summaryValue: { fontSize: 12, fontWeight: "bold", marginTop: 4 },
  block: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 4,
    padding: 10,
    marginBottom: 10,
  },
  blockTitle: { fontSize: 11, fontWeight: "bold", marginBottom: 6 },
  meta: { fontSize: 9, marginBottom: 2, color: "#3f3f46" },
  qaRow: { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderColor: "#f4f4f5" },
  qLabel: { fontSize: 8, color: "#71717a" },
  qValue: { fontSize: 9, marginTop: 2 },
  sectionTitle: { fontSize: 13, fontWeight: "bold", marginTop: 16, marginBottom: 8 },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 7, color: "#a1a1aa" },
});

function NpsExportPdfDocument({ data }: { data: NpsDashboardData }) {
  const generated = new Date().toLocaleString("pt-BR");
  return (
    <Document title={`NPS — ${data.eventoNome}`} author="Gauchinho">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>Respostas NPS — {data.eventoNome}</Text>
        <Text style={s.subtitle}>Exportado em {generated}</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Respostas</Text>
            <Text style={s.summaryValue}>{data.totalComNps}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Score NPS</Text>
            <Text style={s.summaryValue}>{data.scoreNps ?? "—"}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Média recomendação</Text>
            <Text style={s.summaryValue}>{data.mediaRecomendacao ?? "—"}</Text>
          </View>
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>Indicações</Text>
            <Text style={s.summaryValue}>{data.totalIndicacoes}</Text>
          </View>
        </View>
        <Text style={s.sectionTitle}>Respostas NPS</Text>
        {data.respostas.map((row, index) => {
          const cells = buildNpsExportRow(row, data.perguntasColunas);
          const valor = cells[2];
          const codigo = cells[3];
          const dataResposta = cells[4];
          return (
            <View key={row.participanteId} style={s.block}>
              <Text style={s.blockTitle}>
                {index + 1}. {row.nome}
              </Text>
              <Text style={s.meta}>Telefone: {formatWhatsappBrInput(row.telefone)}</Text>
              <Text style={s.meta}>
                Valor disponível para investimento:{" "}
                {row.valorMensalDisponivel != null ? formatBRL(row.valorMensalDisponivel) : valor || "—"}
              </Text>
              <Text style={s.meta}>Código: {codigo || row.codigo}</Text>
              {dataResposta ? <Text style={s.meta}>Respondido em: {dataResposta}</Text> : null}
              {data.perguntasColunas.map((p) => (
                <View key={p.chave} style={s.qaRow}>
                  <Text style={s.qLabel}>{p.titulo}</Text>
                  <Text style={s.qValue}>
                    {formatNpsRespostaExport(p.tipo, row.respostas[p.chave]) || "—"}
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
        {data.respostas.length === 0 ? (
          <Text style={s.meta}>Nenhuma resposta NPS registrada para este evento.</Text>
        ) : null}

        <Text style={s.sectionTitle}>Indicações ({data.indicacoes.length})</Text>
        {data.indicacoes.map((ind, index) => {
          const cells = buildIndicacaoExportRow(ind);
          return (
            <View key={ind.id} style={s.block}>
              <Text style={s.blockTitle}>
                {index + 1}. {cells[1]}
              </Text>
              <Text style={s.meta}>Data: {cells[0]}</Text>
              <Text style={s.meta}>Tipo: {cells[2]}</Text>
              <Text style={s.meta}>Telefone indicado: {cells[3]}</Text>
              <Text style={s.meta}>
                Indicado por: {cells[4]} — {cells[5]}
              </Text>
              <Text style={s.meta}>Cupom gerado: {cells[6]}</Text>
            </View>
          );
        })}
        {data.indicacoes.length === 0 ? (
          <Text style={s.meta}>Nenhuma indicação registrada para este evento.</Text>
        ) : null}
        <Text style={s.footer} fixed>
          Gauchinho Consórcios — NPS {data.eventoNome}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderNpsExportPdfBuffer(data: NpsDashboardData): Promise<Buffer> {
  const buffer = await renderToBuffer(<NpsExportPdfDocument data={data} />);
  return Buffer.from(buffer);
}
