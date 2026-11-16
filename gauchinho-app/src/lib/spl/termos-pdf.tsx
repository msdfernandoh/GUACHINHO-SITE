import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: "#1f2937", lineHeight: 1.45 },
  topo: { borderBottomWidth: 2, borderBottomColor: "#F59E0B", paddingBottom: 8, marginBottom: 14 },
  marca: { fontSize: 9, color: "#153E90", fontWeight: "bold" },
  titulo: { fontSize: 16, fontWeight: "bold", color: "#0A1931", marginTop: 4 },
  sub: { fontSize: 9, color: "#6b7280", marginTop: 2 },
  bloco: { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 4, padding: 10, marginBottom: 14 },
  linha: { flexDirection: "row", marginBottom: 2 },
  rotulo: { width: 120, color: "#6b7280" },
  valor: { flex: 1, fontWeight: "bold" },
  texto: { marginBottom: 6, textAlign: "justify" },
  aceite: { marginTop: 16, borderWidth: 1, borderColor: "#16a34a", backgroundColor: "#f0fdf4", borderRadius: 4, padding: 10 },
  rodape: { position: "absolute", bottom: 20, left: 40, right: 40, fontSize: 8, color: "#9ca3af", textAlign: "center" },
});

export type DadosTermosPdf = {
  versao: string;
  texto: string;
  imobiliaria?: {
    nome: string;
    cnpj: string | null;
    responsavel: string;
    telefone: string;
    email: string;
    modelo: string;
  } | null;
  aceite?: { em: string; versao: string; ip: string | null } | null;
};

const cnpjFmt = (c: string | null) =>
  c && c.length === 14 ? `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}` : "não informado";

function TermosDoc({ d }: { d: DadosTermosPdf }) {
  const paragrafos = d.texto.split(/\n{2,}|\r\n\r\n/).map((p) => p.trim()).filter(Boolean);
  const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" });
  return (
    <Document title={`Termo de parceria SPL · versão ${d.versao}`}>
      <Page size="A4" style={s.page}>
        <View style={s.topo}>
          <Text style={s.marca}>SPL ENGENHARIA × RACON CONSÓRCIOS · FRANQUEADO GAUCHINHO</Text>
          <Text style={s.titulo}>Termo de parceria · imobiliárias</Text>
          <Text style={s.sub}>Versão {d.versao}</Text>
        </View>
        {d.imobiliaria ? (
          <View style={s.bloco}>
            {(
              [
                ["Imobiliária", d.imobiliaria.nome],
                ["CNPJ", cnpjFmt(d.imobiliaria.cnpj)],
                ["Responsável", d.imobiliaria.responsavel],
                ["Contato", `${d.imobiliaria.telefone} · ${d.imobiliaria.email}`],
                ["Modelo", d.imobiliaria.modelo],
              ] as [string, string][]
            ).map(([k, v]) => (
              <View key={k} style={s.linha}>
                <Text style={s.rotulo}>{k}</Text>
                <Text style={s.valor}>{v}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {paragrafos.map((p, i) => (
          <Text key={i} style={s.texto}>
            {p}
          </Text>
        ))}
        {d.aceite ? (
          <View style={s.aceite} wrap={false}>
            <Text style={{ fontWeight: "bold" }}>Aceite eletrônico registrado</Text>
            <Text>
              {d.imobiliaria?.responsavel ?? "O responsável"} marcou &quot;Li e aceito&quot; a versão {d.aceite.versao} deste termo em{" "}
              {dataHora(d.aceite.em)} (horário de Cuiabá){d.aceite.ip ? `, a partir do endereço IP ${d.aceite.ip}` : ""}.
            </Text>
          </View>
        ) : (
          <Text style={{ marginTop: 16, color: "#6b7280" }}>Documento sem aceite registrado (cópia para leitura).</Text>
        )}
        <Text style={s.rodape} render={({ pageNumber, totalPages }) => `Termo de parceria SPL · versão ${d.versao} · página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}

export function renderTermosPdf(d: DadosTermosPdf) {
  return renderToBuffer(<TermosDoc d={d} />);
}
