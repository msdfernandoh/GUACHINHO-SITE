import { fetchPublicGruposAggregates } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta, canManageGruposSorteios, isStaff } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { createClient } from "@/lib/supabase/server";

export default async function GruposPublicPage() {
  const aggregates = await fetchPublicGruposAggregates();
  const usuario = await getUsuarioNegocio();
  const staff = isStaff(usuario?.perfil);
  const isConsultor = canCreateProposta(usuario?.perfil);
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  const canManageSorteios = canManageGruposSorteios(
    usuario?.perfil,
    leadsConfig.srdPodeEditarGrupos,
  );

  const supabase = await createClient();
  const { data: gruposSorteio } = await supabase
    .from("grupos_consorcio")
    .select("id, codigo_grupo, modalidade, quantidade_cotas_sorteio")
    .eq("ativo", true)
    .order("codigo_grupo");

  return (
    <GruposPublicClient
      aggregates={aggregates}
      isStaff={staff}
      isConsultor={isConsultor}
      gruposSorteio={gruposSorteio ?? []}
      canManageSorteios={canManageSorteios}
    />
  );
}
