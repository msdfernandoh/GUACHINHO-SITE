import { fetchPublicGruposRows } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isStaff } from "@/lib/auth/permissions";

export default async function GruposPublicPage() {
  const rows = await fetchPublicGruposRows();
  const usuario = await getUsuarioNegocio();
  const staff = isStaff(usuario?.perfil);
  return <GruposPublicClient rows={rows} isStaff={staff} />;
}
