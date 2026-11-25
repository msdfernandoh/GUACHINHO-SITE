import { renderToBuffer } from "@react-pdf/renderer";
import { carregarExtratoCliente } from "@/app/erp/extrato-clientes/actions";
import { ExtratoClientePdf, type ExtratoPdfDados } from "@/lib/erp/extrato-cliente-pdf";

export const runtime = "nodejs";

function nomeArquivo(nome: string, mes: string) {
  const base = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `extrato-${base || "cliente"}-${mes}.pdf`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const dados = await carregarExtratoCliente(id, url.searchParams.get("historico") ?? "12", url.searchParams.get("mes") ?? "");
  const pdf = await renderToBuffer(<ExtratoClientePdf d={dados as unknown as ExtratoPdfDados} />);
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Cache-Control": "private, no-store",
    "Content-Disposition": `${url.searchParams.get("baixar") === "1" ? "attachment" : "inline"}; filename="${nomeArquivo(dados.cliente.nome, dados.mes)}"`,
  } });
}
