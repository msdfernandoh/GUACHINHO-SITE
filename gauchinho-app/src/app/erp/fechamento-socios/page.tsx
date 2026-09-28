import { carregarPainelFechamento } from "./actions";
import { PainelFechamentoSocios } from "./painel";

export const dynamic = "force-dynamic";

export default async function FechamentoSociosPage({ searchParams }: { searchParams?: Promise<{ aba?: string }> }) {
  const dados = await carregarPainelFechamento();
  const params = await searchParams;
  return <main className="mx-auto max-w-7xl p-4 md:p-7"><PainelFechamentoSocios dados={dados} abaInicial={params?.aba === "vendas" ? "vendas" : "despesas"} /></main>;
}
