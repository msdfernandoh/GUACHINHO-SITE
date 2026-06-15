import { SimuladorApp } from "@/components/simulador/simulador-app";
import { getSimuladorConfigsPublic } from "@/server/config";

export default async function SimuladorPage() {
  const configs = await getSimuladorConfigsPublic();
  return <SimuladorApp configs={configs} />;
}
