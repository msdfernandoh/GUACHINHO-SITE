import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getGoogleRefreshToken(usuarioId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuario_google_calendar_secrets")
    .select("refresh_token")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) {
    if (/usuario_google_calendar_secrets|schema cache|does not exist/i.test(error.message)) {
      return legacyRefreshFromUsuarios(usuarioId);
    }
    throw new Error(error.message);
  }
  const token = data?.refresh_token as string | undefined;
  return token?.trim() ? token : null;
}

/** Fallback se migration 035 ainda não aplicada. */
async function legacyRefreshFromUsuarios(usuarioId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("usuarios")
    .select("google_calendar_refresh_token")
    .eq("id", usuarioId)
    .maybeSingle();
  if (error) return null;
  const token = (data as { google_calendar_refresh_token?: string | null })?.google_calendar_refresh_token;
  return token?.trim() ? token : null;
}

export async function saveGoogleRefreshToken(usuarioId: string, refreshToken: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("usuario_google_calendar_secrets").upsert(
    {
      usuario_id: usuarioId,
      refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "usuario_id" },
  );
  if (error && /usuario_google_calendar_secrets|schema cache|does not exist/i.test(error.message)) {
    const { error: legacyErr } = await admin
      .from("usuarios")
      .update({ google_calendar_refresh_token: refreshToken })
      .eq("id", usuarioId);
    if (legacyErr) throw new Error(legacyErr.message);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function clearGoogleRefreshToken(usuarioId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("usuario_google_calendar_secrets").delete().eq("usuario_id", usuarioId);
  const { error } = await admin
    .from("usuarios")
    .update({
      google_calendar_connected_at: null,
      google_calendar_email: null,
    })
    .eq("id", usuarioId);
  if (error && !/google_calendar_email|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function markGoogleConnected(
  usuarioId: string,
  googleEmail: string | null,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("usuarios")
    .update({
      google_calendar_connected_at: new Date().toISOString(),
      google_calendar_email: googleEmail,
    })
    .eq("id", usuarioId);
  if (error) throw new Error(error.message);
}
