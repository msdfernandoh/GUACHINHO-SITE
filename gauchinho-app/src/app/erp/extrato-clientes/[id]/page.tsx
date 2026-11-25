import Link from "next/link";
import { carregarExtratoCliente } from "../actions";
import { ExtratoClienteDetalhe } from "./ui";

export default async function Detalhe({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ historico?: string; mes?: string }>;
}) {
  const [{ id }, filtros] = await Promise.all([params, searchParams]);
  const dados = await carregarExtratoCliente(id, filtros.historico, filtros.mes);
  return <main className="mx-auto max-w-6xl space-y-5 p-4"><Link href="/erp/extrato-clientes" className="font-bold text-blue-800">← Voltar aos extratos</Link><ExtratoClienteDetalhe dados={dados} /></main>;
}
