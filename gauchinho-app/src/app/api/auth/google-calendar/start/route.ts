import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireTenantPermission } from "@/lib/tenant/context";
import { buildGoogleCalendarAuthUrl } from "@/lib/google-calendar/client";
import { isGmailAddress, isGoogleCalendarConfigured } from "@/lib/google-calendar/config";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const { usuario, empresaAtiva } = await requireTenantPermission("acessar_agenda");

  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(new URL("/admin/agenda?google=not_configured", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  if (!isGmailAddress(usuario.email)) {
    return NextResponse.redirect(new URL("/admin/agenda?google=not_gmail", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("empresa_usuarios")
    .select("google_agenda_sync")
    .eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuario.id).eq("ativo", true)
    .maybeSingle();

  if (!row?.google_agenda_sync) {
    return NextResponse.redirect(new URL("/admin/agenda?google=disabled", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"));
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set("google_calendar_oauth_empresa", empresaAtiva.id, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
  });
  cookieStore.set("google_calendar_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  cookieStore.set("google_calendar_oauth_uid", usuario.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = buildGoogleCalendarAuthUrl(state);
  return NextResponse.redirect(url);
}
