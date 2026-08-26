import { NextResponse } from "next/server";
import { resolveOperationalTenantForApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createAdminClient } from "@/lib/supabase/admin";
import { listarConsultores } from "@/lib/admin/consultores";

/** Lista pública de consultores (id + nome) para formulários de atribuição. */
export async function GET(request: Request) {
  const tenant = await resolveOperationalTenantForApi(request);
  if (!tenant.ok) return tenant.response;
  try {
    const admin = createAdminClient();
    const list = await listarConsultores(admin, {
      preferirMarcados: true,
      empresaId: tenant.empresaId,
    });
    return NextResponse.json({
      ok: true,
      consultores: list.map((c) => ({ id: c.id, nome: c.nome })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao listar consultores";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
