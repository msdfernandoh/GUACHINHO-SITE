import type { Metadata } from "next";
import { CalculadorasPage } from "@/components/public/calculadoras/calculadoras-page";
import { parseCalcId } from "@/lib/calculadoras/meta";
import { getIndicesPublicos } from "@/lib/indices-financeiros";
import { getCalculadorasConfigPublic } from "@/server/config";

export const metadata: Metadata = {
  title: "Calculadoras Financeiras Online Gratuitas",
  description:
    "Use calculadoras financeiras para comparar crédito, parcelas, aplicações e cenários de planejamento antes de tomar uma decisão.",
  keywords: [
    "calculadora financeira online",
    "calculadora de parcelas",
    "comparador financeiro",
    "simulador de aplicação mensal",
  ],
  alternates: { canonical: "/calculadoras" },
};

export default async function CalculadorasPublicPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const [config, { indices }] = await Promise.all([
    getCalculadorasConfigPublic(),
    getIndicesPublicos({ tentarAtualizarAutomaticos: false }),
  ]);
  const initialCalc =
    parseCalcId(sp.calc) ??
    (sp.tipo === "aplicacao" ? ("aplicacao_mensal" as const) : undefined);
  const aporteRaw = sp.aporte ? Number(String(sp.aporte).replace(",", ".")) : NaN;
  const prazoRaw = sp.prazo ? parseInt(String(sp.prazo), 10) : NaN;
  const aplicacaoPrefill =
    Number.isFinite(aporteRaw) && aporteRaw > 0 && Number.isFinite(prazoRaw) && prazoRaw > 0
      ? { aporte: aporteRaw, prazoMeses: prazoRaw }
      : undefined;

  return (
    <CalculadorasPage
      config={config}
      initialCalc={initialCalc}
      indices={indices}
      aplicacaoPrefill={aplicacaoPrefill}
    />
  );
}
