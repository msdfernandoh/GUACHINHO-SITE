import type { Metadata } from "next";
import { CartasPublicClient } from "@/components/public/cartas-public-client";
import type { CartaContemplada } from "@/lib/cartas/types";
import { getCatalogEmpresaIdFromHeaders } from "@/lib/grupos/resolve-catalog-empresa";
import { fetchPublicCartasAutorizadasForEmpresa } from "@/lib/cartas/catalogo-autorizado-cartas";

export const metadata: Metadata = {
  title: "Cartas de Crédito Contempladas Disponíveis",
  description: "Consulte cartas contempladas para imóvel e veículo, com crédito disponível e condições informadas para análise antes da contratação.",
  keywords: ["carta contemplada", "carta de crédito contemplada", "consórcio contemplado imóvel", "cota contemplada veículo"],
  alternates: { canonical: "/cartas-contempladas" },
};

export default async function CartasContempladasPublicPage() {
  const empresaId = await getCatalogEmpresaIdFromHeaders();

  const cartas = empresaId
    ? await fetchPublicCartasAutorizadasForEmpresa(empresaId)
    : [];

  return <CartasPublicClient cartas={cartas} />;
}
