import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import { validarCadastroCliente } from "@/lib/spl/validacao";
import { cadastrarCliente, imobiliariaPorToken } from "@/lib/spl/repo";

/** Importa até 300 clientes da carteira de uma vez (linhas já lidas no navegador). */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_planilha", { limit: 5, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const body = (await request.json().catch(() => ({}))) as { token?: string; linhas?: Record<string, unknown>[] };
    const imob = await imobiliariaPorToken(ingress.empresaId, String(body.token ?? ""));
    if (!imob) return NextResponse.json({ error: "Painel inválido." }, { status: 404 });
    const linhas = Array.isArray(body.linhas) ? body.linhas.slice(0, 300) : [];
    if (!linhas.length) return NextResponse.json({ error: "Nenhuma linha para importar." }, { status: 400 });
    let incluidos = 0;
    const erros: { linha: number; erro: string }[] = [];
    for (const [i, raw] of linhas.entries()) {
      const parsed = validarCadastroCliente(raw);
      if (!parsed.ok) {
        erros.push({ linha: i + 2, erro: parsed.error });
        continue;
      }
      try {
        await cadastrarCliente({ imob, vendedor: null, input: parsed.data, origem: "PLANILHA", host: request.headers.get("host") });
        incluidos++;
      } catch (e) {
        erros.push({ linha: i + 2, erro: e instanceof Error ? e.message : "Erro" });
      }
    }
    return NextResponse.json({ ok: true, incluidos, erros });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível importar." }, { status: 400 });
  }
}
