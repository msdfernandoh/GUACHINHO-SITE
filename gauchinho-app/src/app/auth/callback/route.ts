import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/definir-senha";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next.startsWith("/") && !next.startsWith("//") ? next : "/definir-senha";
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("code");

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
    console.error("[auth/callback] Erro ao verificar OTP:", error.message);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
    console.error("[auth/callback] Erro exchangeCodeForSession:", error.message);
  }

  const loginRedirect = request.nextUrl.clone();
  loginRedirect.pathname = "/login";
  loginRedirect.search = "";
  loginRedirect.searchParams.set(
    "error",
    "Link de autenticação inválido ou expirado. Por favor, tente novamente.",
  );
  return NextResponse.redirect(loginRedirect);
}
