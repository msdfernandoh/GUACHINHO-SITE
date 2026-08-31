import { NextResponse } from "next/server";
import { requireTenantPermission } from "@/lib/tenant/context";
import { clearGoogleRefreshToken } from "@/lib/google-calendar/token-store";

export async function POST() {
  const { usuario } = await requireTenantPermission("acessar_agenda");

  await clearGoogleRefreshToken(usuario.id);

  return NextResponse.redirect(new URL("/admin/agenda?google=disconnected", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
}
