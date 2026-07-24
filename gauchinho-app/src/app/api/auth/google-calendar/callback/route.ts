import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { exchangeGoogleAuthCode } from "@/lib/google-calendar/client";
import { isGoogleCalendarConfigured } from "@/lib/google-calendar/config";

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

  cookieStore.delete("google_calendar_oauth_state");
  cookieStore.delete("google_calendar_oauth_uid");

  if (!code || !state || !expectedState || state !== expectedState || !usuarioId) {
    return NextResponse.redirect(`${redirectBase}?google=invalid_state`);
  }

  try {
    const { refreshToken } = await exchangeGoogleAuthCode(code);
    const admin = createAdminClient();
    const { error: updErr } = await admin
      .from("usuarios")
      .update({
        google_calendar_refresh_token: refreshToken,
        google_calendar_connected_at: new Date().toISOString(),
      })
      .eq("id", usuarioId);
    if (updErr) throw new Error(updErr.message);
    return NextResponse.redirect(`${redirectBase}?google=connected`);
  } catch {
    return NextResponse.redirect(`${redirectBase}?google=error`);
  }
}
