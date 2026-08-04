import { fetchPublicCartas } from "@/app/admin/cartas-contempladas/actions";
import { CartasPublicClient } from "@/components/public/cartas-public-client";
import type { CartaContemplada } from "@/lib/cartas/types";

export const metadata: Metadata = {
  title: "Cartas de Crédito Contempladas Disponíveis",
  description: "Consulte cartas contempladas para imóvel e veículo, com crédito disponível e condições informadas para análise antes da contratação.",
  keywords: ["carta contemplada", "carta de crédito contemplada", "consórcio contemplado imóvel", "cota contemplada veículo"],
  alternates: { canonical: "/cartas-contempladas" },
};

export default async function CartasContempladasPublicPage() {
  const cartas = (await fetchPublicCartas()) as CartaContemplada[];
  return <CartasPublicClient cartas={cartas} />;
}
import type { Metadata } from "next";
