"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";

export async function loginIndicadorAction(formData: FormData) {
  const identificador = String(formData.get("identificador") ?? "").trim();
  const cpf = identificador.replace(/\D/g, "");
  const email = identificador.toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const loginPorEmail = email.includes("@");
  if ((!loginPorEmail && !/^\d{11}$/.test(cpf)) || !senha) redirect("/app-indicador/login?error=Informe%20CPF%20ou%20e-mail%20e%20senha");
  const tenant = await getResolvedTenant();
  const admin = createAdminClient();
  const { data: participante } = !loginPorEmail && tenant ? await admin
    .from("participantes_comerciais")
    .select("usuario_id")
    .eq("empresa_id", tenant.empresaId)
    .eq("cpf", cpf)
    .maybeSingle() : { data: null };
  const { data: usuario } = participante?.usuario_id ? await admin
    .from("usuarios")
    .select("email")
    .eq("id", participante.usuario_id)
    .maybeSingle() : { data: null };
  const db = await createClient();
  const loginEmail = loginPorEmail ? email : usuario?.email || `cpf-${cpf}@parceiro.gauchinho.local`;
  let { error } = await db.auth.signInWithPassword({ email: loginEmail, password: senha });

  // Cadastros antigos usavam um e-mail técnico no Auth. Mantemos este
  // fallback até que o indicador solicite a recuperação de senha, ocasião em
  // que sua conta é migrada para o e-mail de contato cadastrado.
  if (error && !loginPorEmail && usuario?.email) {
    ({ error } = await db.auth.signInWithPassword({
      email: `cpf-${cpf}@parceiro.gauchinho.local`,
      password: senha,
    }));
  }
  if (error) redirect(`/app-indicador/login?error=${encodeURIComponent("CPF/e-mail ou senha inválidos.")}`);
  redirect("/app-indicador");
}

export async function logoutIndicadorAction() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/app-indicador/login");
}
