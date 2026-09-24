"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { resolveIndicadorAppSession } from "@/lib/parceiros/indicador-app-session";

export async function loginIndicadorAction(formData: FormData) {
  const identificador = String(formData.get("identificador") ?? "").trim();
  const cpf = identificador.replace(/\D/g, "");
  const email = identificador.toLowerCase();
  const senha = String(formData.get("senha") ?? "");
  const loginPorEmail = email.includes("@");
  if ((!loginPorEmail && !/^\d{11}$/.test(cpf)) || !senha) redirect("/app-indicador/login?error=Informe%20CPF%20ou%20e-mail%20e%20senha");
  const invalidCredentials = "/app-indicador/login?error=CPF%2Fe-mail%20ou%20senha%20inv%C3%A1lidos.";
  const tenant = await getResolvedTenant();
  if (!tenant) redirect(invalidCredentials);
  const admin = createAdminClient({ noStore: true });
  const { data: usuarioPorEmail } = loginPorEmail
    ? await admin.from("usuarios").select("id,auth_user_id,ativo").ilike("email", email).maybeSingle()
    : { data: null };
  const { data: participantePorCpf } = !loginPorEmail
    ? await admin.from("participantes_comerciais")
        .select("usuario_id")
        .eq("empresa_id", tenant.empresaId)
        .eq("cpf", cpf)
        .maybeSingle()
    : { data: null };
  const usuarioId = loginPorEmail ? usuarioPorEmail?.id : participantePorCpf?.usuario_id;
  if (!usuarioId || (loginPorEmail && !usuarioPorEmail?.ativo)) redirect(invalidCredentials);

  const [{ data: vinculo }, { data: participantes }] = await Promise.all([
    admin.from("empresa_usuarios").select("id").eq("empresa_id", tenant.empresaId)
      .eq("usuario_id", usuarioId).eq("ativo", true).limit(1),
    admin.from("participantes_comerciais").select("id,status")
      .eq("empresa_id", tenant.empresaId).eq("usuario_id", usuarioId),
  ]);
  const ativos = (participantes ?? []).filter((item) => (item.status ?? "ATIVO").toUpperCase() === "ATIVO");
  if (!vinculo?.length || !ativos.length) redirect(invalidCredentials);
  const { data: usuario } = await admin.from("usuarios")
    .select("auth_user_id,ativo")
    .eq("id", usuarioId).maybeSingle();
  if (!usuario?.ativo || !usuario.auth_user_id) redirect(invalidCredentials);
  const { data: authRecord } = await admin.auth.admin.getUserById(usuario.auth_user_id);
  if (!authRecord.user?.email) redirect(invalidCredentials);
  const db = await createClient();
  const { data: sessao, error } = await db.auth.signInWithPassword({
    email: authRecord.user.email,
    password: senha,
  });
  if (error || sessao.user?.id !== usuario.auth_user_id) redirect(invalidCredentials);
  const { indicador } = await resolveIndicadorAppSession(tenant.empresaId, usuarioId);
  if (!indicador) {
    await db.auth.signOut();
    redirect("/app-indicador/login?error=Seu%20acesso%20ao%20programa%20de%20indica%C3%A7%C3%B5es%20n%C3%A3o%20est%C3%A1%20ativo.");
  }
  redirect("/app-indicador");
}

export async function logoutIndicadorAction() {
  const db = await createClient();
  await db.auth.signOut();
  redirect("/app-indicador/login");
}
