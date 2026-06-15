import { fetchPublicCartas } from "@/app/admin/cartas-contempladas/actions";
import { CartasPublicClient } from "@/components/public/cartas-public-client";
import type { CartaContemplada } from "@/lib/cartas/types";

export default async function CartasContempladasPublicPage() {
  const cartas = (await fetchPublicCartas()) as CartaContemplada[];
  return <CartasPublicClient cartas={cartas} />;
}
