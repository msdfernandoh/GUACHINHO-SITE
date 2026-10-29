import { NextResponse } from "next/server";
import { resolveOperationalTenantForApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarConsultores } from "@/lib/admin/consultores";
import { getCurrentTenantContext } from "@/lib/tenant/context";

/** Lista interna: acesso autenticado e autorizado na empresa do domínio. */
export async function GET(request: Request) {
  const tenant = await resolveOperationalTenantForApi(request);
  if (!tenant.ok) return tenant.response;
  const context = await getCurrentTenantContext();
  if (!context.usuario) return NextResponse.json({ error: "Entre para consultar responsáveis." }, { status: 401 });
  if (context.empresaAtiva?.id !== tenant.empresaId || !context.permissoes.has("gerenciar_propostas")) {
    return NextResponse.json({ error: "Sem permissão nesta empresa." }, { status: 403 });
  }
  try {
    const admin = createAdminClient();
    const list = await listarConsultores(admin, {
      preferirMarcados: true,
      empresaId: tenant.empresaId,
    });
    return NextResponse.json({
      ok: true,
      consultores: list.map((c) => ({ id: c.id, nome: c.nome })),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar consultores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
