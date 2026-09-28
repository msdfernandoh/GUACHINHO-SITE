import { carregarPainelFechamento } from "./actions";
import { PainelFechamentoSocios } from "./painel";

export const dynamic = "force-dynamic";

export default async function FechamentoSociosPage() {
  const dados = await carregarPainelFechamento();
  return <main className="mx-auto max-w-7xl p-4 md:p-7"><PainelFechamentoSocios dados={dados} /></main>;
}
