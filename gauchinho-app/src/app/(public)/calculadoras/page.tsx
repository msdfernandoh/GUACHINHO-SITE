import { CalculadorasPage } from "@/components/public/calculadoras/calculadoras-page";
import { parseCalcId } from "@/lib/calculadoras/meta";
import { getCalculadorasConfigPublic } from "@/server/config";

export default async function CalculadorasPublicPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const config = await getCalculadorasConfigPublic();
  const initialCalc = parseCalcId(sp.calc);

  return <CalculadorasPage config={config} initialCalc={initialCalc} />;
}
