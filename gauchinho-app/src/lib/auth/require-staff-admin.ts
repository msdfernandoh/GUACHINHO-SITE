import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isImobiliaria } from "@/lib/auth/permissions";

/** Bloqueia imobiliária nas telas operacionais do Gauchinho */
export async function requireStaffAdmin() {
  const u = await getUsuarioNegocio();
  if (!u) redirect("/login?next=/admin");
  if (isImobiliaria(u.perfil)) redirect("/admin/minha-imobiliaria");
  return u;
}
