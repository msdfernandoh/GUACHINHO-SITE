import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { carregarExtratoCliente } from "@/app/erp/extrato-clientes/actions";
import { moedaExtrato as brl } from "@/lib/erp/extrato-cliente";

export const runtime = "nodejs";
const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 9, color: "#17233b" },
  title: { fontSize: 20, marginBottom: 8 }, heading: { fontSize: 13, marginTop: 16, marginBottom: 8 },
  text: { marginBottom: 5, lineHeight: 1.4 }, note: { fontSize: 8, color: "#475569", marginVertical: 8, lineHeight: 1.4 },
  row: { flexDirection: "row", borderBottom: "1 solid #e2e8f0", paddingVertical: 5 },
  cell: { width: "25%", paddingRight: 6 }, footer: { position: "absolute", bottom: 18, right: 36, fontSize: 8 },
});

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const dados = await carregarExtratoCliente(id, url.searchParams.get("historico") ?? "12", url.searchParams.get("mes") ?? "");
  const pdf = await renderToBuffer(
    <Document title={`Extrato de ${dados.cliente.nome}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Extrato do Cliente</Text>
        <Text style={styles.heading}>{dados.cliente.nome}</Text>
        <Text style={styles.text}>Data-base {dados.hoje} | {dados.cotas.length} cotas | Histórico {dados.historico === "mes" ? "do mês atual" : dados.historico === "todos" ? "desde a adesão" : "dos últimos 12 meses"}</Text>
        <Text style={styles.note}>Simulação considerando todas as parcelas pagas em dia. O reajuste expressa a evolução do crédito. As projeções repetem o último reajuste anual e as parcelas também podem sofrer reajuste contratual.</Text>
        {dados.cotas.map((c) => (
          <View key={c.id}>
            <Text style={styles.heading} minPresenceAhead={95}>Grupo {c.grupo} | Cota {c.cota}{c.reajustou ? " | Reajuste no mês de referência" : ""}</Text>
            <Text style={styles.text}>Adesão {c.adesao || "não informada"} | {c.contemplada ? "Contemplada" : "Em acompanhamento"}</Text>
            <Text style={styles.text}>Crédito na adesão {brl(c.contratado)} | Crédito atual {brl(c.atual)}</Text>
            <Text style={styles.text}>Reajuste acumulado {brl(c.valorizacao)} {c.percentual === null ? "" : `(${c.percentual.toFixed(2)}%)`}</Text>
            <Text style={styles.text}>Total estimado de {c.quantidade} parcelas desde a adesão {brl(c.totalParcelas)}</Text>
            <Text style={styles.text}>Projeção em 3 anos {brl(c.projecao3)} | Em 5 anos {brl(c.projecao5)} | Taxa anual {c.taxa === null ? "indisponível" : c.taxa + "%"}</Text>
            <Text style={styles.note}>Estimativa das parcelas pela parcela vigente e pelo histórico proporcional do crédito, sujeita a conferência de condições individuais e troca de bem.</Text>
            <View style={styles.row} wrap={false}><Text style={styles.cell}>Assembleia</Text><Text style={styles.cell}>Melhor referência</Text><Text style={styles.cell}>Distância</Text><Text style={styles.cell}>Proximidade histórica</Text></View>
            {c.assembleias.map((a) => <View key={a.numero} style={styles.row} wrap={false}><Text style={styles.cell}>{a.data}</Text><Text style={styles.cell}>{a.melhor ? a.melhor.modalidade.replaceAll("_", " ") + " " + a.melhor.cota : "Indisponível"}</Text><Text style={styles.cell}>{a.melhor?.distancia ?? "—"}</Text><Text style={styles.cell}>{a.percentual === null ? "Indisponível" : a.percentual.toFixed(2) + "%"}</Text></View>)}
            {!c.assembleias.length && <Text style={styles.note}>Sem resultados verificados no período.</Text>}
            <Text style={styles.note}>Proximidade numérica histórica. Elegibilidade e participação nos lances precisam ser confirmadas. Este indicador não mede a probabilidade de contemplação futura.</Text>
          </View>
        ))}
        <Text fixed style={styles.footer} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>,
  );
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
    "Content-Disposition": `${url.searchParams.get("baixar") === "1" ? "attachment" : "inline"}; filename="extrato-cliente.pdf"`,
  } });
}
