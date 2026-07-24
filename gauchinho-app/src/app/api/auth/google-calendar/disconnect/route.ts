import { NextResponse } from "next/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { clearGoogleRefreshToken } from "@/lib/google-calendar/token-store";

export async function POST() {
  const usuario = await getUsuarioNegocio();
  if (!usuario || !canManageLeads(usuario.perfil)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  await clearGoogleRefreshToken(usuario.id);

  return NextResponse.redirect(new URL("/admin/agenda?google=disconnected", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
