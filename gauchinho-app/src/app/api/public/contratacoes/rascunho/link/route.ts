import { NextResponse } from "next/server";
import { validarContratacaoDraftLink } from "@/lib/contratacoes-online/draft-link";
import { resolveOperationalTenantForApi } from "@/lib/tenant/assert-legacy-operational-api";

export async function POST(request: Request) {
  const tenant = await resolveOperationalTenantForApi(request);
  if (!tenant.ok) return tenant.response;
  try {
    const body = (await request.json()) as { d?: unknown; s?: unknown };
    const draft = validarContratacaoDraftLink(body.d, body.s);
    if (draft.empresa_id && draft.empresa_id !== tenant.empresaId) {
      return NextResponse.json({ error: "Link pertence a outra empresa." }, { status: 404 });
    }
    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Link de simulação inválido." },
      { status: 400 },
    );
  }
}
