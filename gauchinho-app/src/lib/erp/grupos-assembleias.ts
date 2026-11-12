import "server-only";

import { createClient } from "@/lib/supabase/server";
import { listGruposAutorizadosForEmpresa } from "@/lib/grupos/catalogo-autorizado-service";

export async function listarGruposParaAssembleias(
  supabase: Awaited<ReturnType<typeof createClient>>,
  empresaId: string,
) {
  const [catalogo, concedidos] = await Promise.all([
    listGruposAutorizadosForEmpresa(empresaId),
    listGruposAutorizadosForEmpresa(empresaId, { incluirInativos: true }),
  ]);

  const idsCarteira = new Set<string>();
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await supabase
      .from("cotas_definitivas")
      .select("grupo_id")
      .eq("empresa_id", empresaId)
      .neq("status", "cancelada")
      .order("id")
      .range(inicio, inicio + 499);
    if (error) throw new Error(error.message);
    for (const cota of data ?? []) {
      if (cota.grupo_id) idsCarteira.add(cota.grupo_id);
    }
    if ((data?.length ?? 0) < 500) break;
  }

  const grupos = new Map(catalogo.map((grupo) => [grupo.id, grupo]));
  for (const grupo of concedidos) {
    if (idsCarteira.has(grupo.id) && !grupos.has(grupo.id)) grupos.set(grupo.id, grupo);
  }
  return [...grupos.values()];
}
