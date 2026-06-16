import { SimuladorApp, type SimuladorPrefill } from "@/components/simulador/simulador-app";
import { getSimuladorConfigsPublic } from "@/server/config";
import type { TipoBem } from "@/components/simulador/simulador-types";

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const configs = await getSimuladorConfigsPublic();

  const valorRaw = sp.valor ? Number(sp.valor) : undefined;
  const prefill: SimuladorPrefill | undefined =
    sp.origem || sp.valor || sp.tipo
      ? {
          origem: sp.origem,
          imovelId: sp.imovel_id,
          valor: valorRaw != null && Number.isFinite(valorRaw) ? valorRaw : undefined,
          tipo: (sp.tipo === "imovel" || sp.tipo === "automovel" ? sp.tipo : undefined) as
            | TipoBem
            | undefined,
        }
      : undefined;

  return <SimuladorApp configs={configs} prefill={prefill} />;
}
