import type { Metadata } from "next";
import { SimuladorApp, type SimuladorPrefill } from "@/components/simulador/simulador-app";
import { getSimuladorConfigsPublic } from "@/server/config";
import type { Modo } from "@/components/simulador/simulador-types";
import { parseTipoBemFromQuery } from "@/lib/simulador/tipos-credito";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canCreateProposta } from "@/lib/auth/permissions";

export const metadata: Metadata = {
  title: "Simulador de Consórcio e Financiamento Online",
  description: "Simule consórcio e financiamento para imóvel, carro, moto, caminhão e máquinas. Compare parcela, prazo, lance livre e lance embutido.",
  keywords: ["simulador de consórcio", "calcular parcela consórcio", "simulador lance embutido", "consórcio x financiamento"],
  alternates: { canonical: "/simulador" },
};

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
  const usuario = await getUsuarioNegocio();
  const isConsultor = canCreateProposta(usuario?.perfil);

  const valorRaw = sp.valor ? Number(sp.valor) : undefined;
  const prazoRaw = sp.prazo ? Number(sp.prazo) : undefined;
  const solucao = parseModo(sp.solucao);
  const tipoParsed = parseTipoBemFromQuery(sp.tipo);

  const prefill: SimuladorPrefill | undefined =
    sp.origem || sp.valor || sp.tipo || sp.solucao || sp.prazo
      ? {
          origem: sp.origem,
          imovelId: sp.imovel_id,
          valor: valorRaw != null && Number.isFinite(valorRaw) ? valorRaw : undefined,
          prazo: prazoRaw != null && Number.isFinite(prazoRaw) ? prazoRaw : undefined,
          solucao,
          tipo: tipoParsed,
        }
      : undefined;

  return <SimuladorApp configs={configs} prefill={prefill} isConsultor={isConsultor} />;
}
