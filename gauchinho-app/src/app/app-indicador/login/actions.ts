"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function loginIndicadorAction(formData: FormData) {
  const cpf = String(formData.get("cpf") ?? "").replace(/\D/g, "");
  const senha = String(formData.get("senha") ?? "");
  if (!/^\d{11}$/.test(cpf) || !senha) redirect("/app-indicador/login?error=Informe%20CPF%20e%20senha");
  const db = await createClient();
  const { error } = await db.auth.signInWithPassword({ email: `cpf-${cpf}@parceiro.gauchinho.local`, password: senha });
  if (error) redirect(`/app-indicador/login?error=${encodeURIComponent("CPF ou senha inválidos.")}`);
  redirect("/app-indicador");
}
