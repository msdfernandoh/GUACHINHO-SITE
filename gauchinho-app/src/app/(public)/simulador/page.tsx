import { SimuladorApp, type SimuladorPrefill } from "@/components/simulador/simulador-app";
import { getSimuladorConfigsPublic } from "@/server/config";
import type { Modo, TipoBem } from "@/components/simulador/simulador-types";

function parseModo(raw: string | undefined): Modo | undefined {
  if (raw === "financiamento") return "financiamento";
  if (raw === "consorcio") return "consorcio";
  return undefined;
}

export default async function SimuladorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const configs = await getSimuladorConfigsPublic();

  const valorRaw = sp.valor ? Number(sp.valor) : undefined;
  const prazoRaw = sp.prazo ? Number(sp.prazo) : undefined;
  const solucao = parseModo(sp.solucao);

  const prefill: SimuladorPrefill | undefined =
    sp.origem || sp.valor || sp.tipo || sp.solucao || sp.prazo
      ? {
          origem: sp.origem,
          imovelId: sp.imovel_id,
          valor: valorRaw != null && Number.isFinite(valorRaw) ? valorRaw : undefined,
          prazo: prazoRaw != null && Number.isFinite(prazoRaw) ? prazoRaw : undefined,
          solucao,
          tipo: (sp.tipo === "imovel" || sp.tipo === "automovel" ? sp.tipo : undefined) as
            | TipoBem
            | undefined,
        }
      : undefined;

  return <SimuladorApp configs={configs} prefill={prefill} />;
}
