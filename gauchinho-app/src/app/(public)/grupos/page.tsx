import { fetchPublicGruposAggregates } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { isStaff } from "@/lib/auth/permissions";

export default async function GruposPublicPage() {
  const aggregates = await fetchPublicGruposAggregates();
  const usuario = await getUsuarioNegocio();
  const staff = isStaff(usuario?.perfil);
  return <GruposPublicClient aggregates={aggregates} isStaff={staff} />;
}
