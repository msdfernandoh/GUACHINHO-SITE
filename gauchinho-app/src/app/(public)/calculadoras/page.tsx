import { CalculadorasPage } from "@/components/public/calculadoras/calculadoras-page";
import { parseCalcId } from "@/lib/calculadoras/meta";
import { getIndicesPublicos } from "@/lib/indices-financeiros";
import { getCalculadorasConfigPublic } from "@/server/config";

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
  const initialCalc = parseCalcId(sp.calc);
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
