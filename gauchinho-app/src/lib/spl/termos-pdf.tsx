import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

// Sem hifenização automática (ela quebra palavras em português no lugar errado).
Font.registerHyphenationCallback((palavra) => [palavra]);

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 44, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 9.5, color: "#1f2937", lineHeight: 1.45 },
  topo: { borderBottomWidth: 2, borderBottomColor: "#F59E0B", paddingBottom: 8, marginBottom: 12 },
  marca: { fontSize: 8, color: "#153E90", fontFamily: "Helvetica-Bold" },
  titulo: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#0A1931", marginTop: 4 },
  sub: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  secao: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: "#0A1931", marginTop: 10, marginBottom: 4 },
  texto: { marginBottom: 5, textAlign: "justify" },
  item: { flexDirection: "row", marginBottom: 3, paddingLeft: 6 },
  marcador: { width: 10 },
  destaque: { backgroundColor: "#EEF2FF", borderLeftWidth: 3, borderLeftColor: "#153E90", padding: 6, marginVertical: 5 },
  aceite: { marginTop: 14, borderWidth: 1, borderColor: "#16a34a", backgroundColor: "#f0fdf4", borderRadius: 4, padding: 10 },
  rodape: { position: "absolute", bottom: 18, left: 44, right: 44, fontSize: 7.5, color: "#9ca3af", textAlign: "center" },
});

export type DadosTermosPdf = {
  versao: string;
  /** Texto já preenchido: 1ª linha é o título e a 2ª o subtítulo. */
  texto: string;
  responsavel?: string | null;
  aceite?: { em: string; versao: string; ip: string | null } | null;
};

const SECAO = /^(\d{1,2}\.\s|ANEXO\b|Qualificação das partes|Aceite eletrônico|Exemplos de distribuição|Condições complementares)/;

function TermosDoc({ d }: { d: DadosTermosPdf }) {
  const linhas = d.texto.split("\n").map((l) => l.trim());
  const [titulo, subtitulo, ...resto] = linhas;
  const blocos = resto.filter(Boolean);
  const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
  return (
    <Document title={`${titulo} · versão ${d.versao}`}>
      <Page size="A4" style={s.page}>
        <View style={s.topo}>
          <Text style={s.marca}>RACON | GAUCHINHO CONSÓRCIOS · PORTFÓLIO SPL</Text>
          <Text style={s.titulo}>{titulo}</Text>
          {subtitulo ? <Text style={s.sub}>{subtitulo}</Text> : null}
          <Text style={s.sub}>Versão {d.versao}</Text>
        </View>
        {blocos.map((b, i) => {
          if (SECAO.test(b)) {
            return (
              <Text key={i} style={s.secao} minPresenceAhead={40}>
                {b}
              </Text>
            );
          }
          if (b.startsWith("• ")) {
            return (
              <View key={i} style={s.item} wrap={false}>
                <Text style={s.marcador}>•</Text>
                <Text style={{ flex: 1, textAlign: "justify" }}>{b.slice(2)}</Text>
              </View>
            );
          }
          if (b.startsWith("» ")) {
            return (
              <View key={i} style={s.destaque} wrap={false}>
                <Text>{b.slice(2)}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={s.texto}>
              {b}
            </Text>
          );
        })}
        {d.aceite ? (
          <View style={s.aceite} wrap={false}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>Registro do aceite eletrônico</Text>
            <Text>
              {d.responsavel ?? "O responsável"} marcou &quot;Li e aceito&quot; a versão {d.aceite.versao} deste termo em {dataHora(d.aceite.em)}{" "}
              (horário de Cuiabá){d.aceite.ip ? `, a partir do endereço IP ${d.aceite.ip}` : ""}.
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: 14, color: "#6b7280" }}>Cópia para leitura: sem aceite eletrônico registrado.</Text>
        )}
        <Text style={s.rodape} render={({ pageNumber, totalPages }) => `${titulo} · versão ${d.versao} · página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export function renderTermosPdf(d: DadosTermosPdf) {
  return renderToBuffer(<TermosDoc d={d} />);
}
