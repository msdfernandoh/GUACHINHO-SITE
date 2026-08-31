import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import {
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
} from "@/lib/google-calendar/client";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";
import {
  markGoogleConnected,
  saveGoogleRefreshToken,
} from "@/lib/google-calendar/token-store";
import { shouldBindGoogleOAuthToken } from "@/lib/google-calendar/oauth-guards";
import { requireTenantPermission } from "@/lib/tenant/context";
import { createClient } from "@/lib/supabase/server";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(request: Request) {
  const redirectBase = `${siteUrl()}/admin/agenda`;
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(`${redirectBase}?google=not_configured`);
  }

  const sp = new URL(request.url).searchParams;
  const code = sp.get("code");
  const state = sp.get("state");
  const error = sp.get("error");

  if (error) {
    return NextResponse.redirect(`${redirectBase}?google=denied`);
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get("google_calendar_oauth_state")?.value;
  const usuarioId = cookieStore.get("google_calendar_oauth_uid")?.value;
  const empresaId = cookieStore.get("google_calendar_oauth_empresa")?.value;

  cookieStore.delete("google_calendar_oauth_state");
  cookieStore.delete("google_calendar_oauth_uid");
  cookieStore.delete("google_calendar_oauth_empresa");

  if (!code || !state || !expectedState || state !== expectedState || !usuarioId) {
    return NextResponse.redirect(`${redirectBase}?google=invalid_state`);
  }

  const sessionUser = await getUsuarioNegocio();
  if (!shouldBindGoogleOAuthToken(usuarioId, sessionUser)) {
    return NextResponse.redirect(`${redirectBase}?google=session_mismatch`);
  }

  try {
    const { empresaAtiva } = await requireTenantPermission("acessar_agenda");
    if (empresaId !== empresaAtiva.id) return NextResponse.redirect(`${redirectBase}?google=session_mismatch`);
    const supabase = await createClient();
    const { data: link } = await supabase.from("empresa_usuarios").select("google_agenda_sync")
      .eq("empresa_id", empresaAtiva.id).eq("usuario_id", usuarioId).eq("ativo", true).maybeSingle();
    if (!link?.google_agenda_sync) return NextResponse.redirect(`${redirectBase}?google=disabled`);
    const { refreshToken, accessToken } = await exchangeGoogleAuthCode(code);
    const googleEmail = await fetchGoogleAccountEmail(accessToken);
    if (!googleEmail) return NextResponse.redirect(`${redirectBase}?google=error`);
    await saveGoogleRefreshToken(usuarioId, refreshToken);
    await markGoogleConnected(usuarioId, googleEmail);
    return NextResponse.redirect(`${redirectBase}?google=connected`);
  } catch {
    return NextResponse.redirect(`${redirectBase}?google=error`);
  }
}
