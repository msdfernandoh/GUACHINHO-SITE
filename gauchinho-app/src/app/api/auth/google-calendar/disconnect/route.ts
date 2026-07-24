import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const usuario = await getUsuarioNegocio();
  if (!usuario || !canManageLeads(usuario.perfil)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const admin = createAdminClient();
  await admin
    .from("usuarios")
    .update({
      google_calendar_refresh_token: null,
      google_calendar_connected_at: null,
    })
    .eq("id", usuario.id);

  return NextResponse.redirect(new URL("/admin/agenda?google=disconnected", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
