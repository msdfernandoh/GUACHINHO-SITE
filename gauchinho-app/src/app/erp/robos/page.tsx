import { fetchFranquiaRobosAction } from "./actions";
import { ErpRobosHub } from "@/components/erp/robos/erp-robos-hub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ErpRobosPage() {
  const data = await fetchFranquiaRobosAction();

  return (
    <ErpRobosHub
      empresaId={data.empresaId}
      empresaNome={data.empresaNome}
      initialRobos={data.robos}
      initialStats={data.stats}
      initialHistorico={data.historico}
    />
  );
}
