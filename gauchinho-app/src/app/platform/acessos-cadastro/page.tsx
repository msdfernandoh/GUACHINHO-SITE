import { redirect } from "next/navigation";
import { isPlatformSuperadmin } from "@/lib/auth/is-superadmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcessoCadastroClient } from "./client";

export default async function AcessosCadastroPage() {
  if (!(await isPlatformSuperadmin())) redirect("/platform/revisao");
  const admin = createAdminClient({ noStore: true });
  const { data, error } = await admin.from("plataforma_revisores_tecnicos").select("usuario_id,ativo,expira_em,criado_em,usuarios!inner(nome,email)").order("criado_em", { ascending: false });
  if (error) throw new Error("Não foi possível carregar os acessos de revisão.");
  const revisores = (data ?? []).map((item) => ({ ...item, nome: (item.usuarios as unknown as { nome: string }).nome, email: (item.usuarios as unknown as { email: string }).email }));
  return <AcessoCadastroClient revisores={revisores} />;
}
