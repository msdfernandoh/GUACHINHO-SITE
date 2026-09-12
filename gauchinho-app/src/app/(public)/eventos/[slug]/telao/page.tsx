import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchEventoTelaoData } from "./telao-actions";
import { SorteioTelaoClient } from "@/components/public/eventos/sorteio-telao-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sorteio ao Vivo — Telão de Palco",
  robots: { index: false, follow: false },
};

export default async function EventoSorteioTelaoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await fetchEventoTelaoData(slug);
  if (!data) notFound();

  return <SorteioTelaoClient data={data} />;
}
