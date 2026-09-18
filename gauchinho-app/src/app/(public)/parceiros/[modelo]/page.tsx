import { notFound } from "next/navigation";
import { MODELOS_PROGRAMA_PARCEIROS } from "@/lib/parceiros/modelos-programa";
import { ModeloParceiroLandingClient } from "@/components/public/modelo-parceiro-landing-client";

export default async function ModeloParceiroPage({ params }: { params: Promise<{ modelo: string }> }) {
  const { modelo } = await params;
  const item = MODELOS_PROGRAMA_PARCEIROS.find((candidate) => candidate.slug === modelo);
  if (!item) notFound();
  return <ModeloParceiroLandingClient modelo={item} />;
}
