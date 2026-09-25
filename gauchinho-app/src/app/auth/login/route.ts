import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/admin";
  return next.startsWith("/") && !next.startsWith("//") && !next.includes("\\")
    ? next
    : "/admin";
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const loginUrl = new URL("/login", request.url);

  if (!email || !password) {
    loginUrl.searchParams.set("error", "Informe o e-mail e a senha.");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, 303);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    loginUrl.searchParams.set("error", "E-mail ou senha inválidos.");
    loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, 303);
  }

  if (data.user.app_metadata?.exige_troca_senha === true) {
    const passwordUrl = new URL("/definir-senha", request.url);
    passwordUrl.searchParams.set("next", next);
    return NextResponse.redirect(passwordUrl, 303);
  }

  return NextResponse.redirect(new URL(next, request.url), 303);
}
