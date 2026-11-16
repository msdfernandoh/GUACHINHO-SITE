import { NextResponse } from "next/server";
import { authorizePublicIngress } from "@/lib/security/public-ingress";
import {
  adicionarClienteEvento,
  finalizarCheckinSpl,
  iniciarCorretor,
  salvarDadosImobiliaria,
} from "@/lib/spl/evento-checkin";

/** Check-in SPL do evento: corretor → (dados da imobiliária) → clientes → desafio e pesquisa (sem NPS). */
export async function POST(request: Request) {
  const ingress = await authorizePublicIngress(request, "spl_evento_checkin", { limit: 60, windowSeconds: 60 });
  if (!ingress.ok) return ingress.response;
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const acao = String(body.acao ?? "");
    const r =
      acao === "iniciar"
        ? await iniciarCorretor(body)
        : acao === "imobiliaria"
          ? await salvarDadosImobiliaria(body)
          : acao === "cliente"
            ? await adicionarClienteEvento(body, request.headers.get("host"))
            : acao === "finalizar"
              ? await finalizarCheckinSpl(body)
              : { ok: false as const, error: "Ação inválida." };
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, data: r.data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Não foi possível concluir agora." }, { status: 400 });
  }
}
